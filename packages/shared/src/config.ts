import fs from 'fs';
import path from 'path';
import { db } from './db';
import { createLogger } from './logger';

const log = createLogger('config-util');

// Configuration file path at the project workspace root
const CONFIG_FILE_PATH = path.join(process.cwd(), 'src-audit.config.json');

export interface RepoConfig {
  name: string;
  repoUrl: string;
  githubToken?: string;
  webhookSecret?: string;
  allowPRs?: boolean;
  allowPush?: boolean;
  adminUsers?: string[];
  branchFilter?: string;
  active?: boolean;
}

export interface AppConfig {
  repositories: RepoConfig[];
}

/**
 * Reads settings from the src-audit.config.json file.
 */
export function readConfigFile(): AppConfig {
  try {
    if (fs.existsSync(CONFIG_FILE_PATH)) {
      const raw = fs.readFileSync(CONFIG_FILE_PATH, 'utf-8');
      return JSON.parse(raw);
    }
  } catch (error: any) {
    log.error('Failed to read config file', { error: error.message, path: CONFIG_FILE_PATH });
  }
  return { repositories: [] };
}

/**
 * Writes settings to the src-audit.config.json file.
 */
export function writeConfigFile(config: AppConfig): void {
  try {
    fs.writeFileSync(CONFIG_FILE_PATH, JSON.stringify(config, null, 2), 'utf-8');
    log.info('Wrote configuration file', { path: CONFIG_FILE_PATH });
  } catch (error: any) {
    log.error('Failed to write config file', { error: error.message, path: CONFIG_FILE_PATH });
  }
}

/**
 * Synchronizes the contents of the configuration file into the database on startup.
 */
export async function syncConfig(): Promise<void> {
  const config = readConfigFile();
  if (config.repositories.length === 0) {
    log.info('No repositories defined in config file to sync.');
    return;
  }

  log.info('Syncing configuration from file to database', { repoCount: config.repositories.length });

  for (const repo of config.repositories) {
    try {
      const adminUsersStr = Array.isArray(repo.adminUsers) ? repo.adminUsers.join(',') : (repo.adminUsers || '');

      await db.project.upsert({
        where: { repoUrl: repo.repoUrl },
        update: {
          name: repo.name,
          githubToken: repo.githubToken !== undefined ? repo.githubToken : undefined,
          webhookSecret: repo.webhookSecret !== undefined ? repo.webhookSecret : undefined,
          allowPRs: repo.allowPRs !== undefined ? repo.allowPRs : undefined,
          allowPush: repo.allowPush !== undefined ? repo.allowPush : undefined,
          adminUsers: adminUsersStr,
          branchFilter: repo.branchFilter !== undefined ? repo.branchFilter : undefined,
          active: repo.active !== undefined ? repo.active : undefined,
        },
        create: {
          name: repo.name,
          repoUrl: repo.repoUrl,
          githubToken: repo.githubToken || null,
          webhookSecret: repo.webhookSecret || null,
          allowPRs: repo.allowPRs !== undefined ? repo.allowPRs : true,
          allowPush: repo.allowPush !== undefined ? repo.allowPush : true,
          adminUsers: adminUsersStr,
          branchFilter: repo.branchFilter || '*',
          active: repo.active !== undefined ? repo.active : true,
        },
      });
    } catch (e: any) {
      log.error('Failed to sync repo config', { repoUrl: repo.repoUrl, error: e.message });
    }
  }
}

/**
 * Exports all projects in the database into the src-audit.config.json file.
 */
export async function exportConfigToFile(): Promise<void> {
  try {
    const projects = await db.project.findMany();
    const config: AppConfig = {
      repositories: projects.map((p) => ({
        name: p.name,
        repoUrl: p.repoUrl,
        githubToken: p.githubToken || undefined,
        webhookSecret: p.webhookSecret || undefined,
        allowPRs: p.allowPRs,
        allowPush: p.allowPush,
        adminUsers: p.adminUsers ? p.adminUsers.split(',').filter(Boolean) : [],
        branchFilter: p.branchFilter,
        active: p.active,
      })),
    };
    writeConfigFile(config);
    log.info('Exported database config to file');
  } catch (error: any) {
    log.error('Failed to export config to file', { error: error.message });
  }
}

/**
 * Utility function to mask sensitive github tokens.
 */
export function maskToken(token: string | null | undefined): string {
  if (!token) return '';
  if (token.startsWith('ghp_')) {
    if (token.length <= 12) return 'ghp_********';
    return `ghp_${token.substring(4, 8)}********${token.substring(token.length - 4)}`;
  }
  if (token.length <= 8) return '********';
  return `${token.substring(0, 4)}********${token.substring(token.length - 4)}`;
}
