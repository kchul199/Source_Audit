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
}

interface EnvConfig {
  image: string;
  testCmd: (testFile: string) => string;
  installCmd: string;
}

export class Sandbox {
  private docker: Docker;

  private envConfigs: Record<string, EnvConfig> = {
    node: {
      image: 'node:20-alpine',
      installCmd: 'npm install --silent 2>&1',
      testCmd: (file) => `npx jest ${file} --no-cache 2>&1`,
    },
    python: {
      image: 'python:3.11-slim',
      installCmd: 'pip install -r requirements.txt --quiet 2>&1 || true',
      testCmd: (file) => `pytest ${file} -v 2>&1`,
    },
    go: {
      image: 'golang:1.21-alpine',
      installCmd: 'go mod download 2>&1',
      testCmd: (file) => `go test ${file} -v 2>&1`,
    },
  };

  constructor() {
    this.docker = new Docker();
  }

  private detectEnvironment(workspacePath: string): string {
    if (fs.existsSync(path.join(workspacePath, 'package.json'))) return 'node';
    if (fs.existsSync(path.join(workspacePath, 'requirements.txt'))) return 'python';
    if (fs.existsSync(path.join(workspacePath, 'go.mod'))) return 'go';
    return 'node'; // Default
  }

  async runTest(workspacePath: string, testCode: string): Promise<SandboxResult> {
    const sandboxId = uuidv4();
    const envType = this.detectEnvironment(workspacePath);
    const config = this.envConfigs[envType];

    // Set appropriate extension based on language
    const ext = envType === 'python' ? '.py' : envType === 'go' ? '_test.go' : '.spec.ts';
    const testFileName = `generated_test_${sandboxId}${ext}`;
    const testFilePath = path.join(workspacePath, testFileName);

    fs.writeFileSync(testFilePath, testCode);

    const containerConfig: Docker.ContainerCreateOptions = {
      Image: config.image,
      Cmd: ['sh', '-c', `${config.installCmd} && ${config.testCmd(testFileName)}`],
      WorkingDir: '/usr/src/app',
      HostConfig: {
        Binds: [`${workspacePath}:/usr/src/app:rw`],
        Memory: 512 * 1024 * 1024,
        NanoCpus: 1000000000,
        // Note: AutoRemove removed — we manually cleanup after extracting logs
      },
      Labels: { 'src-audit-sandbox': 'true' },
    };

    let container: Docker.Container | undefined;
    const TIMEOUT_MS = 60_000;

    try {
      container = await this.docker.createContainer(containerConfig);
      await container.start();

      log.info('Sandbox container started', { sandboxId, envType, testFileName });

      // Wait for container with timeout + proper cleanup
      const result = (await Promise.race([
        container.wait(),
        new Promise<never>((_, reject) => {
          setTimeout(async () => {
            log.warn('Sandbox timeout — killing container', { sandboxId });
            try {
              await container!.kill();
            } catch { /* container may already be stopped */ }
            reject(new Error('Sandbox timeout after 60s'));
          }, TIMEOUT_MS);
        }),
      ])) as { StatusCode: number };

      // Extract logs with proper stdout/stderr demux
      const { stdout, stderr } = await this.extractLogs(container);

      log.info('Sandbox execution completed', {
        sandboxId,
        exitCode: result.StatusCode,
        stdoutLen: stdout.length,
        stderrLen: stderr.length,
      });

      return {
        exitCode: result.StatusCode,
        stdout,
        stderr,
      };
    } catch (error: any) {
      log.error('Sandbox error', { sandboxId, error: error.message });
      return {
        exitCode: 1,
        stdout: '',
        stderr: error.message || 'Unknown sandbox error',
      };
    } finally {
      // Cleanup container (if not AutoRemoved)
      if (container) {
        try {
          await container.remove({ force: true });
        } catch {
          /* container may already be removed */
        }
      }
      // Cleanup test file
      if (fs.existsSync(testFilePath)) {
        fs.unlinkSync(testFilePath);
      }
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
