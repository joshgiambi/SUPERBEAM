#!/usr/bin/env node
/**
 * Ensure MONAI propagation service is running locally for dev.
 *
 * - Uses MONAI_SERVICE_URL (default http://127.0.0.1:5005)
 * - If unreachable and host is local, spawns server/monai/start-service.sh
 */

import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const DEFAULT_URL = 'http://127.0.0.1:5005';
const serviceUrl = process.env.MONAI_SERVICE_URL || DEFAULT_URL;

function isLocalHost(url) {
  try {
    const u = new URL(url);
    return ['127.0.0.1', 'localhost', '::1'].includes(u.hostname);
  } catch {
    return true;
  }
}

async function checkHealth(url, timeoutMs = 2000) {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    const response = await fetch(new URL('/health', url), {
      method: 'GET',
      signal: controller.signal,
    });
    clearTimeout(timeout);
    if (!response.ok) return null;
    return await response.json();
  } catch {
    return null;
  }
}

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function ensureMonai() {
  const health = await checkHealth(serviceUrl, 1500);
  if (health && health.status === 'healthy') {
    console.log('🧠 MONAI already running at', serviceUrl);
    return;
  }

  if (!isLocalHost(serviceUrl)) {
    console.log('ℹ️  Skipping local MONAI start; remote service configured at', serviceUrl);
    return;
  }

  let port = 5005;
  try {
    port = Number(new URL(serviceUrl).port) || 5005;
  } catch {
    port = 5005;
  }

  const startScript = resolve(__dirname, '..', 'server', 'monai', 'start-service.sh');
  console.log(`🚀 Starting MONAI (cpu) on port ${port} via`, startScript);

  try {
    const child = spawn('bash', [startScript, 'cpu', String(port)], {
      cwd: resolve(__dirname, '..', 'server', 'monai'),
      detached: true,
      stdio: 'ignore',
    });
    child.unref();
  } catch (err) {
    console.warn('⚠️  Failed to spawn MONAI start script:', err?.message || err);
  }

  const maxAttempts = 20;
  for (let i = 1; i <= maxAttempts; i++) {
    await sleep(1000);
    const status = await checkHealth(serviceUrl, 1500);
    if (status && status.status === 'healthy') {
      console.log('✅ MONAI ready at', serviceUrl, `(mode: ${status.monai_service?.mode || 'unknown'})`);
      return;
    }
    if (i % 5 === 0) {
      console.log(`⏳ Waiting for MONAI... (${i}/${maxAttempts})`);
    }
  }

  console.warn('⚠️  MONAI did not become healthy in time. Dev server will still start.');
}

ensureMonai().catch(err => {
  console.warn('⚠️  ensure-monai error:', err?.message || err);
});
