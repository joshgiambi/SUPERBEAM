/**
 * Regulatory Traceability Matrix Generator
 * 
 * Creates a full traceability matrix linking:
 * - Requirements → Design → Implementation → Verification
 * 
 * Outputs: docs/regulatory/TRACEABILITY_MATRIX.md
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface RequirementsDB {
  requirements: Array<{
    id: string;
    title: string;
    description: string;
    category: string;
    riskClass: string;
    sourceFile: string;
    sourceType: string;
    relatedTests: string[];
    status: string;
    createdDate: string;
    lastModified: string;
  }>;
  byCategory: Record<string, number>;
}

interface ChangeControlDB {
  commits: Array<{
    shortHash: string;
    date: string;
    subject: string;
    affectedCategories: string[];
    changeType: string;
  }>;
}

interface TraceabilityEntry {
  requirementId: string;
  title: string;
  category: string;
  riskClass: string;
  designRef: string;
  implementationRef: string;
  verificationRef: string;
  validationStatus: 'complete' | 'partial' | 'pending';
  relatedChanges: string[];
}

function loadJSON<T>(filePath: string): T | null {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(content) as T;
  } catch {
    return null;
  }
}

function extractDesignRef(sourceFile: string): string {
  // Convert source file to design reference
  const fileName = path.basename(sourceFile);
  return `DES-${fileName.replace(/\.[^/.]+$/, '').toUpperCase().replace(/-/g, '_')}`;
}

function generateTraceabilityMatrix(rootDir: string): TraceabilityEntry[] {
  const requirementsPath = path.join(rootDir, 'docs/regulatory/requirements.json');
  const changeControlPath = path.join(rootDir, 'docs/regulatory/change-control.json');
  
  const requirements = loadJSON<RequirementsDB>(requirementsPath);
  const changeControl = loadJSON<ChangeControlDB>(changeControlPath);
  
  if (!requirements) {
    console.error('❌ Requirements database not found. Run extract-requirements.ts first.');
    return [];
  }
  
  const entries: TraceabilityEntry[] = [];
  
  for (const req of requirements.requirements) {
    // Find related changes
    const relatedChanges: string[] = [];
    
    if (changeControl) {
      for (const commit of changeControl.commits) {
        // Check if commit affects this requirement's category
        const reqCategoryLower = req.category.toLowerCase();
        const commitCats = commit.affectedCategories.map(c => c.toLowerCase());
        
        if (commitCats.some(cat => 
          reqCategoryLower.includes(cat.split('/')[0]) || 
          cat.includes(reqCategoryLower.split(' ')[0])
        )) {
          relatedChanges.push(commit.shortHash);
        }
      }
    }
    
    // Determine validation status
    let validationStatus: 'complete' | 'partial' | 'pending' = 'pending';
    if (req.relatedTests.length > 0 && req.status === 'verified') {
      validationStatus = 'complete';
    } else if (req.status === 'implemented') {
      validationStatus = 'partial';
    }
    
    entries.push({
      requirementId: req.id,
      title: req.title,
      category: req.category,
      riskClass: req.riskClass,
      designRef: extractDesignRef(req.sourceFile),
      implementationRef: req.sourceFile,
      verificationRef: req.relatedTests.length > 0 
        ? req.relatedTests.join(', ') 
        : 'Pending',
      validationStatus,
      relatedChanges: relatedChanges.slice(0, 5), // Limit to 5 most recent
    });
  }
  
  return entries;
}

function generateTraceabilityMarkdown(entries: TraceabilityEntry[]): string {
  const lines: string[] = [];
  
  lines.push('# Traceability Matrix');
  lines.push('');
  lines.push('## Document Information');
  lines.push('');
  lines.push('| Field | Value |');
  lines.push('|-------|-------|');
  lines.push(`| Document Version | 1.0.0 |`);
  lines.push(`| Generated | ${new Date().toISOString()} |`);
  lines.push(`| Total Entries | ${entries.length} |`);
  lines.push(`| Complete | ${entries.filter(e => e.validationStatus === 'complete').length} |`);
  lines.push(`| Partial | ${entries.filter(e => e.validationStatus === 'partial').length} |`);
  lines.push(`| Pending | ${entries.filter(e => e.validationStatus === 'pending').length} |`);
  lines.push('');
  
  lines.push('## Coverage Summary');
  lines.push('');
  
  // Calculate coverage by category
  const byCategory = new Map<string, { total: number; complete: number; partial: number }>();
  for (const entry of entries) {
    if (!byCategory.has(entry.category)) {
      byCategory.set(entry.category, { total: 0, complete: 0, partial: 0 });
    }
    const cat = byCategory.get(entry.category)!;
    cat.total++;
    if (entry.validationStatus === 'complete') cat.complete++;
    if (entry.validationStatus === 'partial') cat.partial++;
  }
  
  lines.push('| Category | Total | Complete | Partial | Coverage |');
  lines.push('|----------|-------|----------|---------|----------|');
  
  for (const [category, stats] of Array.from(byCategory.entries()).sort()) {
    const coverage = ((stats.complete / stats.total) * 100).toFixed(0);
    const bar = '█'.repeat(Math.floor(stats.complete / stats.total * 10)) + 
                '░'.repeat(10 - Math.floor(stats.complete / stats.total * 10));
    lines.push(`| ${category} | ${stats.total} | ${stats.complete} | ${stats.partial} | ${bar} ${coverage}% |`);
  }
  lines.push('');
  
  lines.push('## Risk Coverage');
  lines.push('');
  
  const byRisk = new Map<string, { total: number; complete: number }>();
  for (const entry of entries) {
    if (!byRisk.has(entry.riskClass)) {
      byRisk.set(entry.riskClass, { total: 0, complete: 0 });
    }
    const risk = byRisk.get(entry.riskClass)!;
    risk.total++;
    if (entry.validationStatus === 'complete') risk.complete++;
  }
  
  lines.push('| Risk Level | Total | Verified | Status |');
  lines.push('|------------|-------|----------|--------|');
  
  const riskOrder = ['high', 'medium', 'low'];
  for (const riskLevel of riskOrder) {
    const stats = byRisk.get(riskLevel);
    if (stats) {
      const pct = ((stats.complete / stats.total) * 100).toFixed(0);
      const icon = riskLevel === 'high' ? '🔴' : riskLevel === 'medium' ? '🟡' : '🟢';
      const status = stats.complete === stats.total ? '✅ Complete' : 
                     stats.complete > 0 ? '⚠️ In Progress' : '❌ Not Started';
      lines.push(`| ${icon} ${riskLevel.charAt(0).toUpperCase() + riskLevel.slice(1)} | ${stats.total} | ${stats.complete} (${pct}%) | ${status} |`);
    }
  }
  lines.push('');
  
  lines.push('## Full Traceability Matrix');
  lines.push('');
  lines.push('| Requirement | Design | Implementation | Verification | Status |');
  lines.push('|-------------|--------|----------------|--------------|--------|');
  
  for (const entry of entries) {
    const statusIcon = entry.validationStatus === 'complete' ? '✅' : 
                       entry.validationStatus === 'partial' ? '🔧' : '⏳';
    const implFile = entry.implementationRef.split('/').pop() || entry.implementationRef;
    
    lines.push(`| ${entry.requirementId} | ${entry.designRef} | \`${implFile}\` | ${entry.verificationRef === 'Pending' ? '⏳' : '✅'} | ${statusIcon} |`);
  }
  lines.push('');
  
  lines.push('## Detailed Traceability');
  lines.push('');
  
  // Group by category
  const grouped = new Map<string, TraceabilityEntry[]>();
  for (const entry of entries) {
    if (!grouped.has(entry.category)) {
      grouped.set(entry.category, []);
    }
    grouped.get(entry.category)!.push(entry);
  }
  
  for (const [category, categoryEntries] of Array.from(grouped.entries()).sort()) {
    lines.push(`### ${category}`);
    lines.push('');
    
    for (const entry of categoryEntries) {
      const riskIcon = entry.riskClass === 'high' ? '🔴' : 
                       entry.riskClass === 'medium' ? '🟡' : '🟢';
      const statusIcon = entry.validationStatus === 'complete' ? '✅ Verified' : 
                         entry.validationStatus === 'partial' ? '🔧 Implemented' : '⏳ Pending';
      
      lines.push(`#### ${entry.requirementId}: ${entry.title}`);
      lines.push('');
      lines.push(`| Aspect | Reference |`);
      lines.push(`|--------|-----------|`);
      lines.push(`| **Risk** | ${riskIcon} ${entry.riskClass} |`);
      lines.push(`| **Design** | ${entry.designRef} |`);
      lines.push(`| **Implementation** | \`${entry.implementationRef}\` |`);
      lines.push(`| **Verification** | ${entry.verificationRef} |`);
      lines.push(`| **Status** | ${statusIcon} |`);
      
      if (entry.relatedChanges.length > 0) {
        lines.push(`| **Change History** | ${entry.relatedChanges.map(h => `\`${h}\``).join(', ')} |`);
      }
      lines.push('');
    }
  }
  
  lines.push('## Legend');
  lines.push('');
  lines.push('### Risk Levels');
  lines.push('- 🔴 **High**: Direct impact on clinical decisions');
  lines.push('- 🟡 **Medium**: Modifies or transforms medical data');
  lines.push('- 🟢 **Low**: Display-only functionality');
  lines.push('');
  lines.push('### Validation Status');
  lines.push('- ✅ **Complete**: Requirement has passing tests');
  lines.push('- 🔧 **Partial**: Code implemented, tests pending');
  lines.push('- ⏳ **Pending**: Not yet implemented');
  lines.push('');
  
  return lines.join('\n');
}

function generateVerificationSummary(entries: TraceabilityEntry[], rootDir: string): string {
  const lines: string[] = [];
  
  lines.push('# Verification Summary Report');
  lines.push('');
  lines.push('## Executive Summary');
  lines.push('');
  
  const total = entries.length;
  const complete = entries.filter(e => e.validationStatus === 'complete').length;
  const partial = entries.filter(e => e.validationStatus === 'partial').length;
  const pending = entries.filter(e => e.validationStatus === 'pending').length;
  
  const completePct = ((complete / total) * 100).toFixed(1);
  const partialPct = ((partial / total) * 100).toFixed(1);
  
  lines.push(`| Metric | Value |`);
  lines.push(`|--------|-------|`);
  lines.push(`| Total Requirements | ${total} |`);
  lines.push(`| Verified (with tests) | ${complete} (${completePct}%) |`);
  lines.push(`| Implemented (no tests) | ${partial} (${partialPct}%) |`);
  lines.push(`| Pending | ${pending} |`);
  lines.push(`| Overall Coverage | ${completePct}% |`);
  lines.push('');
  
  // High risk coverage
  const highRisk = entries.filter(e => e.riskClass === 'high');
  const highRiskVerified = highRisk.filter(e => e.validationStatus === 'complete');
  
  lines.push('## High-Risk Item Coverage');
  lines.push('');
  lines.push(`**Critical:** ${highRiskVerified.length}/${highRisk.length} high-risk items have test coverage.`);
  lines.push('');
  
  if (highRisk.length > 0) {
    lines.push('| ID | Title | Status |');
    lines.push('|----|-------|--------|');
    
    for (const entry of highRisk) {
      const status = entry.validationStatus === 'complete' ? '✅ Verified' : '⚠️ Needs Tests';
      lines.push(`| ${entry.requirementId} | ${entry.title} | ${status} |`);
    }
    lines.push('');
  }
  
  lines.push('## Test File Inventory');
  lines.push('');
  
  // Find all test files
  const testDir = path.join(rootDir, 'client/src/lib/__tests__');
  let testFiles: string[] = [];
  
  try {
    if (fs.existsSync(testDir)) {
      testFiles = fs.readdirSync(testDir).filter(f => f.endsWith('.test.ts') || f.endsWith('.test.tsx'));
    }
  } catch {
    // Ignore errors
  }
  
  if (testFiles.length > 0) {
    lines.push('| Test File | Requirements Covered |');
    lines.push('|-----------|---------------------|');
    
    for (const testFile of testFiles) {
      const covered = entries.filter(e => e.verificationRef && e.verificationRef.includes(testFile)).map(e => e.requirementId);
      lines.push(`| \`${testFile}\` | ${covered.length > 0 ? covered.join(', ') : 'General coverage'} |`);
    }
  } else {
    lines.push('*No dedicated test files found. Test coverage is inferred from file naming conventions.*');
  }
  lines.push('');
  
  lines.push('## Recommendations');
  lines.push('');
  lines.push('### Priority 1: High-Risk Items Without Tests');
  lines.push('');
  
  const highRiskNoTests = highRisk.filter(e => e.validationStatus !== 'complete');
  if (highRiskNoTests.length > 0) {
    for (const entry of highRiskNoTests) {
      lines.push(`- [ ] Add tests for **${entry.requirementId}**: ${entry.title}`);
    }
  } else {
    lines.push('*All high-risk items have test coverage.*');
  }
  lines.push('');
  
  lines.push('### Priority 2: Medium-Risk Items Without Tests');
  lines.push('');
  
  const mediumRiskNoTests = entries.filter(e => e.riskClass === 'medium' && e.validationStatus !== 'complete');
  if (mediumRiskNoTests.length > 0) {
    for (const entry of mediumRiskNoTests.slice(0, 10)) {
      lines.push(`- [ ] Add tests for **${entry.requirementId}**: ${entry.title}`);
    }
    if (mediumRiskNoTests.length > 10) {
      lines.push(`- ... and ${mediumRiskNoTests.length - 10} more`);
    }
  } else {
    lines.push('*All medium-risk items have test coverage.*');
  }
  lines.push('');
  
  lines.push('## Certification Readiness');
  lines.push('');
  
  const readinessScore = (complete / total) * 100;
  let readinessStatus: string;
  let readinessIcon: string;
  
  if (readinessScore >= 90) {
    readinessStatus = 'Ready for submission';
    readinessIcon = '🟢';
  } else if (readinessScore >= 70) {
    readinessStatus = 'Nearly ready - address high-risk gaps';
    readinessIcon = '🟡';
  } else if (readinessScore >= 50) {
    readinessStatus = 'In progress - significant work remaining';
    readinessIcon = '🟠';
  } else {
    readinessStatus = 'Early stage - focus on test infrastructure';
    readinessIcon = '🔴';
  }
  
  lines.push(`**Overall Readiness:** ${readinessIcon} ${readinessStatus}`);
  lines.push('');
  lines.push(`**Score:** ${readinessScore.toFixed(0)}%`);
  lines.push('');
  
  return lines.join('\n');
}

// Main execution
const rootDir = path.resolve(__dirname, '../..');
console.log('🔍 Generating traceability matrix...');
console.log(`   Root directory: ${rootDir}`);

const entries = generateTraceabilityMatrix(rootDir);

if (entries.length === 0) {
  console.error('No entries generated. Ensure requirements.json exists.');
  process.exit(1);
}

// Write traceability matrix
const matrixPath = path.join(rootDir, 'docs/regulatory/TRACEABILITY_MATRIX.md');
fs.writeFileSync(matrixPath, generateTraceabilityMarkdown(entries));
console.log(`✅ Written: ${matrixPath}`);

// Write verification summary
const verificationPath = path.join(rootDir, 'docs/regulatory/VERIFICATION_SUMMARY.md');
fs.writeFileSync(verificationPath, generateVerificationSummary(entries, rootDir));
console.log(`✅ Written: ${verificationPath}`);

// Write JSON for frontend
const jsonPath = path.join(rootDir, 'docs/regulatory/traceability.json');
fs.writeFileSync(jsonPath, JSON.stringify({ 
  generatedAt: new Date().toISOString(),
  entries 
}, null, 2));
console.log(`✅ Written: ${jsonPath}`);

console.log('');
console.log(`📊 Summary:`);
console.log(`   Total entries: ${entries.length}`);
console.log(`   Complete: ${entries.filter(e => e.validationStatus === 'complete').length}`);
console.log(`   Partial: ${entries.filter(e => e.validationStatus === 'partial').length}`);
console.log(`   Pending: ${entries.filter(e => e.validationStatus === 'pending').length}`);
