#!/usr/bin/env node
/**
 * Download SAM ONNX models for local serving
 * 
 * This downloads the SAM ViT-B models from HuggingFace and stores them
 * in client/public/sam/ for local serving without external dependencies.
 * 
 * Usage: node scripts/download-sam-models.js
 */

import fs from 'fs';
import path from 'path';
import https from 'https';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..');

const MODELS = {
  'sam_b': {
    encoder: {
      url: 'https://huggingface.co/schmuell/sam-b-fp16/resolve/main/sam_vit_b_01ec64.encoder-fp16.onnx',
      filename: 'sam_vit_b_encoder.onnx',
      size: '~180MB',
    },
    decoder: {
      url: 'https://huggingface.co/schmuell/sam-b-fp16/resolve/main/sam_vit_b_01ec64.decoder.onnx',
      filename: 'sam_vit_b_decoder.onnx',
      size: '~17MB',
    },
  },
};

const SAM_DIR = path.join(projectRoot, 'client', 'public', 'sam');

async function downloadFile(url, destPath, description) {
  return new Promise((resolve, reject) => {
    console.log(`📥 Downloading ${description}...`);
    console.log(`   URL: ${url}`);
    console.log(`   Destination: ${destPath}`);

    // Check if file already exists
    if (fs.existsSync(destPath)) {
      const stats = fs.statSync(destPath);
      console.log(`   ✅ Already exists (${(stats.size / 1024 / 1024).toFixed(1)}MB)`);
      resolve();
      return;
    }

    const file = fs.createWriteStream(destPath);
    let downloadedBytes = 0;
    let totalBytes = 0;
    let lastProgress = 0;

    const request = https.get(url, { 
      headers: { 
        'User-Agent': 'Mozilla/5.0 (compatible; SAM-Model-Downloader/1.0)'
      }
    }, (response) => {
      // Handle redirects
      if (response.statusCode === 301 || response.statusCode === 302) {
        file.close();
        fs.unlinkSync(destPath);
        console.log(`   ↪️ Redirecting...`);
        downloadFile(response.headers.location, destPath, description)
          .then(resolve)
          .catch(reject);
        return;
      }

      if (response.statusCode !== 200) {
        file.close();
        fs.unlinkSync(destPath);
        reject(new Error(`HTTP ${response.statusCode}: ${response.statusMessage}`));
        return;
      }

      totalBytes = parseInt(response.headers['content-length'], 10) || 0;

      response.on('data', (chunk) => {
        downloadedBytes += chunk.length;
        if (totalBytes > 0) {
          const progress = Math.floor((downloadedBytes / totalBytes) * 100);
          if (progress >= lastProgress + 10) {
            lastProgress = progress;
            console.log(`   📊 ${progress}% (${(downloadedBytes / 1024 / 1024).toFixed(1)}MB / ${(totalBytes / 1024 / 1024).toFixed(1)}MB)`);
          }
        }
      });

      response.pipe(file);

      file.on('finish', () => {
        file.close();
        const finalSize = fs.statSync(destPath).size;
        console.log(`   ✅ Complete: ${(finalSize / 1024 / 1024).toFixed(1)}MB`);
        resolve();
      });
    });

    request.on('error', (err) => {
      file.close();
      if (fs.existsSync(destPath)) {
        fs.unlinkSync(destPath);
      }
      reject(err);
    });

    // Timeout after 5 minutes
    request.setTimeout(300000, () => {
      request.destroy();
      file.close();
      if (fs.existsSync(destPath)) {
        fs.unlinkSync(destPath);
      }
      reject(new Error('Download timeout (5 minutes)'));
    });
  });
}

async function main() {
  console.log('🧠 SAM Model Downloader');
  console.log('========================\n');

  // Create SAM directory
  if (!fs.existsSync(SAM_DIR)) {
    fs.mkdirSync(SAM_DIR, { recursive: true });
    console.log(`📁 Created directory: ${SAM_DIR}\n`);
  }

  const modelConfig = MODELS['sam_b'];

  try {
    // Download encoder
    await downloadFile(
      modelConfig.encoder.url,
      path.join(SAM_DIR, modelConfig.encoder.filename),
      `SAM Encoder (${modelConfig.encoder.size})`
    );

    console.log('');

    // Download decoder
    await downloadFile(
      modelConfig.decoder.url,
      path.join(SAM_DIR, modelConfig.decoder.filename),
      `SAM Decoder (${modelConfig.decoder.size})`
    );

    console.log('\n✅ All SAM models downloaded successfully!');
    console.log(`\n📍 Models location: ${SAM_DIR}`);
    console.log('\nThe viewer will now use local models instead of HuggingFace.');

  } catch (error) {
    console.error('\n❌ Download failed:', error.message);
    console.error('\nYou can try downloading manually:');
    console.error(`  1. Download: ${modelConfig.encoder.url}`);
    console.error(`     Save to: ${path.join(SAM_DIR, modelConfig.encoder.filename)}`);
    console.error(`  2. Download: ${modelConfig.decoder.url}`);
    console.error(`     Save to: ${path.join(SAM_DIR, modelConfig.decoder.filename)}`);
    process.exit(1);
  }
}

main();


