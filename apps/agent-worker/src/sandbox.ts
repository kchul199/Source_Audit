import Docker from 'dockerode';
import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { createLogger } from '@src-audit/shared';

const log = createLogger('sandbox');

export interface SandboxResult {
  exitCode: number | null;
  stdout: string;
  stderr: string;
  phase?: 'install' | 'generated-test' | 'project-validation';
  validation?: SandboxResult;
}

interface EnvConfig {
  image: string;
  testCmd: (testFile: string, runner?: string) => string;
  installCmd: string;
  testEnv?: string[];
}

export class Sandbox {
  private docker: Docker;

  private envConfigs: Record<string, EnvConfig> = {
    node: {
      image: 'node:20-alpine',
      installCmd: 'npm install --silent --ignore-scripts 2>&1',
      testCmd: (file, runner) => {
        if (runner === 'vitest') return `npx vitest run ${file} 2>&1`;
        if (runner === 'mocha') return `npx mocha ${file} 2>&1`;
        if (runner === 'node:test') return `node --test ${file} 2>&1`;
        return `npx jest ${file} --no-cache 2>&1`;
      },
      testEnv: ['HOME=/tmp', 'npm_config_cache=/tmp/.npm'],
    },
    python: {
      image: 'python:3.11-slim',
      installCmd: 'python -m pip install pytest --quiet --target .src-audit-python-deps 2>&1 && if [ -f requirements.txt ]; then python -m pip install -r requirements.txt --quiet --target .src-audit-python-deps 2>&1; fi',
      testCmd: (file) => `PYTHONPATH=/usr/src/app/.src-audit-python-deps pytest ${file} -v 2>&1`,
      testEnv: ['HOME=/tmp', 'PYTHONDONTWRITEBYTECODE=1'],
    },
    go: {
      image: 'golang:1.21-alpine',
      installCmd: 'GOMODCACHE=/usr/src/app/.src-audit-go-mod go mod download 2>&1',
      testCmd: (target) => `GOCACHE=/tmp/go-build GOMODCACHE=/usr/src/app/.src-audit-go-mod go test ${target} -v 2>&1`,
      testEnv: ['HOME=/tmp'],
    },
  };

  constructor() {
    this.docker = new Docker();
  }

  private detectEnvironment(workspacePath: string, runner?: string, changedFiles: string[] = []): string {
    if (runner === 'pytest' || changedFiles.some((file) => file.endsWith('.py'))) return 'python';
    if (runner === 'go test' || changedFiles.some((file) => file.endsWith('.go'))) return 'go';
    if (fs.existsSync(path.join(workspacePath, 'package.json'))) return 'node';
    if (fs.existsSync(path.join(workspacePath, 'requirements.txt'))) return 'python';
    if (fs.existsSync(path.join(workspacePath, 'go.mod'))) return 'go';
    return 'node'; // Default
  }

  async runTest(
    workspacePath: string,
    testCode: string,
    validationCommands: string[] = [],
    runner?: string,
    changedFiles: string[] = [],
  ): Promise<SandboxResult> {
    const sandboxId = uuidv4();
    const envType = this.detectEnvironment(workspacePath, runner, changedFiles);
    const config = this.envConfigs[envType];

    // Set appropriate extension based on language
    const ext = envType === 'python' ? '.py' : envType === 'go' ? '_test.go' : '.spec.ts';
    const testDir = envType === 'go' ? this.pickGoTestDirectory(workspacePath, changedFiles) : workspacePath;
    const testFileName = `generated_test_${sandboxId}${ext}`;
    const testFilePath = path.join(testDir, testFileName);
    const testTarget = envType === 'go'
      ? `./${path.relative(workspacePath, testDir) || '.'}`
      : testFileName;

    fs.writeFileSync(testFilePath, testCode);

    const baseContainerConfig: Docker.ContainerCreateOptions = {
      Image: config.image,
      WorkingDir: '/usr/src/app',
      Labels: { 'src-audit-sandbox': 'true' },
    };

    try {
      const installResult = await this.runContainer(
        {
          ...baseContainerConfig,
          Cmd: ['sh', '-c', config.installCmd],
          HostConfig: this.hostConfig(workspacePath, 'rw', false),
        },
        sandboxId,
        'install',
      );

      if (installResult.exitCode !== 0) {
        log.warn('Sandbox dependency install failed', {
          sandboxId,
          envType,
          exitCode: installResult.exitCode,
        });
        return installResult;
      }

      const testResult = await this.runContainer(
        {
          ...baseContainerConfig,
          Cmd: ['sh', '-c', config.testCmd(testTarget, runner)],
          Env: config.testEnv,
          User: '65534:65534',
          HostConfig: this.hostConfig(workspacePath, 'ro', true),
        },
        sandboxId,
        'generated-test',
      );

      log.info('Sandbox execution completed', {
        sandboxId,
        exitCode: testResult.exitCode,
        stdoutLen: testResult.stdout.length,
        stderrLen: testResult.stderr.length,
      });

      if (testResult.exitCode === 0 && validationCommands.length > 0) {
        testResult.validation = await this.runProjectValidation(
          workspacePath,
          config,
          validationCommands,
          sandboxId,
        );
      }

      return testResult;
    } catch (error: any) {
      log.error('Sandbox error', { sandboxId, error: error.message });
      return {
        exitCode: 1,
        stdout: '',
        stderr: error.message || 'Unknown sandbox error',
      };
    } finally {
      // Cleanup test file
      if (fs.existsSync(testFilePath)) {
        fs.unlinkSync(testFilePath);
      }
    }
  }

