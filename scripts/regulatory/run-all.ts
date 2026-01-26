/**
 * Regulatory Documentation Generator
 * 
 * Master script that runs all extraction and generation scripts
 * to produce a complete regulatory documentation package.
 * 
 * Usage: npx tsx scripts/regulatory/run-all.ts
 */

import { execSync } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const rootDir = path.resolve(__dirname, '../..');
const scriptsDir = __dirname;

console.log('═══════════════════════════════════════════════════════════════');
console.log('           CONVERGE Regulatory Documentation Generator          ');
console.log('═══════════════════════════════════════════════════════════════');
console.log('');

// Ensure output directory exists
const outputDir = path.join(rootDir, 'docs/regulatory');
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

const scripts = [
  { name: 'Requirements Extraction', file: 'extract-requirements.ts' },
  { name: 'Change Control Extraction', file: 'extract-commits.ts' },
  { name: 'Traceability Matrix Generation', file: 'generate-traceability.ts' },
];

let hasErrors = false;

for (const script of scripts) {
  console.log(`\n▶ Running: ${script.name}`);
  console.log('─'.repeat(60));
  
  try {
    const output = execSync(`npx tsx ${path.join(scriptsDir, script.file)}`, {
      cwd: rootDir,
      encoding: 'utf-8',
      stdio: 'pipe',
    });
    console.log(output);
  } catch (err: any) {
    console.error(`❌ Error running ${script.name}:`);
    console.error(err.stdout || err.message);
    hasErrors = true;
  }
}

// Generate index file
console.log('\n▶ Generating Documentation Index');
console.log('─'.repeat(60));

const indexContent = `# Regulatory Documentation Package

## CONVERGE Medical Imaging Viewer

**Generated:** ${new Date().toISOString()}

---

## Document Index

| Document | Description | Status |
|----------|-------------|--------|
| [SRS.md](./SRS.md) | Software Requirements Specification | ✅ Generated |
| [CHANGE_CONTROL.md](./CHANGE_CONTROL.md) | Change Control Log | ✅ Generated |
| [TRACEABILITY_MATRIX.md](./TRACEABILITY_MATRIX.md) | Requirements Traceability | ✅ Generated |
| [VERIFICATION_SUMMARY.md](./VERIFICATION_SUMMARY.md) | Test Coverage Report | ✅ Generated |

## Data Files

| File | Description |
|------|-------------|
| [requirements.json](./requirements.json) | Machine-readable requirements database |
| [change-control.json](./change-control.json) | Machine-readable change history |
| [traceability.json](./traceability.json) | Machine-readable traceability data |

---

## Intended Use Statement

CONVERGE Medical Imaging Viewer is intended to display medical imaging data 
including DICOM CT, MR, PET images, RT Structure Sets, RT Dose distributions, 
and RT Plans for review by qualified healthcare professionals.

## Regulatory Classification

This software is intended to be classified as a **Class II Medical Device** 
under FDA 21 CFR 892.2050 (Picture archiving and communications system) 
requiring 510(k) premarket notification.

## Quality Management

This documentation is automatically generated from the codebase to ensure 
accuracy and traceability. The generation scripts are located in 
\`scripts/regulatory/\` and can be run at any time to update documentation.

### Regenerating Documentation

\`\`\`bash
npx tsx scripts/regulatory/run-all.ts
\`\`\`

---

*This is a living document. Last updated: ${new Date().toLocaleString()}*
`;

fs.writeFileSync(path.join(outputDir, 'README.md'), indexContent);
console.log(`✅ Written: docs/regulatory/README.md`);

// Summary
console.log('\n═══════════════════════════════════════════════════════════════');
console.log('                      Generation Complete                        ');
console.log('═══════════════════════════════════════════════════════════════');
console.log('');
console.log('Generated files:');

const generatedFiles = fs.readdirSync(outputDir);
for (const file of generatedFiles.sort()) {
  const stats = fs.statSync(path.join(outputDir, file));
  const size = (stats.size / 1024).toFixed(1);
  console.log(`  📄 ${file} (${size} KB)`);
}

console.log('');
if (hasErrors) {
  console.log('⚠️  Some scripts had errors. Check output above.');
  process.exit(1);
} else {
  console.log('✅ All documentation generated successfully!');
  console.log('');
  console.log('Next steps:');
  console.log('  1. Review generated markdown files in docs/regulatory/');
  console.log('  2. Access the regulatory dashboard at /regulatory (when server is running)');
  console.log('  3. Run tests to improve verification coverage');
}
