/**
 * Regulatory Requirements Extractor
 * 
 * Scans the codebase and extracts software requirements from:
 * - Component files (tsx/ts)
 * - API routes
 * - Test files
 * 
 * Outputs: docs/regulatory/requirements.json and docs/regulatory/SRS.md
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface Requirement {
  id: string;
  title: string;
  description: string;
  category: string;
  riskClass: 'low' | 'medium' | 'high';
  sourceFile: string;
  sourceType: 'component' | 'api' | 'library' | 'test';
  relatedTests: string[];
  status: 'implemented' | 'verified' | 'pending';
  createdDate: string;
  lastModified: string;
}

interface RequirementsDatabase {
  version: string;
  generatedAt: string;
  totalRequirements: number;
  byCategory: Record<string, number>;
  byRisk: Record<string, number>;
  requirements: Requirement[];
}

// Category mapping based on file paths and names
const CATEGORY_MAPPINGS: Record<string, { category: string; prefix: string; riskClass: 'low' | 'medium' | 'high' }> = {
  'dvh': { category: 'Dose-Volume Histogram', prefix: 'DVH', riskClass: 'medium' },
  'rt-structure': { category: 'RT Structure Display', prefix: 'RTSTRUCT', riskClass: 'medium' },
  'rt-dose': { category: 'RT Dose Display', prefix: 'RTDOSE', riskClass: 'high' },
  'rt-plan': { category: 'RT Plan Display', prefix: 'RTPLAN', riskClass: 'high' },
  'fusion': { category: 'Image Fusion', prefix: 'FUSION', riskClass: 'medium' },
  'contour': { category: 'Contour Tools', prefix: 'CONTOUR', riskClass: 'medium' },
  'pen-tool': { category: 'Contour Tools', prefix: 'CONTOUR', riskClass: 'medium' },
  'brush': { category: 'Contour Tools', prefix: 'CONTOUR', riskClass: 'medium' },
  'margin': { category: 'Margin Operations', prefix: 'MARGIN', riskClass: 'medium' },
  'boolean': { category: 'Boolean Operations', prefix: 'BOOL', riskClass: 'medium' },
  'viewer': { category: 'Image Viewing', prefix: 'VIEW', riskClass: 'low' },
  'viewport': { category: 'Image Viewing', prefix: 'VIEW', riskClass: 'low' },
  'dicom': { category: 'DICOM Handling', prefix: 'DICOM', riskClass: 'low' },
  'upload': { category: 'Data Import', prefix: 'IMPORT', riskClass: 'low' },
  'import': { category: 'Data Import', prefix: 'IMPORT', riskClass: 'low' },
  'patient': { category: 'Patient Management', prefix: 'PATIENT', riskClass: 'low' },
  'series': { category: 'Series Management', prefix: 'SERIES', riskClass: 'low' },
  'measurement': { category: 'Measurements', prefix: 'MEAS', riskClass: 'medium' },
  'sam': { category: 'AI Segmentation', prefix: 'AI', riskClass: 'high' },
  'segvol': { category: 'AI Segmentation', prefix: 'AI', riskClass: 'high' },
  'mem3d': { category: 'AI Segmentation', prefix: 'AI', riskClass: 'high' },
  'prediction': { category: 'AI Segmentation', prefix: 'AI', riskClass: 'high' },
  'blob': { category: 'Structure Management', prefix: 'STRUCT', riskClass: 'medium' },
  'superstructure': { category: 'Structure Management', prefix: 'STRUCT', riskClass: 'medium' },
  'mpr': { category: 'Multi-Planar Reconstruction', prefix: 'MPR', riskClass: 'low' },
  'registration': { category: 'Image Registration', prefix: 'REG', riskClass: 'medium' },
  'storage': { category: 'Data Storage', prefix: 'STORAGE', riskClass: 'low' },
  'gif': { category: 'Media Export', prefix: 'EXPORT', riskClass: 'low' },
  'media': { category: 'Media Export', prefix: 'EXPORT', riskClass: 'low' },
};

function getFileStats(filePath: string): { created: string; modified: string } {
  try {
    const stats = fs.statSync(filePath);
    return {
      created: stats.birthtime.toISOString().split('T')[0],
      modified: stats.mtime.toISOString().split('T')[0],
    };
  } catch {
    const now = new Date().toISOString().split('T')[0];
    return { created: now, modified: now };
  }
}

function categorizeFile(fileName: string): { category: string; prefix: string; riskClass: 'low' | 'medium' | 'high' } {
  const lowerName = fileName.toLowerCase();
  
  for (const [pattern, mapping] of Object.entries(CATEGORY_MAPPINGS)) {
    if (lowerName.includes(pattern)) {
      return mapping;
    }
  }
  
  return { category: 'General', prefix: 'GEN', riskClass: 'low' };
}

function generateTitle(fileName: string): string {
  // Convert file name to human-readable title
  return fileName
    .replace(/\.tsx?$/, '')
    .replace(/-/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

function extractDescriptionFromFile(filePath: string): string {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    
    // Look for JSDoc comment at top of file
    const jsdocMatch = content.match(/\/\*\*[\s\S]*?\*\//);
    if (jsdocMatch) {
      const cleaned = jsdocMatch[0]
        .replace(/\/\*\*|\*\//g, '')
        .replace(/^\s*\*\s?/gm, '')
        .trim()
        .split('\n')[0]; // First line only
      if (cleaned && cleaned.length > 10) {
        return cleaned;
      }
    }
    
    // Look for component description in first comment
    const commentMatch = content.match(/\/\/\s*(.+)/);
    if (commentMatch) {
      return commentMatch[1].trim();
    }
    
    // Generate from exports
    const exportMatch = content.match(/export\s+(function|const|class)\s+(\w+)/);
    if (exportMatch) {
      return `Provides ${generateTitle(exportMatch[2])} functionality`;
    }
    
    return `Implements ${generateTitle(path.basename(filePath))} functionality`;
  } catch {
    return `Implements ${generateTitle(path.basename(filePath))} functionality`;
  }
}

function findRelatedTests(fileName: string, testFiles: string[]): string[] {
  const baseName = fileName.replace(/\.tsx?$/, '').toLowerCase();
  
  return testFiles.filter(testFile => {
    const testBaseName = testFile.toLowerCase();
    return testBaseName.includes(baseName) || 
           baseName.split('-').some(part => part.length > 3 && testBaseName.includes(part));
  });
}

function scanDirectory(dir: string, extension: string): string[] {
  const files: string[] = [];
  
  function scan(currentDir: string) {
    try {
      const entries = fs.readdirSync(currentDir, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = path.join(currentDir, entry.name);
        
        if (entry.isDirectory()) {
          // Skip certain directories
          if (!['node_modules', '.git', 'unused', 'backups', '__pycache__', '.ipynb_checkpoints'].includes(entry.name)) {
            scan(fullPath);
          }
        } else if (entry.isFile() && entry.name.endsWith(extension)) {
          files.push(fullPath);
        }
      }
    } catch (err) {
      // Skip directories we can't read
    }
  }
  
  scan(dir);
  return files;
}

function extractRequirements(rootDir: string): RequirementsDatabase {
  const requirements: Requirement[] = [];
  const counters: Record<string, number> = {};
  
  // Find all relevant files
  const componentFiles = [
    ...scanDirectory(path.join(rootDir, 'client/src/components'), '.tsx'),
    ...scanDirectory(path.join(rootDir, 'client/src/lib'), '.ts'),
  ];
  
  const apiFiles = scanDirectory(path.join(rootDir, 'server'), '.ts')
    .filter(f => f.includes('-api') || f.includes('routes'));
  
  const testFiles = [
    ...scanDirectory(rootDir, '.test.ts'),
    ...scanDirectory(rootDir, '.test.tsx'),
    ...scanDirectory(rootDir, '.spec.ts'),
  ].map(f => path.basename(f));
  
  // Process component files
  for (const file of componentFiles) {
    const fileName = path.basename(file);
    
    // Skip prototype/backup files for primary requirements
    if (fileName.includes('prototype') || fileName.includes('backup')) {
      continue;
    }
    
    const { category, prefix, riskClass } = categorizeFile(fileName);
    
    // Initialize counter for this prefix
    if (!counters[prefix]) {
      counters[prefix] = 1;
    }
    
    const id = `REQ-${prefix}-${String(counters[prefix]).padStart(3, '0')}`;
    counters[prefix]++;
    
    const stats = getFileStats(file);
    const relatedTests = findRelatedTests(fileName, testFiles);
    
    requirements.push({
      id,
      title: generateTitle(fileName),
      description: extractDescriptionFromFile(file),
      category,
      riskClass,
      sourceFile: path.relative(rootDir, file),
      sourceType: 'component',
      relatedTests,
      status: relatedTests.length > 0 ? 'verified' : 'implemented',
      createdDate: stats.created,
      lastModified: stats.modified,
    });
  }
  
  // Process API files
  for (const file of apiFiles) {
    const fileName = path.basename(file);
    const { category, prefix, riskClass } = categorizeFile(fileName);
    
    if (!counters[prefix]) {
      counters[prefix] = 1;
    }
    
    const id = `REQ-${prefix}-${String(counters[prefix]).padStart(3, '0')}`;
    counters[prefix]++;
    
    const stats = getFileStats(file);
    const relatedTests = findRelatedTests(fileName, testFiles);
    
    requirements.push({
      id,
      title: `${generateTitle(fileName)} API`,
      description: `Server-side API for ${category.toLowerCase()} operations`,
      category,
      riskClass,
      sourceFile: path.relative(rootDir, file),
      sourceType: 'api',
      relatedTests,
      status: relatedTests.length > 0 ? 'verified' : 'implemented',
      createdDate: stats.created,
      lastModified: stats.modified,
    });
  }
  
  // Calculate statistics
  const byCategory: Record<string, number> = {};
  const byRisk: Record<string, number> = {};
  
  for (const req of requirements) {
    byCategory[req.category] = (byCategory[req.category] || 0) + 1;
    byRisk[req.riskClass] = (byRisk[req.riskClass] || 0) + 1;
  }
  
  return {
    version: '1.0.0',
    generatedAt: new Date().toISOString(),
    totalRequirements: requirements.length,
    byCategory,
    byRisk,
    requirements: requirements.sort((a, b) => a.id.localeCompare(b.id)),
  };
}

function generateSRSMarkdown(db: RequirementsDatabase): string {
  const lines: string[] = [];
  
  lines.push('# Software Requirements Specification (SRS)');
  lines.push('');
  lines.push('## Document Information');
  lines.push('');
  lines.push('| Field | Value |');
  lines.push('|-------|-------|');
  lines.push(`| Document Version | ${db.version} |`);
  lines.push(`| Generated | ${db.generatedAt} |`);
  lines.push(`| Total Requirements | ${db.totalRequirements} |`);
  lines.push(`| Product Name | CONVERGE Medical Imaging Viewer |`);
  lines.push(`| Intended Use | Display and manipulation of medical imaging data |`);
  lines.push('');
  
  lines.push('## Risk Classification Summary');
  lines.push('');
  lines.push('| Risk Level | Count | Percentage |');
  lines.push('|------------|-------|------------|');
  for (const [risk, count] of Object.entries(db.byRisk).sort()) {
    const pct = ((count / db.totalRequirements) * 100).toFixed(1);
    lines.push(`| ${risk.charAt(0).toUpperCase() + risk.slice(1)} | ${count} | ${pct}% |`);
  }
  lines.push('');
  
  lines.push('## Requirements by Category');
  lines.push('');
  
  // Group requirements by category
  const byCategory = new Map<string, Requirement[]>();
  for (const req of db.requirements) {
    if (!byCategory.has(req.category)) {
      byCategory.set(req.category, []);
    }
    byCategory.get(req.category)!.push(req);
  }
  
  for (const [category, reqs] of Array.from(byCategory.entries()).sort()) {
    lines.push(`### ${category}`);
    lines.push('');
    lines.push('| ID | Title | Risk | Status | Tests |');
    lines.push('|----|-------|------|--------|-------|');
    
    for (const req of reqs) {
      const riskBadge = req.riskClass === 'high' ? '🔴 High' : 
                        req.riskClass === 'medium' ? '🟡 Medium' : '🟢 Low';
      const statusBadge = req.status === 'verified' ? '✅' : 
                          req.status === 'implemented' ? '🔧' : '⏳';
      const testCount = req.relatedTests.length > 0 ? `${req.relatedTests.length}` : '-';
      
      lines.push(`| ${req.id} | ${req.title} | ${riskBadge} | ${statusBadge} | ${testCount} |`);
    }
    lines.push('');
  }
  
  lines.push('## Detailed Requirements');
  lines.push('');
  
  for (const req of db.requirements) {
    lines.push(`### ${req.id}: ${req.title}`);
    lines.push('');
    lines.push(`**Category:** ${req.category}`);
    lines.push('');
    lines.push(`**Risk Classification:** ${req.riskClass}`);
    lines.push('');
    lines.push(`**Description:** ${req.description}`);
    lines.push('');
    lines.push(`**Source:** \`${req.sourceFile}\``);
    lines.push('');
    lines.push(`**Status:** ${req.status}`);
    lines.push('');
    if (req.relatedTests.length > 0) {
      lines.push(`**Verification:** ${req.relatedTests.join(', ')}`);
      lines.push('');
    }
    lines.push(`**Created:** ${req.createdDate} | **Modified:** ${req.lastModified}`);
    lines.push('');
    lines.push('---');
    lines.push('');
  }
  
  lines.push('## Legend');
  lines.push('');
  lines.push('- 🔴 **High Risk**: Features that directly affect clinical decisions or patient safety');
  lines.push('- 🟡 **Medium Risk**: Features that modify or transform medical data');
  lines.push('- 🟢 **Low Risk**: Display-only features with no data modification');
  lines.push('- ✅ **Verified**: Has associated test coverage');
  lines.push('- 🔧 **Implemented**: Code complete, tests pending');
  lines.push('- ⏳ **Pending**: Not yet implemented');
  lines.push('');
  
  return lines.join('\n');
}

// Main execution
const rootDir = path.resolve(__dirname, '../..');
console.log('🔍 Extracting requirements from codebase...');
console.log(`   Root directory: ${rootDir}`);

const db = extractRequirements(rootDir);

// Write JSON
const jsonPath = path.join(rootDir, 'docs/regulatory/requirements.json');
fs.writeFileSync(jsonPath, JSON.stringify(db, null, 2));
console.log(`✅ Written: ${jsonPath}`);

// Write Markdown
const mdPath = path.join(rootDir, 'docs/regulatory/SRS.md');
fs.writeFileSync(mdPath, generateSRSMarkdown(db));
console.log(`✅ Written: ${mdPath}`);

console.log('');
console.log(`📊 Summary:`);
console.log(`   Total requirements: ${db.totalRequirements}`);
console.log(`   Categories: ${Object.keys(db.byCategory).length}`);
console.log(`   High risk: ${db.byRisk.high || 0}`);
console.log(`   Medium risk: ${db.byRisk.medium || 0}`);
console.log(`   Low risk: ${db.byRisk.low || 0}`);
