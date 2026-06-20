import OpenAI from 'openai';
import { db } from '@src-audit/shared';
import { createLogger } from '@src-audit/shared';
import type { StaticFinding } from './context';

const log = createLogger('agent');

function normalizeFindings(raw: unknown): StaticFinding[] {
  const items = Array.isArray(raw)
    ? raw
    : raw && typeof raw === 'object' && Array.isArray((raw as { findings?: unknown }).findings)
      ? (raw as { findings: unknown[] }).findings
      : raw && typeof raw === 'object' && Array.isArray((raw as { results?: unknown }).results)
        ? (raw as { results: unknown[] }).results
        : [];

  return items
    .filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === 'object')
    .map((item) => ({
      tool: typeof item.tool === 'string' ? item.tool : 'openai',
      category: typeof item.category === 'string' ? item.category : 'UNKNOWN',
      severity: typeof item.severity === 'string' ? item.severity : 'LOW',
      filePath: typeof item.filePath === 'string' ? item.filePath : 'unknown',
      lineRange: typeof item.lineRange === 'string' ? item.lineRange : undefined,
      description: typeof item.description === 'string' ? item.description : '',
      suggestion: typeof item.suggestion === 'string' ? item.suggestion : undefined,
      sourceSnippet: typeof item.sourceSnippet === 'string' ? item.sourceSnippet : undefined,
    }))
    .filter((item) => item.description.length > 0);
}

export class OpenAIAgent {
  private openai: OpenAI;

  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }

  async analyzeCode(
    auditId: string,
    repo: string,
    diff: string,
    context?: string,
    model: string = 'gpt-4o',
    staticFindings: StaticFinding[] = [],
  ): Promise<StaticFinding[]> {
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
- Line range if available
- Evidence snippet copied from the changed file/context
- Description of the issue
- Suggestion for improvement
- Confidence from 0 to 1

Rules:
- Prefer findings backed by the provided full file/context/static evidence.
- Do not invent file paths or line numbers.
- If static findings are provided, reconcile them instead of duplicating them.

Return the results as a JSON object with a "findings" array.
Example:
{
  "findings": [
  {
    "category": "SECURITY",
    "severity": "HIGH",
    "filePath": "src/auth.ts",
    "lineRange": "12",
    "sourceSnippet": "const apiKey = ...",
    "description": "Hardcoded API key detected.",
    "suggestion": "Use environment variables.",
    "confidence": 0.91
  }
  ]
}

STATIC FINDINGS:
${JSON.stringify(staticFindings, null, 2)}

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
    let results: StaticFinding[];

    try {
      const resultsRaw = JSON.parse(content);
      results = normalizeFindings(resultsRaw);
    } catch (parseError) {
      log.warn('Failed to parse AI response as JSON, attempting extraction...', {
        auditId,
        error: String(parseError),
      });
      // Attempt to extract JSON array from the response
      const jsonMatch = content.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        try {
          results = normalizeFindings(JSON.parse(jsonMatch[0]));
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

    log.info('Code analysis completed', { auditId, findingsCount: results.length });
    return results.map((result) => ({
      tool: result.tool || 'openai',
      category: result.category || 'UNKNOWN',
      severity: result.severity || 'LOW',
      filePath: result.filePath || 'unknown',
      lineRange: result.lineRange,
      description: result.description || '',
      suggestion: result.suggestion,
      sourceSnippet: result.sourceSnippet,
    }));
  }

  async generateTestStrategy(repo: string, diff: string, context?: string, model: string = 'gpt-4o') {
    log.info('Generating test strategy', { repo, model });

    const prompt = `
You are an expert QA lead.
Create a focused test strategy before writing code for repository "${repo}".

${context ? `PROJECT CONTEXT:\n${context}\n` : ''}

Return JSON only:
{
  "language": "typescript|javascript|python|go|unknown",
  "framework": "jest|vitest|mocha|node:test|pytest|go test|unknown",
  "behaviorSummary": "What changed",
  "testCases": [
    {
      "name": "short test case name",
      "purpose": "what behavior it proves",
      "inputs": "important inputs/mocks",
      "expected": "expected outcome"
    }
  ],
  "mockingPlan": "external dependencies to mock",
  "riskNotes": "risks or limitations"
}

DIFF:
${diff}
`;

    const response = await this.openai.chat.completions.create({
      model,
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: 'json_object' },
    });

    const content = response.choices[0].message.content;
    if (!content) throw new Error('AI failed to generate test strategy');
    try {
      return JSON.parse(content);
    } catch {
      return { language: 'unknown', framework: 'unknown', behaviorSummary: content, testCases: [] };
    }
  }

  async generateTestCode(
    auditId: string,
    repo: string,
    diff: string,
    context?: string,
    model: string = 'gpt-4o',
    strategy?: unknown,
  ) {
    log.info('Generating test code', { auditId, repo, model });

    const prompt = `
You are an expert QA Engineer. 
Based on the following code changes (diff) and approved test strategy from "${repo}", generate a comprehensive unit test.

${context ? `ADDITIONAL PROJECT CONTEXT/INSTRUCTIONS:\n${context}\n` : ''}

TEST STRATEGY:
${JSON.stringify(strategy ?? {}, null, 2)}

INSTRUCTIONS:
1. Detect the programming language and most appropriate test framework (e.g., Jest for TS/JS, Pytest for Python, Go Test for Go).
2. Generate a comprehensive unit test for the business logic in the diff.
3. Mock external dependencies.
4. Prefer imports and conventions visible in PROJECT CONTEXT.
5. Return ONLY the code for the test file. Do not include markdown code blocks.

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