  private async runProjectValidation(
    workspacePath: string,
    config: EnvConfig,
    validationCommands: string[],
    sandboxId: string,
  ): Promise<SandboxResult> {
    const command = this.combineValidationCommands(validationCommands);
    if (!command) {
      return { exitCode: 0, stdout: '', stderr: '', phase: 'project-validation' };
    }

    return this.runContainer(
      {
        Image: config.image,
        WorkingDir: '/usr/src/app',
        Cmd: ['sh', '-c', command],
        Env: config.testEnv,
        HostConfig: this.hostConfig(workspacePath, 'rw', true),
        Labels: { 'src-audit-sandbox': 'true' },
      },
      sandboxId,
      'project-validation',
    );
  }

  private combineValidationCommands(validationCommands: string[]) {
    const safeValidationCommands = validationCommands
      .filter((command) => !/[;&|`$<>]/.test(command))
      .slice(0, 3);

    return safeValidationCommands.map((command) => `${command} 2>&1`).join(' && ');
  }

  private pickGoTestDirectory(workspacePath: string, changedFiles: string[]) {
    const goFile = changedFiles.find((file) => file.endsWith('.go') && !file.endsWith('_test.go'));
    if (!goFile) return workspacePath;
    const dir = path.dirname(path.join(workspacePath, goFile));
    if (!dir.startsWith(workspacePath) || !fs.existsSync(dir)) return workspacePath;
    return dir;
  }

  private hostConfig(
    workspacePath: string,
    mountMode: 'ro' | 'rw',
    networkDisabled: boolean,
  ): Docker.HostConfig {
    return {
      Binds: [`${workspacePath}:/usr/src/app:${mountMode}`],
      Memory: 512 * 1024 * 1024,
      NanoCpus: 1000000000,
      NetworkMode: networkDisabled ? 'none' : undefined,
      ReadonlyRootfs: networkDisabled,
      Tmpfs: networkDisabled ? {
        '/tmp': 'rw,nosuid,size=128m',
      } : undefined,
      PidsLimit: 256,
      CapDrop: ['ALL'],
      SecurityOpt: ['no-new-privileges:true'],
    };
  }

  private async runContainer(
    containerConfig: Docker.ContainerCreateOptions,
    sandboxId: string,
    phase: 'install' | 'generated-test' | 'project-validation',
  ): Promise<SandboxResult> {
    let container: Docker.Container | undefined;
    const TIMEOUT_MS = phase === 'install' ? 120_000 : 60_000;
    let timeout: NodeJS.Timeout | undefined;

    try {
      await this.ensureImage(containerConfig.Image);
      container = await this.docker.createContainer(containerConfig);
      await container.start();

      log.info('Sandbox container started', { sandboxId, phase });

      const result = (await Promise.race([
        container.wait(),
        new Promise<never>((_, reject) => {
          timeout = setTimeout(async () => {
            log.warn('Sandbox timeout — killing container', { sandboxId, phase });
            try {
              await container!.kill();
            } catch { /* container may already be stopped */ }
            reject(new Error(`Sandbox ${phase} timeout after ${TIMEOUT_MS / 1000}s`));
          }, TIMEOUT_MS);
        }),
      ])) as { StatusCode: number };

      const { stdout, stderr } = await this.extractLogs(container);
      return {
        exitCode: result.StatusCode,
        stdout,
        stderr,
        phase,
      };
    } finally {
      if (timeout) {
        clearTimeout(timeout);
      }
      if (container) {
        try {
          await container.remove({ force: true });
        } catch {
          /* container may already be removed */
        }
      }
    }
  }

  private async ensureImage(image?: string): Promise<void> {
    if (!image) return;

    try {
      await this.docker.getImage(image).inspect();
    } catch {
      log.info('Pulling missing sandbox image', { image });
      const stream = await this.docker.pull(image);
      await new Promise<void>((resolve, reject) => {
        this.docker.modem.followProgress(stream, (err: Error | null) => {
          if (err) {
            reject(err);
            return;
          }
          resolve();
        });
      });
      await this.docker.getImage(image).inspect();
    }
  }

  /**
   * Extract and demultiplex Docker container logs into stdout and stderr.
   * Docker multiplexes stdout/stderr into a single stream with 8-byte headers.
   */
  private async extractLogs(container: Docker.Container): Promise<{ stdout: string; stderr: string }> {
    return new Promise((resolve) => {
      let stdout = '';
      let stderr = '';

      container.logs(
        { stdout: true, stderr: true, follow: false },
        (err, stream: any) => {
          if (err || !stream) {
            resolve({ stdout, stderr: err?.message || '' });
            return;
          }

          if (Buffer.isBuffer(stream) || typeof stream === 'string') {
            stdout = stream.toString();
            resolve({ stdout, stderr });
            return;
          }

          if (typeof stream.on !== 'function') {
            stdout = String(stream);
            resolve({ stdout, stderr });
            return;
          }

          // Dockerode provides a multiplexed stream.
          // Use demuxStream when possible, or fallback to raw string.
          try {
            const stdoutStream = {
              write: (chunk: Buffer | string) => {
                stdout += chunk.toString();
              },
            };
            const stderrStream = {
              write: (chunk: Buffer | string) => {
                stderr += chunk.toString();
              },
            };

            (container.modem as any).demuxStream(stream, stdoutStream, stderrStream);

            stream.on('end', () => resolve({ stdout, stderr }));
            stream.on('error', () => resolve({ stdout, stderr }));
          } catch {
            // Fallback: read entire stream as stdout
            const chunks: Buffer[] = [];
            stream.on('data', (chunk: Buffer) => chunks.push(chunk));
            stream.on('end', () => {
              stdout = Buffer.concat(chunks).toString();
              resolve({ stdout, stderr: '' });
            });
            stream.on('error', () => {
              stdout = Buffer.concat(chunks).toString();
              resolve({ stdout, stderr: '' });
            });
          }
        },
      );
    });
  }
}
