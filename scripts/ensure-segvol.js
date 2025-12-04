#!/usr/bin/env node
// Ensures SegVol service is running locally for dev
// - Checks SEGVOL_SERVICE_URL (defaults to http://127.0.0.1:5002)
// - If unreachable and URL host is local, starts start-segvol.sh (cpu, derived port)

import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const DEFAULT_URL = 'http://127.0.0.1:5001';
const serviceUrl = process.env.SEGVOL_SERVICE_URL || DEFAULT_URL;

function isLocalHost(url) {
  try {
    const u = new URL(url);
    return (
      u.hostname === '127.0.0.1' ||
      u.hostname === 'localhost' ||
      u.hostname === '::1'
    );
  } catch {
    return true;
  }
}

async function checkHealth(url, timeoutMs = 2000) {
  try {
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), timeoutMs);
    const res = await fetch(new URL('/health', url), {
      method: 'GET',
      signal: controller.signal,
    });
    clearTimeout(t);
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function ensureSegVol() {
  const health = await checkHealth(serviceUrl, 1500);
  if (health && health.status === 'healthy') {
    console.log('🧠 SegVol already running at', serviceUrl);
    return;
  }

  if (!isLocalHost(serviceUrl)) {
    console.log('ℹ️  Skipping local SegVol start; remote service configured at', serviceUrl);
    return;
  }

  let port = 5001;
  try { port = Number(new URL(serviceUrl).port) || 5001; } catch {}

  const startScript = resolve(__dirname, '..', 'start-segvol.sh');
  console.log(`🚀 Starting SegVol (cpu) on port ${port} via`, startScript);

  try {
    const child = spawn('bash', [startScript, 'cpu', String(port)], {
      detached: true,
      stdio: 'ignore',
    });
    child.unref();
  } catch (err) {
    console.warn('⚠️  Failed to spawn SegVol start script:', err?.message || err);
  }

  // Poll until ready (max ~20s)
  const maxAttempts = 20;
  for (let i = 1; i <= maxAttempts; i++) {
    await sleep(1000);
    const h = await checkHealth(serviceUrl, 1500);
    if (h && h.status === 'healthy') {
      console.log('✅ SegVol ready at', serviceUrl, '(device:', h.device + ')');
      return;
    }
    if (i % 5 === 0) console.log(`⏳ Waiting for SegVol... (${i}/${maxAttempts})`);
  }

  console.warn('⚠️  SegVol did not become healthy in time. Dev server will still start.');
}

ensureSegVol().catch(err => {
  console.warn('⚠️  ensure-segvol error:', err?.message || err);
});




