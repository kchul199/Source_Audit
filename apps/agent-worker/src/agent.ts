import OpenAI from 'openai';
import dotenv from 'dotenv';
import path from 'path';
import { db } from '@src-audit/shared';

// Load .env from root
dotenv.config({ path: path.join(process.cwd(), '.env') });

export class OpenAIAgent {
  private openai: OpenAI;

  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }

  async analyzeCode(auditId: string, repo: string, diff: string, context?: string) {
    console.log(`Analyzing code for Audit ${auditId}...`);

    const prompt = `
You are a Senior Software Architect and Security Expert.
Analyze the following code changes (diff) from the repository "${repo}".

${context ? `ADDITIONAL PROJECT CONTEXT/INSTRUCTIONS:\n${context}\n` : ''}

Provide a detailed code review focusing on:
1. SECURITY: Potential vulnerabilities (SQL injection, XSS, secrets exposure).
2. PERFORMANCE: Inefficiency, memory leaks, redundant calls.
3. MAINTAINABILITY: Clean code, naming, logic complexity.

For each finding, provide:
- Category (SECURITY, PERFORMANCE, MAINTAINABILITY)
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
  }
]

DIFF:
${diff}
`;

    const response = await this.openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: 'json_object' },
    });

    const content = response.choices[0].message.content;
    if (!content) throw new Error('AI returned empty response');

    const resultsRaw = JSON.parse(content);
    const results = Array.isArray(resultsRaw) ? resultsRaw : resultsRaw.findings || resultsRaw.results || [];

    // Store analysis results in DB
    for (const result of results) {
      await db.analysisResult.create({
        data: {
          auditId,
          category: result.category,
          severity: result.severity,
          filePath: result.filePath,
          description: result.description,
          suggestion: result.suggestion,
        },
      });
    }

    return results;
  }

  async generateTestCode(auditId: string, repo: string, diff: string, context?: string) {
    console.log(`Generating test code for Audit ${auditId}...`);

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
      model: 'gpt-4o',
      messages: [{ role: 'user', content: prompt }],
    });

    const testCode = response.choices[0].message.content;
    if (!testCode) throw new Error('AI failed to generate test code');

    // Clean up markdown code blocks if present
    const cleanedCode = testCode.replace(/```typescript|```javascript|```/g, '').trim();

    // Create initial test result in DB
    const testResult = await db.testResult.create({
      data: {
        auditId,
        testCode: cleanedCode,
        status: 'RUNNING',
      },
    });

    return { testCode: cleanedCode, testResultId: testResult.id };
  }

  async healTestCode(repo: string, diff: string, testCode: string, errorLogs: string, context?: string) {
    console.log(`Healing test code...`);

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

Identify the root cause of the failure (e.g., missing mock, syntax error, incorrect assertion).
Generate a corrected version of the test code that resolves these issues.
Return ONLY the corrected code for the test file.
`;

    const response = await this.openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [{ role: 'user', content: prompt }],
    });

    const healedCode = response.choices[0].message.content;
    if (!healedCode) throw new Error('AI failed to heal test code');

    return healedCode.replace(/```typescript|```javascript|```/g, '').trim();
  }
}
