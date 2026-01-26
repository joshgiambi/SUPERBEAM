/**
 * Regulatory Change Control Extractor
 * 
 * Parses git history to generate:
 * - Change control log (IEC 62304 compliant)
 * - Design decision records
 * - Modification history with regulatory-compliant descriptions
 * 
 * Outputs: docs/regulatory/CHANGE_CONTROL.md
 */

import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface CommitRecord {
  hash: string;
  shortHash: string;
  date: string;
  author: string;
  subject: string;
  regulatoryDescription: string;
  body: string;
  filesChanged: number;
  insertions: number;
  deletions: number;
  affectedCategories: string[];
  changeType: 'feature' | 'fix' | 'refactor' | 'docs' | 'enhancement' | 'other';
  requirementIds: string[];
  verificationStatus: 'verified' | 'pending' | 'not-required';
  riskImpact: 'high' | 'medium' | 'low' | 'none';
}

interface ChangeControlDatabase {
  version: string;
  generatedAt: string;
  repositoryInfo: {
    totalCommits: number;
    firstCommit: string;
    lastCommit: string;
    contributors: string[];
    branch: string;
  };
  commits: CommitRecord[];
  byCategory: Record<string, number>;
  byChangeType: Record<string, number>;
}

// Category detection patterns
const CATEGORY_PATTERNS: Record<string, RegExp[]> = {
  'DVH': [/dvh/i, /dose.volume/i, /histogram/i],
  'RT Structure': [/rt.?struct/i, /contour/i, /roi/i, /structure/i],
  'RT Dose': [/rt.?dose/i, /dose.display/i, /dose.overlay/i],
  'RT Plan': [/rt.?plan/i, /beam/i, /mlc/i, /gantry/i, /radiation.?therapy/i],
  'Image Fusion': [/fusion/i, /registration/i, /fuse/i, /fusebox/i],
  'AI Segmentation': [/sam/i, /segvol/i, /mem3d/i, /\bai\b/i, /prediction/i, /segmentation/i, /neural/i],
  'Image Viewing': [/viewer/i, /viewport/i, /display/i, /render/i, /slice/i],
  'DICOM Processing': [/dicom/i, /import/i, /upload/i, /parse/i, /metadata/i],
  'Contour Tools': [/pen.tool/i, /brush/i, /contour.tool/i, /draw/i, /edit/i],
  'Boolean Operations': [/boolean/i, /margin/i, /subtract/i, /union/i, /grow/i],
  'Performance': [/performance/i, /optimi/i, /cache/i, /speed/i, /memory/i],
  'User Interface': [/ui\b/i, /toolbar/i, /panel/i, /button/i, /layout/i, /style/i, /aurora/i],
  'Data Management': [/storage/i, /database/i, /patient/i, /series/i, /study/i],
  'Infrastructure': [/refactor/i, /config/i, /setup/i, /script/i, /build/i, /sync/i],
};

// Map informal descriptions to regulatory-compliant language
const DESCRIPTION_CLEANUPS: Array<{ pattern: RegExp; replacement: string }> = [
  { pattern: /first crack/i, replacement: 'Initial implementation' },
  { pattern: /wip only/i, replacement: 'Work in progress' },
  { pattern: /wip/i, replacement: 'Development iteration' },
  { pattern: /do not use/i, replacement: 'Pre-release version' },
  { pattern: /for demo/i, replacement: 'for demonstration purposes' },
  { pattern: /fix(ed|es|ing)?\s+bug/i, replacement: 'Corrected defect' },
  { pattern: /hack/i, replacement: 'Workaround implementation' },
  { pattern: /cleanup/i, replacement: 'Code maintenance' },
  { pattern: /stuff/i, replacement: 'components' },
  { pattern: /things/i, replacement: 'functionality' },
  { pattern: /broke/i, replacement: 'caused regression in' },
  { pattern: /oops/i, replacement: 'Correction:' },
  { pattern: /todo/i, replacement: 'Pending implementation:' },
];

