import fs from 'fs';
import path from 'path';

export interface ChangedFileContext {
  filePath: string;
  exists: boolean;
  language: string;
  contentPreview?: string;
  lineCount?: number;
  relatedTests: string[];
}

export interface StaticFinding {
  tool: string;
  category: string;
  severity: string;
  filePath: string;
  lineRange?: string;
  description: string;
  suggestion?: string;
  sourceSnippet?: string;
}

export interface ValidationCommand {
  label: string;
  command: string;
  kind?: 'generated-test' | 'project-validation' | 'static-analysis';
}

export interface ProjectContextBundle {
  changedFiles: ChangedFileContext[];
  projectFiles: Record<string, string>;
  validationCommands: ValidationCommand[];
  staticFindings: StaticFinding[];
  summary: string;
}

const MAX_FILE_PREVIEW = 20_000;
const MAX_PROJECT_FILE = 12_000;

const languageByExtension: Record<string, string> = {
  '.ts': 'typescript',
  '.tsx': 'typescript-react',
  '.js': 'javascript',
  '.jsx': 'javascript-react',
  '.mjs': 'javascript',
  '.cjs': 'javascript',
  '.py': 'python',
  '.go': 'go',
  '.java': 'java',
  '.rb': 'ruby',
  '.php': 'php',
  '.rs': 'rust',
};

export function extractChangedFiles(diff: string): string[] {
  const files = new Set<string>();
  for (const line of diff.split('\n')) {
    if (!line.startsWith('diff --git ')) continue;
    const match = line.match(/^diff --git a\/(.+?) b\/(.+)$/);
    if (!match) continue;
    const filePath = match[2] === '/dev/null' ? match[1] : match[2];
    if (filePath && !filePath.includes('..')) {
      files.add(filePath);
    }
  }
  return Array.from(files);
}

export function extractAddedLinesByFile(diff: string): Map<string, Map<number, string>> {
  const byFile = new Map<string, Map<number, string>>();
  let currentFile = '';
  let newLine = 0;

  for (const line of diff.split('\n')) {
    const fileMatch = line.match(/^diff --git a\/(.+?) b\/(.+)$/);
    if (fileMatch) {
      currentFile = fileMatch[2];
      if (!byFile.has(currentFile)) byFile.set(currentFile, new Map());
      continue;
    }

    const hunkMatch = line.match(/^@@ -\d+(?:,\d+)? \+(\d+)(?:,\d+)? @@/);
    if (hunkMatch) {
      newLine = Number(hunkMatch[1]);
      continue;
    }

    if (!currentFile || line.startsWith('+++') || line.startsWith('---')) continue;

    if (line.startsWith('+')) {
      byFile.get(currentFile)?.set(newLine, line.slice(1));
      newLine++;
    } else if (!line.startsWith('-')) {
      newLine++;
    }
  }

  return byFile;
}

export function buildProjectContext(workspacePath: string, diff: string): ProjectContextBundle {
  const changedFilePaths = extractChangedFiles(diff);
  const projectFiles = readProjectFiles(workspacePath);
  const validationCommands = detectValidationCommands(workspacePath);
  const changedFiles = changedFilePaths.map((filePath) => readChangedFileContext(workspacePath, filePath));
  const staticFindings = runStaticAnalysis(workspacePath, changedFilePaths, diff);

  return {
    changedFiles,
    projectFiles,
    validationCommands,
    staticFindings,
    summary: [
      `Changed files: ${changedFiles.length}`,
      `Project metadata files: ${Object.keys(projectFiles).join(', ') || 'none'}`,
      `Detected validation commands: ${validationCommands.map((c) => c.label).join(', ') || 'none'}`,
      `Static findings: ${staticFindings.length}`,
    ].join('\n'),
  };
}

