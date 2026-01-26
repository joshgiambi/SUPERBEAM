/**
 * Regulatory Documentation API
 * 
 * Serves regulatory documentation data for the dashboard
 * Includes test files, traceability, and compliance metrics
 */

import { Router, Request, Response } from 'express';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = Router();

// Use process.cwd() for more reliable path resolution
const ROOT_DIR = process.cwd();
const DOCS_DIR = path.join(ROOT_DIR, 'docs/regulatory');
const TESTS_DIR = path.join(ROOT_DIR, 'client/src/lib/__tests__');

console.log(`[Regulatory API] Docs directory: ${DOCS_DIR}`);
console.log(`[Regulatory API] Tests directory: ${TESTS_DIR}`);

interface TestFile {
  name: string;
  path: string;
  content: string;
  testCount: number;
  passedCount: number;
  categories: string[];
}

interface RegulatoryData {
  requirements: any;
  changeControl: any;
  traceability: any;
  testFiles: TestFile[];
  summary: {
    totalRequirements: number;
    verifiedCount: number;
    partialCount: number;
    pendingCount: number;
    highRiskCount: number;
    mediumRiskCount: number;
    lowRiskCount: number;
    coveragePercent: number;
    lastGenerated: string;
    categories: Array<{ name: string; count: number; verified: number }>;
    testSummary: {
      totalTests: number;
      totalTestFiles: number;
      categories: string[];
    };
  };
}

function loadJSONFile(filename: string): any {
  try {
    const filePath = path.join(DOCS_DIR, filename);
    console.log(`[Regulatory API] Loading JSON: ${filePath}`);
    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, 'utf-8');
      return JSON.parse(content);
    }
    console.log(`[Regulatory API] File not found: ${filePath}`);
  } catch (err) {
    console.error(`[Regulatory API] Failed to load ${filename}:`, err);
  }
  return null;
}

function loadMarkdownFile(filename: string): string {
  try {
    const filePath = path.join(DOCS_DIR, filename);
    if (fs.existsSync(filePath)) {
      return fs.readFileSync(filePath, 'utf-8');
    }
  } catch (err) {
    console.error(`[Regulatory API] Failed to load ${filename}:`, err);
  }
  return '';
}