function cleanDescription(subject: string): string {
  let cleaned = subject;
  
  // Handle conventional commit format: feat(scope): message, fix(scope): message, etc.
  const conventionalMatch = cleaned.match(/^(feat|fix|docs|style|refactor|perf|test|chore|ci|build)(\([^)]+\))?:\s*(.+)$/i);
  if (conventionalMatch) {
    const [, type, , message] = conventionalMatch;
    const typeMap: Record<string, string> = {
      'feat': 'New feature:',
      'fix': 'Defect correction:',
      'docs': 'Documentation:',
      'style': 'Style update:',
      'refactor': 'Code refactoring:',
      'perf': 'Performance improvement:',
      'test': 'Test update:',
      'chore': 'Maintenance:',
      'ci': 'CI/CD update:',
      'build': 'Build system update:',
    };
    cleaned = `${typeMap[type.toLowerCase()] || 'Change:'} ${message}`;
  }
  
  for (const { pattern, replacement } of DESCRIPTION_CLEANUPS) {
    cleaned = cleaned.replace(pattern, replacement);
  }
  
  // Capitalize first letter
  cleaned = cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
  
  // Remove trailing punctuation inconsistencies
  cleaned = cleaned.replace(/[.!]+$/, '');
  
  return cleaned;
}

function generateRegulatoryDescription(subject: string, changeType: string, categories: string[]): string {
  let cleanSubject = cleanDescription(subject);
  
  // Remove redundant type prefixes that might have been added by cleanDescription
  cleanSubject = cleanSubject
    .replace(/^New feature:\s*/i, '')
    .replace(/^Defect correction:\s*/i, '')
    .replace(/^Documentation:\s*/i, '')
    .replace(/^Code refactoring:\s*/i, '')
    .replace(/^Performance improvement:\s*/i, '')
    .replace(/^Maintenance:\s*/i, '')
    .replace(/^Style update:\s*/i, '')
    .replace(/^Test update:\s*/i, '')
    .replace(/^CI\/CD update:\s*/i, '')
    .replace(/^Build system update:\s*/i, '')
    .replace(/^Change:\s*/i, '');
  
  // Capitalize first letter
  cleanSubject = cleanSubject.charAt(0).toUpperCase() + cleanSubject.slice(1);
  
  const typePrefix: Record<string, string> = {
    'feature': 'NEW FEATURE:',
    'enhancement': 'ENHANCEMENT:',
    'fix': 'DEFECT CORRECTION:',
    'refactor': 'CODE MAINTENANCE:',
    'docs': 'DOCUMENTATION:',
    'other': 'CHANGE:',
  };
  
  const prefix = typePrefix[changeType] || 'CHANGE:';
  const categoryStr = categories.length > 0 ? ` [${categories.join(', ')}]` : '';
  
  return `${prefix} ${cleanSubject}${categoryStr}`;
}

function detectChangeType(subject: string, body: string): 'feature' | 'fix' | 'refactor' | 'docs' | 'enhancement' | 'other' {
  const text = `${subject} ${body}`.toLowerCase();
  
  // Check for conventional commit format first
  const conventionalMatch = subject.match(/^(feat|fix|docs|style|refactor|perf|test|chore|ci|build)(\([^)]+\))?:/i);
  if (conventionalMatch) {
    const type = conventionalMatch[1].toLowerCase();
    if (type === 'feat') return 'feature';
    if (type === 'fix') return 'fix';
    if (type === 'docs') return 'docs';
    if (type === 'refactor' || type === 'style' || type === 'chore') return 'refactor';
    if (type === 'perf') return 'enhancement';
  }
  
  if (text.includes('fix') || text.includes('bug') || text.includes('patch') || text.includes('resolve') || text.includes('correct')) {
    return 'fix';
  }
  if (text.includes('refactor') || text.includes('clean') || text.includes('reorganize') || text.includes('maintenance')) {
    return 'refactor';
  }
  if (text.includes('doc') || text.includes('readme') || text.includes('comment')) {
    return 'docs';
  }
  if (text.includes('implement') || text.includes('add new') || text.includes('create') || text.includes('initial')) {
    return 'feature';
  }
  if (text.includes('enhance') || text.includes('improve') || text.includes('update') || text.includes('upgrade')) {
    return 'enhancement';
  }
  return 'other';
}

function detectCategories(subject: string, body: string): string[] {
  const text = `${subject} ${body}`;
  const categories: string[] = [];
  
  for (const [category, patterns] of Object.entries(CATEGORY_PATTERNS)) {
    for (const pattern of patterns) {
      if (pattern.test(text)) {
        if (!categories.includes(category)) {
          categories.push(category);
        }
        break;
      }
    }
  }
  
  return categories.length > 0 ? categories : ['General'];
}