export function formatContextBundle(bundle: ProjectContextBundle): string {
  const changed = bundle.changedFiles.map((file) => [
    `### ${file.filePath}`,
    `exists=${file.exists}, language=${file.language}, lines=${file.lineCount ?? 'unknown'}`,
    file.relatedTests.length > 0 ? `relatedTests=${file.relatedTests.join(', ')}` : 'relatedTests=none',
    file.contentPreview ? `CONTENT PREVIEW:\n${file.contentPreview}` : 'CONTENT PREVIEW: unavailable',
  ].join('\n')).join('\n\n');

  const projectFiles = Object.entries(bundle.projectFiles)
    .map(([filePath, content]) => `### ${filePath}\n${content}`)
    .join('\n\n');

  const validations = bundle.validationCommands
    .map((command) => `- ${command.label}: ${command.command}`)
    .join('\n');

  const staticFindings = bundle.staticFindings
    .map((finding) => `- [${finding.severity}] ${finding.tool}/${finding.category} ${finding.filePath}${finding.lineRange ? `:${finding.lineRange}` : ''} - ${finding.description}`)
    .join('\n');

  return [
    'PROJECT CONTEXT SUMMARY',
    bundle.summary,
    '',
    'CHANGED FILE CONTEXT',
    changed || 'No changed files detected.',
    '',
    'PROJECT METADATA',
    projectFiles || 'No project metadata found.',
    '',
    'DETECTED VALIDATION COMMANDS',
    validations || 'No validation commands detected.',
    '',
    'STATIC ANALYSIS FINDINGS',
    staticFindings || 'No static findings detected.',
  ].join('\n');
}

export function validateAiFindings(
  findings: StaticFinding[],
  workspacePath: string,
  diff: string,
): StaticFinding[] {
  const addedLines = extractAddedLinesByFile(diff);
  const diffEvidence = extractDiffEvidence(diff);
  const seen = new Set<string>();
  const validated: StaticFinding[] = [];

  for (const finding of findings) {
    if (!finding.filePath || finding.filePath === 'N/A') {
      validated.push({ ...finding, severity: 'LOW', category: finding.category || 'SYSTEM' });
      continue;
    }

    const fullPath = safeJoin(workspacePath, finding.filePath);
    if (!fullPath || !fs.existsSync(fullPath)) {
      const evidence = diffEvidence.get(finding.filePath);
      if (evidence) {
        validated.push({
          ...finding,
          sourceSnippet: evidence,
          severity: calibrateSeverity(finding.severity, true, true),
        });
      }
      continue;
    }

    const normalizedLine = normalizeLineRange(finding.lineRange);
    const fileContent = fs.readFileSync(fullPath, 'utf8');
    const lineSnippet = normalizedLine ? readLine(fullPath, normalizedLine) : undefined;
    const aiSnippet = normalizeSnippet(finding.sourceSnippet);
    const snippetMatches = aiSnippet ? fileContent.includes(aiSnippet) : false;
    const lineMatchesSnippet = Boolean(aiSnippet && lineSnippet?.includes(aiSnippet));
    const isChangedLine = normalizedLine
      ? addedLines.get(finding.filePath)?.has(normalizedLine) === true
      : false;

    if (finding.tool === 'openai' && aiSnippet && !snippetMatches && !lineMatchesSnippet) {
      continue;
    }
    if (finding.tool === 'openai' && !aiSnippet && !isChangedLine) {
      continue;
    }
    const snippet = lineMatchesSnippet || isChangedLine ? lineSnippet : snippetMatches ? finding.sourceSnippet : undefined;
    const lacksAiSnippet = finding.tool === 'openai' && !aiSnippet;
    const key = [
      finding.category,
      finding.filePath,
      normalizedLine ?? '',
      normalizeText(finding.description),
    ].join(':');

    if (seen.has(key)) continue;
    seen.add(key);

    validated.push({
      ...finding,
      category: lacksAiSnippet ? 'MANUAL_REVIEW' : finding.category,
      lineRange: normalizedLine ? String(normalizedLine) : finding.lineRange,
      sourceSnippet: snippet,
      severity: lacksAiSnippet
        ? 'LOW'
        : calibrateSeverity(finding.severity, Boolean(snippet), isChangedLine || snippetMatches),
      suggestion: lacksAiSnippet
        ? `${finding.suggestion || ''}\nAI finding lacked a matching sourceSnippet; manual verification required.`.trim()
        : finding.suggestion,
    });
  }

  return validated;
}

