import OpenAI from 'openai';
import { db } from '@src-audit/shared';
import { createLogger } from '@src-audit/shared';

const log = createLogger('agent');

export class OpenAIAgent {
  private openai: OpenAI;

  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }

  async analyzeCode(auditId: string, repo: string, diff: string, context?: string, model: string = 'gpt-4o') {
    log.info('Starting code analysis', { auditId, repo, model });

    const prompt = `
You are a Senior Software Architect and Quality Assurance Expert.
Analyze the following code changes (diff) from the repository "${repo}".

${context ? `ADDITIONAL PROJECT CONTEXT/INSTRUCTIONS:\n${context}\n` : ''}

Provide a detailed code review focusing on:
1. SECURITY: Potential vulnerabilities (SQL injection, XSS, secrets exposure, dependency risks).
2. PERFORMANCE: Inefficiency, memory leaks, redundant calls, CPU/IO blocks.
3. MAINTAINABILITY: Clean code, readability, naming, complex logic, documentation.
4. STABILITY: Exception handling, race conditions, concurrency issues, edge cases, potential crashes.
5. FLEXIBILITY: Hardcoded variables/parameters, tightly coupled components, configuration extraction needs.
6. EXTENSIBILITY: Monolithic design, tight cohesion blocks, OOP/functional patterns, architectural extension limits.
7. ERROR_PRONE: Syntax typos, API misuse/anti-patterns, incorrect conditional statements, logical flaws.

For each finding, provide:
- Category (SECURITY, PERFORMANCE, MAINTAINABILITY, STABILITY, FLEXIBILITY, EXTENSIBILITY, ERROR_PRONE)
- Severity (CRITICAL, HIGH, MEDIUM, LOW)
- File path
- Description of the issue
- Suggestion for improvement

Return the results as a JSON array of objects.
Example:
[
  {
    "category": "SECURITY",
    "severity": "HIGH",
    "filePath": "src/auth.ts",
    "description": "Hardcoded API key detected.",
    "suggestion": "Use environment variables."
  },
  {
    "category": "STABILITY",
    "severity": "MEDIUM",
    "filePath": "src/service.ts",
    "description": "Uncaught exception in async block could crash the process.",
    "suggestion": "Wrap inside try-catch block."
  }
]

DIFF:
${diff}
`;

    const response = await this.openai.chat.completions.create({
      model: model,
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: 'json_object' },
    });

    const content = response.choices[0].message.content;
    if (!content) throw new Error('AI returned empty response');

    // Graceful JSON parsing with fallback extraction
    let results: Array<{
      category: string;
      severity: string;
      filePath: string;
      description: string;
      suggestion?: string;
    }>;

    try {
      const resultsRaw = JSON.parse(content);
      results = Array.isArray(resultsRaw)
        ? resultsRaw
        : resultsRaw.findings || resultsRaw.results || [];
    } catch (parseError) {
      log.warn('Failed to parse AI response as JSON, attempting extraction...', {
        auditId,
        error: String(parseError),
      });
      // Attempt to extract JSON array from the response
      const jsonMatch = content.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        try {
          results = JSON.parse(jsonMatch[0]);
        } catch {
          results = [];
        }
      } else {
        results = [];
      }

      // Record parsing failure for manual review
      if (results.length === 0) {
        await db.analysisResult.create({
          data: {
            auditId,
            category: 'SYSTEM',
            severity: 'LOW',
            filePath: 'N/A',
            description: 'AI 응답 JSON 파싱 실패 — 수동 검토 필요',
            suggestion: content.substring(0, 1000),
          },
        });
      }
    }

    // Batch insert with createMany for performance
    if (results.length > 0) {
      await db.analysisResult.createMany({
        data: results.map((r) => ({
          auditId,
          category: r.category || 'UNKNOWN',
          severity: r.severity || 'LOW',
          filePath: r.filePath || 'unknown',
          description: r.description || '',
          suggestion: r.suggestion ?? null,
        })),
      });
    }

    log.info('Code analysis completed', { auditId, findingsCount: results.length });
    return results;
  }

  async generateTestCode(auditId: string, repo: string, diff: string, context?: string, model: string = 'gpt-4o') {
    log.info('Generating test code', { auditId, repo, model });

    const prompt = `
You are an expert QA Engineer. 
Based on the following code changes (diff) from "${repo}", generate a comprehensive unit test.

${context ? `ADDITIONAL PROJECT CONTEXT/INSTRUCTIONS:\n${context}\n` : ''}

INSTRUCTIONS:
1. Detect the programming language and most appropriate test framework (e.g., Jest for TS/JS, Pytest for Python, Go Test for Go).
2. Generate a comprehensive unit test for the business logic in the diff.
3. Mock external dependencies.
4. Return ONLY the code for the test file. Do not include markdown code blocks.

DIFF:
${diff}
`;

    const response = await this.openai.chat.completions.create({
      model: model,
      messages: [{ role: 'user', content: prompt }],
    });

    const testCode = response.choices[0].message.content;
    if (!testCode) throw new Error('AI failed to generate test code');

    // Clean up markdown code blocks if present (multiple language patterns)
    const cleanedCode = testCode
      .replace(/```(?:typescript|javascript|python|go|ts|js|py)?\n?/g, '')
      .trim();

    // Create initial test result in DB
    const testResult = await db.testResult.create({
      data: {
        auditId,
        testCode: cleanedCode,
        status: 'RUNNING',
      },
    });

    log.info('Test code generated', { auditId, testResultId: testResult.id });
    return { testCode: cleanedCode, testResultId: testResult.id };
  }

  async healTestCode(
    repo: string,
    diff: string,
    testCode: string,
    errorLogs: string,
    context?: string,
    model: string = 'gpt-4o'
  ): Promise<{ healedCode: string; errorAnalysis: string }> {
    log.info('Healing test code...', { repo, model });

    const prompt = `
You are an expert QA Engineer. 
The following unit test you generated for the repository "${repo}" failed.

${context ? `ADDITIONAL PROJECT CONTEXT/INSTRUCTIONS:\n${context}\n` : ''}

DIFF OF CHANGES:
${diff}

FAILED TEST CODE:
${testCode}

ERROR LOGS:
${errorLogs}

First, analyze the root cause of the failure.
Then, generate a corrected version of the test code.

Return your response in this exact JSON format:
{
  "errorAnalysis": "Brief explanation of what went wrong",
  "healedCode": "The full corrected test code"
}
`;

    const response = await this.openai.chat.completions.create({
      model: model,
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: 'json_object' },
    });

    const content = response.choices[0].message.content;
    if (!content) throw new Error('AI failed to heal test code');

    try {
      const parsed = JSON.parse(content);
      const healedCode = (parsed.healedCode || parsed.code || content)
        .replace(/```(?:typescript|javascript|python|go|ts|js|py)?\n?/g, '')
        .trim();

      return {
        healedCode,
        errorAnalysis: parsed.errorAnalysis || 'No analysis provided',
      };
    } catch {
      // Fallback: treat entire response as code
      const cleanedCode = content
        .replace(/```(?:typescript|javascript|python|go|ts|js|py)?\n?/g, '')
        .trim();

      return {
        healedCode: cleanedCode,
        errorAnalysis: 'Failed to parse structured response — raw code extracted',
      };
    }
  }
}