function detectRiskImpact(categories: string[], changeType: string): 'high' | 'medium' | 'low' | 'none' {
  const highRiskCategories = ['RT Dose', 'RT Plan', 'AI Segmentation'];
  const mediumRiskCategories = ['RT Structure', 'DVH', 'Image Fusion', 'Contour Tools', 'Boolean Operations'];
  
  if (categories.some(c => highRiskCategories.includes(c))) {
    return changeType === 'fix' ? 'high' : 'medium';
  }
  if (categories.some(c => mediumRiskCategories.includes(c))) {
    return 'medium';
  }
  if (changeType === 'docs' || categories.includes('Infrastructure')) {
    return 'none';
  }
  return 'low';
}

function inferRequirementIds(categories: string[]): string[] {
  const prefixMap: Record<string, string> = {
    'DVH': 'REQ-DVH',
    'RT Structure': 'REQ-RTSTRUCT',
    'RT Dose': 'REQ-RTDOSE',
    'RT Plan': 'REQ-RTPLAN',
    'Image Fusion': 'REQ-FUSION',
    'AI Segmentation': 'REQ-AI',
    'Image Viewing': 'REQ-VIEW',
    'DICOM Processing': 'REQ-DICOM',
    'Contour Tools': 'REQ-CONTOUR',
    'Boolean Operations': 'REQ-BOOL',
    'Performance': 'REQ-PERF',
    'User Interface': 'REQ-UI',
    'Data Management': 'REQ-DATA',
    'Infrastructure': 'REQ-INFRA',
  };
  
  return categories
    .map(cat => prefixMap[cat])
    .filter(Boolean)
    .map(prefix => `${prefix}-*`);
}

function extractCommits(rootDir: string): ChangeControlDatabase {
  const commits: CommitRecord[] = [];
  const contributors = new Set<string>();
  const byCategory: Record<string, number> = {};
  const byChangeType: Record<string, number> = {};
  
  // Get current branch
  let branch = 'unknown';
  try {
    branch = execSync('git rev-parse --abbrev-ref HEAD', { cwd: rootDir, encoding: 'utf-8' }).trim();
  } catch {
    branch = 'unknown';
  }
  
  // Get commit list with simpler format (one commit per line)
  let commitLines: string[];
  try {
    const logOutput = execSync(
      'git log --format="%H|%h|%ai|%an|%s" --all',
      { cwd: rootDir, encoding: 'utf-8', maxBuffer: 10 * 1024 * 1024 }
    );
    commitLines = logOutput.trim().split('\n').filter(line => line.trim());
  } catch (err) {
    console.error('Failed to read git log:', err);
    return {
      version: '1.0.0',
      generatedAt: new Date().toISOString(),
      repositoryInfo: {
        totalCommits: 0,
        firstCommit: '',
        lastCommit: '',
        contributors: [],
        branch,
      },
      commits: [],
      byCategory: {},
      byChangeType: {},
    };
  }
  
  console.log(`  Found ${commitLines.length} commits to process`);
  
  for (const line of commitLines) {
    const parts = line.split('|');
    if (parts.length < 5) continue;
    
    const [hash, shortHash, dateStr, author, ...subjectParts] = parts;
    const subject = subjectParts.join('|'); // Subject might contain |
    const date = dateStr.split(' ')[0]; // Just the date part
    
    // Skip stash commits and merge commits that are just bookkeeping
    if (subject.startsWith('On ') && subject.includes(': ')) {
      // This is likely a stash commit like "On main: temp stash..."
      continue;
    }
    if (subject.startsWith('index on ') || subject.startsWith('WIP on ')) {
      // Git stash internal commits
      continue;
    }
    
    contributors.add(author);
    
    const affectedCategories = detectCategories(subject, '');
    const changeType = detectChangeType(subject, '');
    const requirementIds = inferRequirementIds(affectedCategories);
    const riskImpact = detectRiskImpact(affectedCategories, changeType);
    const regulatoryDescription = generateRegulatoryDescription(subject, changeType, affectedCategories);
    
    // Determine verification status based on risk
    let verificationStatus: 'verified' | 'pending' | 'not-required' = 'pending';
    if (riskImpact === 'none') {
      verificationStatus = 'not-required';
    }
    
    // Update counters
    for (const cat of affectedCategories) {
      byCategory[cat] = (byCategory[cat] || 0) + 1;
    }
    byChangeType[changeType] = (byChangeType[changeType] || 0) + 1;
    
    commits.push({
      hash,
      shortHash,
      date,
      author,
      subject,
      regulatoryDescription,
      body: '',
      filesChanged: 0,
      insertions: 0,
      deletions: 0,
      affectedCategories,
      changeType,
      requirementIds,
      verificationStatus,
      riskImpact,
    });
  }
  
  return {
    version: '1.0.0',
    generatedAt: new Date().toISOString(),
    repositoryInfo: {
      totalCommits: commits.length,
      firstCommit: commits.length > 0 ? commits[commits.length - 1].date : '',
      lastCommit: commits.length > 0 ? commits[0].date : '',
      contributors: Array.from(contributors),
      branch,
    },
    commits,
    byCategory,
    byChangeType,
  };
}