function extractDiffEvidence(diff: string): Map<string, string> {
  const evidence = new Map<string, string>();
  let currentFile = '';
  const buffer: string[] = [];

  const flush = () => {
    if (currentFile && buffer.length > 0 && !evidence.has(currentFile)) {
      evidence.set(currentFile, buffer.join('\n').slice(0, 1200));
    }
    buffer.length = 0;
  };

  for (const line of diff.split('\n')) {
    const fileMatch = line.match(/^diff --git a\/(.+?) b\/(.+)$/);
    if (fileMatch) {
      flush();
      currentFile = fileMatch[2] === '/dev/null' ? fileMatch[1] : fileMatch[2];
      continue;
    }
    if ((line.startsWith('-') || line.startsWith('+')) && !line.startsWith('---') && !line.startsWith('+++')) {
      buffer.push(line);
    }
  }
  flush();
  return evidence;
}

export function classifySandboxFailure(result: { exitCode: number | null; stdout: string; stderr: string }): string {
  const output = `${result.stdout}\n${result.stderr}`.toLowerCase();
  if (result.exitCode === 0) return 'PASSED';
  if (output.includes('timeout')) return 'TIMEOUT';
  if (output.includes('npm install') || output.includes('eresolve') || output.includes('enoent') || output.includes('no such image')) {
    return 'DEPENDENCY_OR_ENVIRONMENT_FAILURE';
  }
  if (output.includes('syntaxerror') || output.includes('ts-jest') || output.includes('unexpected token')) {
    return 'GENERATED_TEST_SYNTAX_FAILURE';
  }
  if (output.includes('cannot find module') || output.includes('module not found')) {
    return 'GENERATED_TEST_IMPORT_FAILURE';
  }
  if (output.includes('assert') || output.includes('expect(') || output.includes('failed')) {
    return 'TEST_ASSERTION_FAILURE';
  }
  return 'UNKNOWN_SANDBOX_FAILURE';
}

function readProjectFiles(workspacePath: string): Record<string, string> {
  const candidates = [
    'package.json',
    'tsconfig.json',
    'requirements.txt',
    'pyproject.toml',
    'go.mod',
    'README.md',
    'GEMINI.md',
  ];
  const files: Record<string, string> = {};
  for (const candidate of candidates) {
    const fullPath = path.join(workspacePath, candidate);
    if (fs.existsSync(fullPath) && fs.statSync(fullPath).isFile()) {
      files[candidate] = fs.readFileSync(fullPath, 'utf8').slice(0, MAX_PROJECT_FILE);
    }
  }
  return files;
}

function readChangedFileContext(workspacePath: string, filePath: string): ChangedFileContext {
  const fullPath = safeJoin(workspacePath, filePath);
  const ext = path.extname(filePath);
  const exists = Boolean(fullPath && fs.existsSync(fullPath) && fs.statSync(fullPath).isFile());
  const content = exists && fullPath ? fs.readFileSync(fullPath, 'utf8') : '';
  return {
    filePath,
    exists,
    language: languageByExtension[ext] || ext.replace('.', '') || 'unknown',
    contentPreview: content.slice(0, MAX_FILE_PREVIEW),
    lineCount: exists ? content.split('\n').length : undefined,
    relatedTests: findRelatedTests(workspacePath, filePath),
  };
}

function findRelatedTests(workspacePath: string, filePath: string): string[] {
  const base = path.basename(filePath, path.extname(filePath));
  const results: string[] = [];
  const stack = [workspacePath];
  while (stack.length > 0 && results.length < 8) {
    const dir = stack.pop()!;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.name === 'node_modules' || entry.name === '.git' || entry.name === 'dist') continue;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        stack.push(full);
      } else if (/\.(test|spec)\.[jt]sx?$|_test\.go$|test_.*\.py$/.test(entry.name) && entry.name.includes(base)) {
        results.push(path.relative(workspacePath, full));
      }
    }
  }
  return results;
}

function detectValidationCommands(workspacePath: string): ValidationCommand[] {
  const commands: ValidationCommand[] = [];
  const packageJsonPath = path.join(workspacePath, 'package.json');
  if (fs.existsSync(packageJsonPath)) {
    try {
      const pkg = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
      const scripts = pkg.scripts || {};
      for (const name of ['typecheck', 'lint', 'test', 'build']) {
        if (scripts[name]) commands.push({ label: `npm:${name}`, command: `npm run ${name}` });
      }
    } catch {
      // Ignore malformed package metadata.
    }
  }
  if (fs.existsSync(path.join(workspacePath, 'pyproject.toml'))) {
    commands.push({ label: 'python:pytest', command: 'pytest' });
  }
  if (fs.existsSync(path.join(workspacePath, 'go.mod'))) {
    commands.push({ label: 'go:test', command: 'go test ./...' });
  }
  return commands;
}

