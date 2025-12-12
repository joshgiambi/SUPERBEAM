import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import { logger } from '../logger.ts';

export function resolveFuseboxPython(): string {
  // Try multiple candidates in order of preference, matching fusebox.ts logic
  const candidateList = [
    process.env.FUSEBOX_PYTHON?.trim(),
    process.env.SIMPLEITK_PYTHON?.trim(),
    process.env.PYTHON?.trim(),
    path.join(process.cwd(), 'sam_env', 'bin', 'python'),
    process.platform === 'win32' ? 'python' : 'python3',
  ].filter((c): c is string => !!c);

  for (const candidate of candidateList) {
    // Check if the candidate exists (for absolute paths)
    if (path.isAbsolute(candidate)) {
      try {
        fs.accessSync(candidate, fs.constants.X_OK);
        logger.info(`[resolveFuseboxPython] Using: "${candidate}"`);
        return candidate;
      } catch {
        continue;
      }
    } else {
      // For non-absolute paths (python3, python), just use them directly
      logger.info(`[resolveFuseboxPython] Using: "${candidate}"`);
      return candidate;
    }
  }

  // Final fallback
  const fallback = process.platform === 'win32' ? 'python' : 'python3';
  logger.info(`[resolveFuseboxPython] Using final fallback: "${fallback}"`);
  return fallback;
}

export async function runFuseboxScript<T = any>(scriptName: string, config: Record<string, unknown>): Promise<T> {
  const python = resolveFuseboxPython();
  const scriptPath = path.resolve('scripts', scriptName);
  const tmpBase = path.join(process.cwd(), 'tmp');
  await fs.promises.mkdir(tmpBase, { recursive: true });
  const tmpDir = await fs.promises.mkdtemp(path.join(tmpBase, 'fusebox-'));
  const configPath = path.join(tmpDir, 'config.json');
  await fs.promises.writeFile(configPath, JSON.stringify(config), 'utf-8');

  return new Promise<T>((resolve, reject) => {
    const child = spawn(python, [scriptPath, '--config', configPath], { cwd: process.cwd() });
    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (chunk) => { stdout += chunk.toString(); });
    child.stderr.on('data', (chunk) => { stderr += chunk.toString(); });
    child.on('error', (err) => {
      reject(err);
    });
    child.on('close', async (code) => {
      try {
        await fs.promises.rm(tmpDir, { recursive: true, force: true });
      } catch (err) {
        logger.warn(`Failed cleaning fusebox tmp dir: ${(err as Error).message}`);
      }

      if (code !== 0) {
        const errorMessage = stderr.trim() || stdout.trim() || `fusebox script exited with ${code}`;
        const err: any = new Error(errorMessage);
        err.code = code;
        err.stderr = stderr;
        err.stdout = stdout;
        reject(err);
        return;
      }

      try {
        const payload = JSON.parse(stdout || '{}');
        resolve(payload as T);
      } catch (err) {
        reject(new Error(`Failed to parse fusebox output: ${(err as Error).message}`));
      }
    });
  });
}