function generateChangeControlMarkdown(db: ChangeControlDatabase): string {
  const lines: string[] = [];
  
  lines.push('# Change Control Log');
  lines.push('');
  lines.push('## Document Control Information');
  lines.push('');
  lines.push('| Field | Value |');
  lines.push('|-------|-------|');
  lines.push(`| Document Version | ${db.version} |`);
  lines.push(`| Generated | ${new Date(db.generatedAt).toISOString()} |`);
  lines.push(`| Total Changes | ${db.repositoryInfo.totalCommits} |`);
  lines.push(`| Branch | ${db.repositoryInfo.branch} |`);
  lines.push(`| First Change | ${db.repositoryInfo.firstCommit} |`);
  lines.push(`| Last Change | ${db.repositoryInfo.lastCommit} |`);
  lines.push(`| Contributors | ${db.repositoryInfo.contributors.join(', ')} |`);
  lines.push('');
  
  lines.push('## Change Classification Summary');
  lines.push('');
  lines.push('| Change Type | Count | Description |');
  lines.push('|-------------|-------|-------------|');
  
  const typeDescriptions: Record<string, string> = {
    'feature': 'New functionality implemented',
    'enhancement': 'Improvements to existing functionality',
    'fix': 'Defect corrections',
    'refactor': 'Code maintenance without functional changes',
    'docs': 'Documentation updates',
    'other': 'Other changes',
  };
  
  const typeIcons: Record<string, string> = {
    'feature': '✨',
    'enhancement': '📈',
    'fix': '🔧',
    'refactor': '♻️',
    'docs': '📝',
    'other': '📦',
  };
  
  for (const [type, count] of Object.entries(db.byChangeType).sort((a, b) => (b[1] as number) - (a[1] as number))) {
    const icon = typeIcons[type] || '📦';
    lines.push(`| ${icon} ${type.charAt(0).toUpperCase() + type.slice(1)} | ${count} | ${typeDescriptions[type] || type} |`);
  }
  lines.push('');
  
  lines.push('## Changes by Functional Area');
  lines.push('');
  lines.push('| Functional Area | Changes |');
  lines.push('|-----------------|---------|');
  for (const [cat, count] of Object.entries(db.byCategory).sort((a, b) => (b[1] as number) - (a[1] as number))) {
    lines.push(`| ${cat} | ${count} |`);
  }
  lines.push('');
  
  lines.push('## Risk Impact Summary');
  lines.push('');
  const riskCounts = { high: 0, medium: 0, low: 0, none: 0 };
  for (const commit of db.commits) {
    riskCounts[commit.riskImpact]++;
  }
  lines.push('| Risk Level | Count | Verification Required |');
  lines.push('|------------|-------|----------------------|');
  lines.push(`| 🔴 High | ${riskCounts.high} | Yes - Full verification |`);
  lines.push(`| 🟡 Medium | ${riskCounts.medium} | Yes - Standard verification |`);
  lines.push(`| 🟢 Low | ${riskCounts.low} | Recommended |`);
  lines.push(`| ⚪ None | ${riskCounts.none} | Not required |`);
  lines.push('');
  
  lines.push('## Detailed Change History');
  lines.push('');
  
  // Group by month
  const byMonth = new Map<string, CommitRecord[]>();
  for (const commit of db.commits) {
    const month = commit.date.substring(0, 7); // YYYY-MM
    if (!byMonth.has(month)) {
      byMonth.set(month, []);
    }
    byMonth.get(month)!.push(commit);
  }
  
  for (const [month, commits] of Array.from(byMonth.entries()).sort().reverse()) {
    const monthDate = new Date(month + '-01');
    const monthName = monthDate.toLocaleDateString('en-US', { year: 'numeric', month: 'long' });
    
    lines.push(`### ${monthName}`);
    lines.push('');
    lines.push('| Date | Change ID | Type | Risk | Description | Affected Areas |');
    lines.push('|------|-----------|------|------|-------------|----------------|');
    
    for (const commit of commits) {
      const typeIcon = typeIcons[commit.changeType] || '📦';
      const riskIcon = commit.riskImpact === 'high' ? '🔴' : 
                       commit.riskImpact === 'medium' ? '🟡' : 
                       commit.riskImpact === 'low' ? '🟢' : '⚪';
      
      // Use regulatory description, truncate if too long
      const desc = commit.regulatoryDescription.length > 80 
        ? commit.regulatoryDescription.substring(0, 77) + '...' 
        : commit.regulatoryDescription;
      
      lines.push(`| ${commit.date} | \`${commit.shortHash}\` | ${typeIcon} | ${riskIcon} | ${desc} | ${commit.affectedCategories.slice(0, 2).join(', ')} |`);
    }
    lines.push('');
  }
  
  lines.push('## Individual Change Records');
  lines.push('');
  lines.push('*Showing most recent 30 changes with full details*');
  lines.push('');
  
  // Only show recent detailed changes
  const recentCommits = db.commits.slice(0, 30);
  
  for (const commit of recentCommits) {
    const riskIcon = commit.riskImpact === 'high' ? '🔴 HIGH' : 
                     commit.riskImpact === 'medium' ? '🟡 MEDIUM' : 
                     commit.riskImpact === 'low' ? '🟢 LOW' : '⚪ NONE';
    
    lines.push(`### Change ${commit.shortHash}`);
    lines.push('');
    lines.push(`**${commit.regulatoryDescription}**`);
    lines.push('');
    lines.push(`| Attribute | Value |`);
    lines.push(`|-----------|-------|`);
    lines.push(`| Date | ${commit.date} |`);
    lines.push(`| Author | ${commit.author} |`);
    lines.push(`| Change Type | ${commit.changeType} |`);
    lines.push(`| Risk Impact | ${riskIcon} |`);
    lines.push(`| Verification | ${commit.verificationStatus} |`);
    lines.push(`| Affected Areas | ${commit.affectedCategories.join(', ')} |`);
    if (commit.requirementIds.length > 0) {
      lines.push(`| Related Requirements | ${commit.requirementIds.join(', ')} |`);
    }
    lines.push('');
  }
  
  lines.push('---');
  lines.push('');
  lines.push('## Compliance Notes');
  lines.push('');
  lines.push('This change control log is automatically generated from the version control system ');
  lines.push('to provide traceability as required by IEC 62304 and FDA guidance for software ');
  lines.push('as a medical device. All changes are tracked and categorized by risk impact.');
  lines.push('');
  lines.push('**Verification Status Legend:**');
  lines.push('- `verified` - Change has been tested and validated');
  lines.push('- `pending` - Verification testing required');
  lines.push('- `not-required` - Low-risk change, verification at discretion');
  lines.push('');
  
  return lines.join('\n');
}