function runStaticAnalysis(workspacePath: string, changedFiles: string[], diff: string): StaticFinding[] {
  return [
    ...runSecretScan(diff),
    ...runChangedFileSanity(workspacePath, changedFiles),
  ];
}

function runSecretScan(diff: string): StaticFinding[] {
  const findings: StaticFinding[] = [];
  const secretPattern = /(api[_-]?key|secret|token|password)\s*[:=]\s*['"][^'"]{8,}/i;
  let currentFile = 'unknown';
  let currentLine = 0;
  for (const line of diff.split('\n')) {
    const fileMatch = line.match(/^diff --git a\/(.+?) b\/(.+)$/);
    if (fileMatch) {
      currentFile = fileMatch[2];
      currentLine = 0;
      continue;
    }
    const hunkMatch = line.match(/^@@ -\d+(?:,\d+)? \+(\d+)(?:,\d+)? @@/);
    if (hunkMatch) {
      currentLine = Number(hunkMatch[1]);
      continue;
    }
    if (line.startsWith('+') && !line.startsWith('+++')) {
      const added = line.slice(1);
      if (secretPattern.test(added)) {
        findings.push({
          tool: 'builtin-secret-scan',
          category: 'SECURITY',
          severity: 'HIGH',
          filePath: currentFile,
          lineRange: String(currentLine),
          description: '변경 diff에 secret/token/password로 보이는 값이 추가되었습니다.',
          suggestion: '비밀값은 환경 변수나 secret manager로 이동하고 저장소에서 제거하세요.',
          sourceSnippet: added,
        });
      }
      currentLine++;
    } else if (!line.startsWith('-')) {
      currentLine++;
    }
  }
  return findings;
}

function runChangedFileSanity(workspacePath: string, changedFiles: string[]): StaticFinding[] {
  const findings: StaticFinding[] = [];
  for (const filePath of changedFiles) {
    const fullPath = safeJoin(workspacePath, filePath);
    if (!fullPath || !fs.existsSync(fullPath)) continue;
    if (!/\.(ts|tsx|js|jsx|py|go)$/.test(filePath)) continue;
    const content = fs.readFileSync(fullPath, 'utf8');
    if (content.length > 250_000) {
      findings.push({
        tool: 'builtin-file-sanity',
        category: 'MAINTAINABILITY',
        severity: 'MEDIUM',
        filePath,
        description: '변경 파일이 매우 커서 리뷰 정확도와 유지보수성이 떨어질 수 있습니다.',
        suggestion: '파일을 책임 단위로 분리하거나 변경 범위를 축소하세요.',
      });
    }
  }
  return findings;
}

function safeJoin(root: string, filePath: string) {
  const fullPath = path.resolve(root, filePath);
  const resolvedRoot = path.resolve(root);
  if (!fullPath.startsWith(resolvedRoot + path.sep) && fullPath !== resolvedRoot) return null;
  return fullPath;
}

function normalizeLineRange(lineRange?: string) {
  if (!lineRange) return undefined;
  const match = lineRange.match(/\d+/);
  if (!match) return undefined;
  return Number(match[0]);
}

function readLine(filePath: string, lineNumber: number) {
  const line = fs.readFileSync(filePath, 'utf8').split('\n')[lineNumber - 1];
  return line?.slice(0, 1000);
}

function normalizeText(value: string) {
  return value.toLowerCase().replace(/\s+/g, ' ').slice(0, 160);
}

function normalizeSnippet(value?: string) {
  if (!value) return undefined;
  return value.trim().slice(0, 1000);
}

function calibrateSeverity(severity: string, hasEvidence: boolean, isChangedLine: boolean) {
  if (hasEvidence && isChangedLine) return severity || 'LOW';
  if (severity === 'CRITICAL') return 'HIGH';
  if (severity === 'HIGH' && !hasEvidence) return 'MEDIUM';
  return severity || 'LOW';
}
