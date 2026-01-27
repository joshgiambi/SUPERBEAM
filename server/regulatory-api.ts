/**
 * Regulatory Documentation API
 * 
 * Serves regulatory documentation data for the dashboard
 * Includes test files, traceability, compliance metrics, and human factors testing
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
const HF_DATA_FILE = path.join(DOCS_DIR, 'human-factors.json');

// ============================================================================
// Human Factors Testing Types
// ============================================================================

interface HFParticipant {
  id: string;
  name: string;
  role: string;
  department: string;
  yearsExperience: number;
  priorSystemExperience: string; // e.g., "Eclipse", "Pinnacle", "RayStation"
  enrolledDate: string;
}

interface HFTask {
  id: string;
  name: string;
  description: string;
  category: string;
  acceptanceCriteria: string[];
  riskLevel: 'critical' | 'major' | 'minor';
  estimatedTimeMinutes: number;
  relatedRequirements: string[]; // Links to REQ-xxx IDs
  knowledgeQuestions?: string[]; // Post-task understanding verification
}

interface HFTaskResult {
  taskId: string;
  participantId: string;
  sessionId: string;
  timestamp: string;
  completed: boolean;
  success: boolean;
  timeSeconds: number;
  useErrors: Array<{
    description: string;
    errorType: 'slip' | 'mistake' | 'close-call';
    severity: 'critical' | 'serious' | 'moderate' | 'minor';
    rootCause?: string;
  }>;
  observations: string;
  knowledgeTaskResults?: Array<{
    question: string;
    understoodCorrectly: boolean;
    notes?: string;
  }>;
}

interface HFSession {
  id: string;
  participantId: string;
  startTime: string;
  endTime?: string;
  status: 'scheduled' | 'in-progress' | 'completed' | 'cancelled';
  facilitator: string;
  environment: string; // e.g., "Remote - Teams", "On-site - Planning Room A"
  taskResults: HFTaskResult[];
  generalObservations?: string;
  debriefNotes?: string;
}

interface HFFinding {
  id: string;
  title: string;
  description: string;
  severity: 'critical' | 'serious' | 'moderate' | 'minor';
  category: 'use-error' | 'close-call' | 'difficulty' | 'confusion' | 'workflow' | 'ui-design';
  affectedTasks: string[];
  discoveredInSessions: string[];
  status: 'open' | 'under-review' | 'design-change-planned' | 'resolved' | 'accepted-risk';
  rootCause?: string;
  proposedMitigation?: string;
  designChangeRef?: string; // Git commit or change ID
  createdDate: string;
  resolvedDate?: string;
}

interface HFProtocol {
  id: string;
  version: string;
  name: string;
  description: string;
  tasks: HFTask[];
  createdDate: string;
  lastModified: string;
}

interface HumanFactorsData {
  version: string;
  generatedAt: string;
  protocol: HFProtocol;
  participants: HFParticipant[];
  sessions: HFSession[];
  findings: HFFinding[];
  summary: {
    totalParticipants: number;
    completedSessions: number;
    totalTasks: number;
    tasksWithErrors: number;
    criticalFindings: number;
    openFindings: number;
    overallSuccessRate: number;
  };
}

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

// ============================================================================
// Human Factors Testing API Endpoints
// ============================================================================

function loadHumanFactorsData(): HumanFactorsData | null {
  try {
    if (fs.existsSync(HF_DATA_FILE)) {
      const content = fs.readFileSync(HF_DATA_FILE, 'utf-8');
      return JSON.parse(content);
    }
  } catch (err) {
    console.error('[Regulatory API] Failed to load human factors data:', err);
  }
  return null;
}

function saveHumanFactorsData(data: HumanFactorsData): boolean {
  try {
    // Ensure docs directory exists
    if (!fs.existsSync(DOCS_DIR)) {
      fs.mkdirSync(DOCS_DIR, { recursive: true });
    }
    // Update summary before saving
    data.summary = calculateHFSummary(data);
    data.generatedAt = new Date().toISOString();
    fs.writeFileSync(HF_DATA_FILE, JSON.stringify(data, null, 2));
    return true;
  } catch (err) {
    console.error('[Regulatory API] Failed to save human factors data:', err);
    return false;
  }
}

function calculateHFSummary(data: HumanFactorsData): HumanFactorsData['summary'] {
  const completedSessions = data.sessions.filter(s => s.status === 'completed');
  const allTaskResults = completedSessions.flatMap(s => s.taskResults);
  const tasksWithErrors = allTaskResults.filter(r => r.useErrors.length > 0).length;
  const successfulTasks = allTaskResults.filter(r => r.success).length;
  
  return {
    totalParticipants: data.participants.length,
    completedSessions: completedSessions.length,
    totalTasks: data.protocol.tasks.length,
    tasksWithErrors,
    criticalFindings: data.findings.filter(f => f.severity === 'critical').length,
    openFindings: data.findings.filter(f => f.status === 'open' || f.status === 'under-review').length,
    overallSuccessRate: allTaskResults.length > 0 
      ? Math.round((successfulTasks / allTaskResults.length) * 100) 
      : 0,
  };
}

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

// Initialize default human factors data if it doesn't exist
function initializeHumanFactorsData(): HumanFactorsData {
  const defaultData: HumanFactorsData = {
    version: '1.0.0',
    generatedAt: new Date().toISOString(),
    protocol: {
      id: 'HF-PROTO-001',
      version: '1.0',
      name: 'CONVERGE Formative Usability Evaluation',
      description: 'Internal formative human factors testing protocol for CONVERGE Medical Imaging Viewer. Tests critical workflows performed by clinical planners in radiation oncology.',
      tasks: [
        {
          id: 'HF-TASK-001',
          name: 'Import DICOM Study',
          description: 'Import a CT/MR study with RT Structure Set from local filesystem',
          category: 'Data Import',
          acceptanceCriteria: [
            'User successfully navigates to upload interface',
            'User selects correct files for import',
            'Import completes without errors',
            'User can view imported images'
          ],
          riskLevel: 'minor',
          estimatedTimeMinutes: 5,
          relatedRequirements: ['REQ-DICOM-001', 'REQ-IMPORT-001'],
          knowledgeQuestions: [
            'What file types can be imported?',
            'How would you know if an import failed?'
          ]
        },
        {
          id: 'HF-TASK-002',
          name: 'Navigate Image Stack',
          description: 'Use scroll, window/level, and zoom controls to review a CT image stack',
          category: 'Image Viewing',
          acceptanceCriteria: [
            'User can scroll through all slices',
            'User adjusts window/level appropriately',
            'User zooms in/out successfully',
            'User understands current slice position'
          ],
          riskLevel: 'minor',
          estimatedTimeMinutes: 3,
          relatedRequirements: ['REQ-VIEW-001', 'REQ-VIEW-002'],
          knowledgeQuestions: [
            'How do you know which slice you are viewing?',
            'How would you reset the zoom level?'
          ]
        },
        {
          id: 'HF-TASK-003',
          name: 'Create New Structure',
          description: 'Create a new structure (ROI) and contour the GTV on 5 consecutive slices using the pen tool',
          category: 'Contouring',
          acceptanceCriteria: [
            'User creates structure with appropriate name',
            'User selects correct tool for contouring',
            'Contours are placed on correct anatomical location',
            'Contours are closed and properly formed',
            'User completes contouring on 5 slices'
          ],
          riskLevel: 'critical',
          estimatedTimeMinutes: 10,
          relatedRequirements: ['REQ-CONTOUR-001', 'REQ-CONTOUR-007', 'REQ-STRUCT-001'],
          knowledgeQuestions: [
            'How would you undo a contour error?',
            'How do you verify the volume of the structure you created?',
            'What color was assigned to your structure?'
          ]
        },
        {
          id: 'HF-TASK-004',
          name: 'Edit Existing Contour',
          description: 'Modify an existing contour by adding/removing points and smoothing',
          category: 'Contouring',
          acceptanceCriteria: [
            'User selects correct structure for editing',
            'User successfully adds points to contour',
            'User successfully removes points from contour',
            'User applies smoothing operation',
            'Final contour is clinically acceptable'
          ],
          riskLevel: 'critical',
          estimatedTimeMinutes: 8,
          relatedRequirements: ['REQ-CONTOUR-001', 'REQ-CONTOUR-017'],
          knowledgeQuestions: [
            'How do you know which structure is currently selected?',
            'What happens if you edit the wrong structure?'
          ]
        },
        {
          id: 'HF-TASK-005',
          name: 'Use AI-Assisted Segmentation',
          description: 'Use the AI prediction tool to auto-segment a structure and review/edit the results',
          category: 'AI Segmentation',
          acceptanceCriteria: [
            'User initiates AI segmentation correctly',
            'User understands AI is processing',
            'User reviews AI-generated contours',
            'User accepts or modifies AI results appropriately',
            'User understands AI results require verification'
          ],
          riskLevel: 'critical',
          estimatedTimeMinutes: 7,
          relatedRequirements: ['REQ-AI-001', 'REQ-AI-003'],
          knowledgeQuestions: [
            'Should AI-generated contours be used without review?',
            'How do you know when AI processing is complete?',
            'What would you do if the AI result is incorrect?'
          ]
        },
        {
          id: 'HF-TASK-006',
          name: 'Fuse Two Image Series',
          description: 'Register and fuse a CT with an MR series for viewing',
          category: 'Image Fusion',
          acceptanceCriteria: [
            'User selects correct primary and secondary series',
            'User initiates registration',
            'User adjusts fusion display (opacity/colormap)',
            'User can verify alignment quality',
            'User understands fusion is for viewing only'
          ],
          riskLevel: 'major',
          estimatedTimeMinutes: 10,
          relatedRequirements: ['REQ-FUSION-001', 'REQ-FUSION-002'],
          knowledgeQuestions: [
            'How do you verify the registration quality?',
            'What series is used as the reference?'
          ]
        },
        {
          id: 'HF-TASK-007',
          name: 'Create Margin Expansion',
          description: 'Create a PTV by expanding a CTV structure with appropriate margins',
          category: 'Structure Operations',
          acceptanceCriteria: [
            'User selects correct source structure',
            'User enters appropriate margin values',
            'User names the new structure appropriately',
            'Margin operation completes successfully',
            'User verifies resulting structure'
          ],
          riskLevel: 'critical',
          estimatedTimeMinutes: 5,
          relatedRequirements: ['REQ-MARGIN-001', 'REQ-STRUCT-002'],
          knowledgeQuestions: [
            'What margins did you apply?',
            'How would you verify the margin was applied correctly?'
          ]
        },
        {
          id: 'HF-TASK-008',
          name: 'Export RT Structure Set',
          description: 'Export the modified structure set as a new DICOM RT Structure file',
          category: 'Data Export',
          acceptanceCriteria: [
            'User navigates to export function',
            'User selects appropriate structures for export',
            'User specifies export location',
            'Export completes without errors',
            'User can locate exported file'
          ],
          riskLevel: 'major',
          estimatedTimeMinutes: 5,
          relatedRequirements: ['REQ-DICOM-001'],
          knowledgeQuestions: [
            'What format is the exported file?',
            'Where was the file saved?',
            'How would you verify the export was successful?'
          ]
        },
        {
          id: 'HF-TASK-009',
          name: 'View DVH for Structure',
          description: 'Open and interpret the Dose-Volume Histogram for a target structure',
          category: 'Dose Analysis',
          acceptanceCriteria: [
            'User opens DVH viewer',
            'User selects appropriate structure',
            'User can read DVH values (D95, V100, etc.)',
            'User understands DVH display'
          ],
          riskLevel: 'major',
          estimatedTimeMinutes: 5,
          relatedRequirements: ['REQ-DVH-001', 'REQ-DVH-002'],
          knowledgeQuestions: [
            'What is the D95 for the selected structure?',
            'How do you compare DVH for multiple structures?'
          ]
        },
        {
          id: 'HF-TASK-010',
          name: 'Boolean Structure Operation',
          description: 'Create a new structure by subtracting one structure from another',
          category: 'Structure Operations',
          acceptanceCriteria: [
            'User selects correct structures for operation',
            'User chooses correct boolean operation (subtract)',
            'User names result structure appropriately',
            'Operation completes correctly',
            'Result matches expected outcome'
          ],
          riskLevel: 'critical',
          estimatedTimeMinutes: 5,
          relatedRequirements: ['REQ-BOOL-001', 'REQ-BOOL-002'],
          knowledgeQuestions: [
            'What structures did you use?',
            'What was the boolean operation you performed?'
          ]
        }
      ],
      createdDate: new Date().toISOString(),
      lastModified: new Date().toISOString(),
    },
    participants: [],
    sessions: [],
    findings: [],
    summary: {
      totalParticipants: 0,
      completedSessions: 0,
      totalTasks: 10,
      tasksWithErrors: 0,
      criticalFindings: 0,
      openFindings: 0,
      overallSuccessRate: 0,
    },
  };
  
  saveHumanFactorsData(defaultData);
  return defaultData;
}

// Get all human factors data
router.get('/human-factors', (req: Request, res: Response) => {
  let data = loadHumanFactorsData();
  if (!data) {
    data = initializeHumanFactorsData();
  }
  res.json(data);
});

// Get protocol only
router.get('/human-factors/protocol', (req: Request, res: Response) => {
  let data = loadHumanFactorsData();
  if (!data) {
    data = initializeHumanFactorsData();
  }
  res.json(data.protocol);
});

// Add a new participant
router.post('/human-factors/participants', (req: Request, res: Response) => {
  let data = loadHumanFactorsData();
  if (!data) {
    data = initializeHumanFactorsData();
  }
  
  const participant: HFParticipant = {
    id: `HF-PART-${generateId()}`,
    ...req.body,
    enrolledDate: new Date().toISOString(),
  };
  
  data.participants.push(participant);
  
  if (saveHumanFactorsData(data)) {
    res.json({ success: true, participant });
  } else {
    res.status(500).json({ error: 'Failed to save participant' });
  }
});

// Get all participants
router.get('/human-factors/participants', (req: Request, res: Response) => {
  let data = loadHumanFactorsData();
  if (!data) {
    data = initializeHumanFactorsData();
  }
  res.json(data.participants);
});

// Delete a participant
router.delete('/human-factors/participants/:id', (req: Request, res: Response) => {
  let data = loadHumanFactorsData();
  if (!data) {
    return res.status(404).json({ error: 'No data found' });
  }
  
  const index = data.participants.findIndex(p => p.id === req.params.id);
  if (index === -1) {
    return res.status(404).json({ error: 'Participant not found' });
  }
  
  data.participants.splice(index, 1);
  
  if (saveHumanFactorsData(data)) {
    res.json({ success: true });
  } else {
    res.status(500).json({ error: 'Failed to delete participant' });
  }
});

// Create a new test session
router.post('/human-factors/sessions', (req: Request, res: Response) => {
  let data = loadHumanFactorsData();
  if (!data) {
    data = initializeHumanFactorsData();
  }
  
  const session: HFSession = {
    id: `HF-SESS-${generateId()}`,
    participantId: req.body.participantId,
    startTime: new Date().toISOString(),
    status: 'scheduled',
    facilitator: req.body.facilitator || 'Not specified',
    environment: req.body.environment || 'Not specified',
    taskResults: [],
  };
  
  data.sessions.push(session);
  
  if (saveHumanFactorsData(data)) {
    res.json({ success: true, session });
  } else {
    res.status(500).json({ error: 'Failed to create session' });
  }
});

// Get all sessions
router.get('/human-factors/sessions', (req: Request, res: Response) => {
  let data = loadHumanFactorsData();
  if (!data) {
    data = initializeHumanFactorsData();
  }
  res.json(data.sessions);
});

// Get a specific session
router.get('/human-factors/sessions/:id', (req: Request, res: Response) => {
  let data = loadHumanFactorsData();
  if (!data) {
    return res.status(404).json({ error: 'No data found' });
  }
  
  const session = data.sessions.find(s => s.id === req.params.id);
  if (!session) {
    return res.status(404).json({ error: 'Session not found' });
  }
  
  res.json(session);
});

// Update a session (status, end time, debrief notes)
router.patch('/human-factors/sessions/:id', (req: Request, res: Response) => {
  let data = loadHumanFactorsData();
  if (!data) {
    return res.status(404).json({ error: 'No data found' });
  }
  
  const session = data.sessions.find(s => s.id === req.params.id);
  if (!session) {
    return res.status(404).json({ error: 'Session not found' });
  }
  
  // Update allowed fields
  if (req.body.status) session.status = req.body.status;
  if (req.body.endTime) session.endTime = req.body.endTime;
  if (req.body.generalObservations !== undefined) session.generalObservations = req.body.generalObservations;
  if (req.body.debriefNotes !== undefined) session.debriefNotes = req.body.debriefNotes;
  
  if (saveHumanFactorsData(data)) {
    res.json({ success: true, session });
  } else {
    res.status(500).json({ error: 'Failed to update session' });
  }
});

// Add task result to a session
router.post('/human-factors/sessions/:sessionId/tasks', (req: Request, res: Response) => {
  let data = loadHumanFactorsData();
  if (!data) {
    return res.status(404).json({ error: 'No data found' });
  }
  
  const session = data.sessions.find(s => s.id === req.params.sessionId);
  if (!session) {
    return res.status(404).json({ error: 'Session not found' });
  }
  
  const taskResult: HFTaskResult = {
    taskId: req.body.taskId,
    participantId: session.participantId,
    sessionId: session.id,
    timestamp: new Date().toISOString(),
    completed: req.body.completed ?? false,
    success: req.body.success ?? false,
    timeSeconds: req.body.timeSeconds ?? 0,
    useErrors: req.body.useErrors ?? [],
    observations: req.body.observations ?? '',
    knowledgeTaskResults: req.body.knowledgeTaskResults,
  };
  
  // Update or add task result
  const existingIndex = session.taskResults.findIndex(r => r.taskId === taskResult.taskId);
  if (existingIndex >= 0) {
    session.taskResults[existingIndex] = taskResult;
  } else {
    session.taskResults.push(taskResult);
  }
  
  if (saveHumanFactorsData(data)) {
    res.json({ success: true, taskResult });
  } else {
    res.status(500).json({ error: 'Failed to save task result' });
  }
});

// Create a new finding
router.post('/human-factors/findings', (req: Request, res: Response) => {
  let data = loadHumanFactorsData();
  if (!data) {
    data = initializeHumanFactorsData();
  }
  
  const finding: HFFinding = {
    id: `HF-FIND-${generateId()}`,
    title: req.body.title,
    description: req.body.description,
    severity: req.body.severity || 'moderate',
    category: req.body.category || 'difficulty',
    affectedTasks: req.body.affectedTasks || [],
    discoveredInSessions: req.body.discoveredInSessions || [],
    status: 'open',
    rootCause: req.body.rootCause,
    proposedMitigation: req.body.proposedMitigation,
    createdDate: new Date().toISOString(),
  };
  
  data.findings.push(finding);
  
  if (saveHumanFactorsData(data)) {
    res.json({ success: true, finding });
  } else {
    res.status(500).json({ error: 'Failed to save finding' });
  }
});

// Get all findings
router.get('/human-factors/findings', (req: Request, res: Response) => {
  let data = loadHumanFactorsData();
  if (!data) {
    data = initializeHumanFactorsData();
  }
  res.json(data.findings);
});

// Update a finding
router.patch('/human-factors/findings/:id', (req: Request, res: Response) => {
  let data = loadHumanFactorsData();
  if (!data) {
    return res.status(404).json({ error: 'No data found' });
  }
  
  const finding = data.findings.find(f => f.id === req.params.id);
  if (!finding) {
    return res.status(404).json({ error: 'Finding not found' });
  }
  
  // Update allowed fields
  const allowedFields = ['title', 'description', 'severity', 'category', 'status', 
                         'rootCause', 'proposedMitigation', 'designChangeRef', 'resolvedDate'];
  for (const field of allowedFields) {
    if (req.body[field] !== undefined) {
      (finding as any)[field] = req.body[field];
    }
  }
  
  if (saveHumanFactorsData(data)) {
    res.json({ success: true, finding });
  } else {
    res.status(500).json({ error: 'Failed to update finding' });
  }
});

// Generate Human Factors Test Report (Markdown)
router.get('/human-factors/report', (req: Request, res: Response) => {
  let data = loadHumanFactorsData();
  if (!data) {
    data = initializeHumanFactorsData();
  }
  
  const completedSessions = data.sessions.filter(s => s.status === 'completed');
  
  let report = `# Human Factors Test Report

## Document Information

| Field | Value |
|-------|-------|
| Document Version | ${data.version} |
| Generated | ${new Date().toISOString()} |
| Protocol | ${data.protocol.name} |
| Protocol Version | ${data.protocol.version} |

## Executive Summary

| Metric | Value |
|--------|-------|
| Total Participants | ${data.summary.totalParticipants} |
| Completed Sessions | ${data.summary.completedSessions} |
| Overall Success Rate | ${data.summary.overallSuccessRate}% |
| Tasks with Use Errors | ${data.summary.tasksWithErrors} |
| Critical Findings | ${data.summary.criticalFindings} |
| Open Findings | ${data.summary.openFindings} |

## Participants

| ID | Name | Role | Experience | Prior Systems |
|----|------|------|------------|---------------|
${data.participants.map(p => 
  `| ${p.id} | ${p.name} | ${p.role} | ${p.yearsExperience} years | ${p.priorSystemExperience} |`
).join('\n')}

## Test Protocol Tasks

| ID | Task | Risk Level | Est. Time |
|----|------|------------|-----------|
${data.protocol.tasks.map(t => 
  `| ${t.id} | ${t.name} | ${t.riskLevel.toUpperCase()} | ${t.estimatedTimeMinutes} min |`
).join('\n')}

## Session Results

${completedSessions.map(s => {
  const participant = data!.participants.find(p => p.id === s.participantId);
  return `### Session: ${s.id}
- **Participant:** ${participant?.name || 'Unknown'} (${participant?.role || 'Unknown'})
- **Date:** ${new Date(s.startTime).toLocaleDateString()}
- **Facilitator:** ${s.facilitator}
- **Environment:** ${s.environment}

#### Task Results

| Task | Completed | Success | Time | Errors |
|------|-----------|---------|------|--------|
${s.taskResults.map(r => {
  const task = data!.protocol.tasks.find(t => t.id === r.taskId);
  return `| ${task?.name || r.taskId} | ${r.completed ? '✅' : '❌'} | ${r.success ? '✅' : '❌'} | ${r.timeSeconds}s | ${r.useErrors.length} |`;
}).join('\n')}

${s.debriefNotes ? `**Debrief Notes:** ${s.debriefNotes}` : ''}
`;
}).join('\n---\n')}

## Findings

### Critical Findings

${data.findings.filter(f => f.severity === 'critical').map(f => `
#### ${f.id}: ${f.title}
- **Status:** ${f.status}
- **Category:** ${f.category}
- **Description:** ${f.description}
- **Root Cause:** ${f.rootCause || 'Under investigation'}
- **Mitigation:** ${f.proposedMitigation || 'TBD'}
`).join('\n') || 'No critical findings.'}

### All Findings Summary

| ID | Title | Severity | Status | Category |
|----|-------|----------|--------|----------|
${data.findings.map(f => 
  `| ${f.id} | ${f.title} | ${f.severity.toUpperCase()} | ${f.status} | ${f.category} |`
).join('\n') || '| No findings recorded | | | |'}

## Conclusion

This report documents the formative human factors evaluation conducted for ${data.protocol.name}. 
${data.summary.criticalFindings > 0 
  ? `**${data.summary.criticalFindings} critical findings require resolution before proceeding.**`
  : 'No critical findings were identified during testing.'}

---

*Generated automatically from human factors testing data.*
`;

  res.json({ 
    filename: 'HUMAN_FACTORS_REPORT.md',
    content: report 
  });
});

// Export human factors data for external use
router.get('/human-factors/export', (req: Request, res: Response) => {
  let data = loadHumanFactorsData();
  if (!data) {
    data = initializeHumanFactorsData();
  }
  
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Content-Disposition', 'attachment; filename="human-factors-data.json"');
  res.json(data);
});

export default router;