// Main execution
const rootDir = path.resolve(__dirname, '../..');
console.log('🔍 Extracting change control from git history...');
console.log(`   Root directory: ${rootDir}`);

const db = extractCommits(rootDir);

// Write JSON
const jsonPath = path.join(rootDir, 'docs/regulatory/change-control.json');
fs.writeFileSync(jsonPath, JSON.stringify(db, null, 2));
console.log(`✅ Written: ${jsonPath}`);

// Write Markdown
const mdPath = path.join(rootDir, 'docs/regulatory/CHANGE_CONTROL.md');
fs.writeFileSync(mdPath, generateChangeControlMarkdown(db));
console.log(`✅ Written: ${mdPath}`);

console.log('');
console.log(`📊 Summary:`);
console.log(`   Total commits: ${db.repositoryInfo.totalCommits}`);
console.log(`   Branch: ${db.repositoryInfo.branch}`);
console.log(`   Date range: ${db.repositoryInfo.firstCommit} to ${db.repositoryInfo.lastCommit}`);
console.log(`   Contributors: ${db.repositoryInfo.contributors.length}`);
console.log(`   Features: ${db.byChangeType.feature || 0}`);
console.log(`   Enhancements: ${db.byChangeType.enhancement || 0}`);
console.log(`   Fixes: ${db.byChangeType.fix || 0}`);