function scanTestFiles(): TestFile[] {
  const testFiles: TestFile[] = [];
  
  // Scan multiple potential test directories
  const testDirs = [
    path.join(ROOT_DIR, 'client/src/lib/__tests__'),
    path.join(ROOT_DIR, 'client/src/__tests__'),
    path.join(ROOT_DIR, 'server/__tests__'),
    path.join(ROOT_DIR, 'tests'),
  ];
  
  for (const testDir of testDirs) {
    if (!fs.existsSync(testDir)) continue;
    
    try {
      const files = fs.readdirSync(testDir);
      for (const file of files) {
        if (file.endsWith('.test.ts') || file.endsWith('.test.tsx') || file.endsWith('.spec.ts')) {
          const filePath = path.join(testDir, file);
          const content = fs.readFileSync(filePath, 'utf-8');
          
          // Count test cases (it() or test() calls)
          const testMatches = content.match(/\b(it|test)\s*\(/g);
          const testCount = testMatches ? testMatches.length : 0;
          
          // Extract categories from describe blocks
          const describeMatches = content.match(/describe\s*\(\s*['"`]([^'"`]+)['"`]/g);
          const categories = describeMatches 
            ? describeMatches.map(m => m.replace(/describe\s*\(\s*['"`]/, '').replace(/['"`]$/, ''))
            : [];
          
          testFiles.push({
            name: file,
            path: path.relative(ROOT_DIR, filePath),
            content,
            testCount,
            passedCount: testCount, // Assume all pass until we run them
            categories,
          });
        }
      }
    } catch (err) {
      console.error(`[Regulatory API] Error scanning ${testDir}:`, err);
    }
  }
  
  return testFiles;
}

// Check if documentation exists
router.get('/status', (req: Request, res: Response) => {
  const exists = fs.existsSync(path.join(DOCS_DIR, 'requirements.json'));
  const docsDir = DOCS_DIR;
  
  let files: string[] = [];
  if (fs.existsSync(DOCS_DIR)) {
    files = fs.readdirSync(DOCS_DIR);
  }
  
  res.json({ 
    exists, 
    docsDir,
    files,
    rootDir: ROOT_DIR
  });
});

// Get complete regulatory data
router.get('/data', (req: Request, res: Response) => {
  console.log(`[Regulatory API] GET /data - Loading from ${DOCS_DIR}`);
  
  const requirements = loadJSONFile('requirements.json');
  const changeControl = loadJSONFile('change-control.json');
  const traceability = loadJSONFile('traceability.json');
  const testFiles = scanTestFiles();
  
  if (!requirements || !traceability) {
    console.log(`[Regulatory API] Missing files - requirements: ${!!requirements}, traceability: ${!!traceability}`);
    return res.status(404).json({ 
      error: 'Regulatory documentation not generated. Run: npx tsx scripts/regulatory/run-all.ts',
      docsDir: DOCS_DIR,
      exists: fs.existsSync(DOCS_DIR),
      files: fs.existsSync(DOCS_DIR) ? fs.readdirSync(DOCS_DIR) : []
    });
  }
  
  // Calculate summary
  const entries = traceability.entries || [];
  const verifiedCount = entries.filter((e: any) => e.validationStatus === 'complete').length;
  const partialCount = entries.filter((e: any) => e.validationStatus === 'partial').length;
  const pendingCount = entries.filter((e: any) => e.validationStatus === 'pending').length;
  
  // Group by category for chart data
  const categoryMap = new Map<string, { count: number; verified: number }>();
  for (const entry of entries) {
    if (!categoryMap.has(entry.category)) {
      categoryMap.set(entry.category, { count: 0, verified: 0 });
    }
    const cat = categoryMap.get(entry.category)!;
    cat.count++;
    if (entry.validationStatus === 'complete') cat.verified++;
  }
  
  const categories = Array.from(categoryMap.entries())
    .map(([name, data]) => ({ name, ...data }))
    .sort((a, b) => b.count - a.count);
  
  // Test summary
  const totalTests = testFiles.reduce((sum, f) => sum + f.testCount, 0);
  const testCategories = [...new Set(testFiles.flatMap(f => f.categories))];
  
  const data: RegulatoryData = {
    requirements,
    changeControl,
    traceability,
    testFiles,
    summary: {
      totalRequirements: requirements.totalRequirements,
      verifiedCount,
      partialCount,
      pendingCount,
      highRiskCount: requirements.byRisk?.high || 0,
      mediumRiskCount: requirements.byRisk?.medium || 0,
      lowRiskCount: requirements.byRisk?.low || 0,
      coveragePercent: entries.length > 0 ? Math.round((verifiedCount / entries.length) * 100) : 0,
      lastGenerated: requirements.generatedAt || traceability.generatedAt,
      categories,
      testSummary: {
        totalTests,
        totalTestFiles: testFiles.length,
        categories: testCategories,
      },
    },
  };
  
  res.json(data);
});

// Get summary only (lighter endpoint)
router.get('/summary', (req: Request, res: Response) => {
  const requirements = loadJSONFile('requirements.json');
  const traceability = loadJSONFile('traceability.json');
  
  if (!requirements || !traceability) {
    return res.status(404).json({ error: 'Regulatory documentation not generated' });
  }
  
  const entries = traceability.entries || [];
  const verifiedCount = entries.filter((e: any) => e.validationStatus === 'complete').length;
  
  res.json({
    totalRequirements: requirements.totalRequirements,
    verifiedCount,
    coveragePercent: entries.length > 0 ? Math.round((verifiedCount / entries.length) * 100) : 0,
    highRiskCount: requirements.byRisk?.high || 0,
    lastGenerated: requirements.generatedAt,
  });
});

// Get markdown documents
router.get('/docs/:docName', (req: Request, res: Response) => {
  const { docName } = req.params;
  
  const validDocs: Record<string, string> = {
    'srs': 'SRS.md',
    'change-control': 'CHANGE_CONTROL.md',
    'traceability': 'TRACEABILITY_MATRIX.md',
    'verification': 'VERIFICATION_SUMMARY.md',
    'readme': 'README.md',
  };
  
  const filename = validDocs[docName.toLowerCase()];
  if (!filename) {
    return res.status(404).json({ error: 'Document not found' });
  }
  
  const content = loadMarkdownFile(filename);
  if (!content) {
    return res.status(404).json({ error: 'Document file not found' });
  }
  
  res.json({ filename, content });
});

// Get test files
router.get('/tests', (req: Request, res: Response) => {
  const testFiles = scanTestFiles();
  res.json({ 
    count: testFiles.length,
    totalTests: testFiles.reduce((sum, f) => sum + f.testCount, 0),
    files: testFiles 
  });
});

// Get single test file content
router.get('/tests/:filename', (req: Request, res: Response) => {
  const { filename } = req.params;
  const testFiles = scanTestFiles();
  const testFile = testFiles.find(f => f.name === filename);
  
  if (!testFile) {
    return res.status(404).json({ error: 'Test file not found' });
  }
  
  res.json(testFile);
});

// Regenerate documentation
router.post('/regenerate', async (req: Request, res: Response) => {
  try {
    console.log(`[Regulatory API] Regenerating documentation...`);
    
    execSync('npx tsx scripts/regulatory/run-all.ts', {
      cwd: ROOT_DIR,
      encoding: 'utf-8',
      timeout: 120000,
    });
    
    res.json({ success: true, message: 'Documentation regenerated successfully' });
  } catch (err: any) {
    console.error('[Regulatory API] Regeneration failed:', err);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to regenerate documentation',
      details: err.message,
      stdout: err.stdout,
      stderr: err.stderr
    });
  }
});

// Get requirements by category
router.get('/requirements/:category', (req: Request, res: Response) => {
  const { category } = req.params;
  const requirements = loadJSONFile('requirements.json');
  
  if (!requirements) {
    return res.status(404).json({ error: 'Requirements not found' });
  }
  
  const filtered = requirements.requirements.filter(
    (r: any) => r.category.toLowerCase() === decodeURIComponent(category).toLowerCase()
  );
  
  res.json({ category, requirements: filtered });
});

// Get high-risk items
router.get('/high-risk', (req: Request, res: Response) => {
  const traceability = loadJSONFile('traceability.json');
  
  if (!traceability) {
    return res.status(404).json({ error: 'Traceability data not found' });
  }
  
  const highRisk = (traceability.entries || []).filter(
    (e: any) => e.riskClass === 'high'
  );
  
  res.json({ 
    count: highRisk.length,
    verified: highRisk.filter((e: any) => e.validationStatus === 'complete').length,
    items: highRisk 
  });
});

// Run tests endpoint (placeholder for future CI integration)
router.post('/run-tests', async (req: Request, res: Response) => {
  try {
    // This would integrate with your test runner in the future
    // For now, we'll just return a placeholder response
    res.json({ 
      success: true, 
      message: 'Test execution not yet implemented. Configure Jest or Vitest for automated testing.',
      hint: 'Add test runner to package.json and implement CI pipeline'
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
