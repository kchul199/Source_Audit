import Docker from 'dockerode';
import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';

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
      installCmd: 'npm install --silent',
      testCmd: (file) => `npx jest ${file}`
    },
    python: {
      image: 'python:3.11-slim',
      installCmd: 'pip install -r requirements.txt --quiet',
      testCmd: (file) => `pytest ${file}`
    },
    go: {
      image: 'golang:1.21-alpine',
      installCmd: 'go mod download',
      testCmd: (file) => `go test ${file}`
    }
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
    const ext = envType === 'python' ? '.py' : (envType === 'go' ? '_test.go' : '.spec.ts');
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
        AutoRemove: true,
      },
      Labels: { 'src-audit-sandbox': 'true' },
    };

    try {
      const container = await this.docker.createContainer(containerConfig);
      await container.start();

      // Wait for container to finish with a timeout
      const result = await Promise.race([
        container.wait(),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Sandbox timeout')), 60000))
      ]) as any;

      const logs = await container.logs({ stdout: true, stderr: true });
      const output = logs.toString();

      // Simple stdout/stderr separation (Docker logs are multiplexed, but for simplicity we take all)
      return {
        exitCode: result.StatusCode,
        stdout: output,
        stderr: '', // Dockerode multiplexing is complex, combining for now
      };
    } catch (error: any) {
      console.error('Sandbox error:', error);
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
}
