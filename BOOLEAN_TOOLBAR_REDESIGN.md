# Boolean Operations Toolbar - Multi-Step Redesign Proposal

## Executive Summary

The current boolean toolbar supports single operations (A ∪ B → C) but lacks native multi-step workflow support. This proposal introduces a **numbered, stepwise operation builder** that allows users to:

1. Chain multiple operations together
2. Visualize operation sequences clearly
3. Save and reuse complex workflows
4. Track intermediate results
5. Debug and modify operations at any step

## Current State Analysis

### Strengths
- Clean UI with expression and panel modes
- Template library for saving operations
- Live preview functionality
- Superstructure auto-update support
- Color-coded visual feedback

### Limitations
- Only handles single binary operations (A op B → C)
- No native support for operation chains like: (A ∪ B) ∩ C → D
- Expression mode is powerful but has a steep learning curve
- No intermediate result visualization
- Difficult to debug complex operations

## Proposed Design: Stepwise Operation Builder

### Core Concept: "Operation Pipeline"

Replace the single-operation panel with a **pipeline of numbered steps**, where each step represents one operation. Users can add, remove, reorder, and modify steps.

### Visual Design Inspiration

**Inspired by:**
1. **Blender's Node Editor** - Visual graph-based operations
2. **Substance Designer** - Color-coded operation chains
3. **Figma's Boolean Operations** - Non-destructive, stackable operations
4. **VennPad** - Visual Venn diagram representations
5. **Rule Builders** - Step-by-step condition building

### Three-Tier UI Structure

```
┌─────────────────────────────────────────────────────────┐
│ TIER 1: MODE SELECTOR & GLOBAL ACTIONS                 │
├─────────────────────────────────────────────────────────┤
│ TIER 2: OPERATION PIPELINE (Numbered Steps)            │
├─────────────────────────────────────────────────────────┤
│ TIER 3: OUTPUT CONFIGURATION & EXECUTION               │
└─────────────────────────────────────────────────────────┘
```

## Detailed UI Specification

### TIER 1: Mode Selector & Global Actions

```
┌────────────────────────────────────────────────────────────────┐
│ ⚡ Boolean Operations                               [Library] │
│ ● Simple  ○ Pipeline  ○ Expression                   [Save]   │
│                                                       [Clear]  │
└────────────────────────────────────────────────────────────────┘
```

**Three Modes:**
1. **Simple Mode** - Current single-operation panel (A op B → C)
2. **Pipeline Mode** - NEW: Multi-step numbered operations
3. **Expression Mode** - Existing text-based operations

### TIER 2: Pipeline Builder (New Design)

```
┌─────────────────────────────────────────────────────────────────┐
│ OPERATION PIPELINE                                              │
│                                                                 │
│ ┌─────────────────────────────────────────────────────────┐   │
│ │ ① STEP 1                                        [×] [⋮] │   │
│ │                                                           │   │
│ │   [Structure A ▼]  [∪ Union ▼]  [Structure B ▼]         │   │
│ │   🟢 CTV         →    ∪       ←  🔵 GTV                 │   │
│ │                                                           │   │
│ │   → Result: temp_step1  [👁 Preview]                    │   │
│ └─────────────────────────────────────────────────────────┘   │
│                          ↓                                      │
│ ┌─────────────────────────────────────────────────────────┐   │
│ │ ② STEP 2                                        [×] [⋮] │   │
│ │                                                           │   │
│ │   [temp_step1 ▼]  [∩ Intersect ▼]  [BODY ▼]            │   │
│ │   🟡 temp_step1  →    ∩         ←  ⚪ BODY              │   │
│ │                                                           │   │
│ │   → Result: temp_step2  [👁 Preview]                    │   │
│ └─────────────────────────────────────────────────────────┘   │
│                          ↓                                      │
│ ┌─────────────────────────────────────────────────────────┐   │
│ │ + Add Step                                                │   │
│ └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

### TIER 3: Output Configuration

```
┌─────────────────────────────────────────────────────────────────┐
│ OUTPUT                                                          │
│                                                                 │
│ ○ Update Existing: [temp_step2 ▼]                             │
│ ● Create New: [PTV_Final_______] [🎨 Color]                   │
│                                                                 │
│ ☑ Save as Superstructure (auto-regenerate)                    │
│                                                                 │
│ [Preview All Steps]        [Execute Pipeline →]                │
└─────────────────────────────────────────────────────────────────┘
```

## Key Features

### 1. Numbered Steps with Visual Flow
- Each step is clearly numbered (①, ②, ③, etc.)
- Visual arrows show data flow between steps
- Color-coded structure indicators match viewport colors
- Collapsible steps for complex pipelines

### 2. Intermediate Results
- Each step produces a named intermediate result
- Auto-named as `temp_step1`, `temp_step2`, etc.
- Can be previewed individually
- Available as inputs to subsequent steps

### 3. Step Management
- **Add Step**: Insert new operation at any position
- **Delete Step**: Remove with confirmation
- **Reorder Steps**: Drag-and-drop or arrow buttons
- **Duplicate Step**: Clone with modification
- **Collapse/Expand**: Minimize for overview

### 4. Smart Input Selection
Dropdown for inputs shows:
- Original structures (from RT Structure Set)
- Intermediate results (from previous steps)
- Recently used structures (at top)

### 5. Per-Step Preview
- Individual step preview: Show result of single step
- Cumulative preview: Show result up to selected step
- Final preview: Show complete pipeline result

### 6. Visual Operation Indicators

**Operation Symbols with Color Coding:**
```
∪ Union      - Green background   (additive)
∩ Intersect  - Blue background    (restrictive)
− Subtract   - Red background     (subtractive)
⊕ XOR        - Purple background  (exclusive)
```

### 7. Error Prevention & Validation

**Real-time Validation:**
- ⚠️ Warning if structure doesn't exist in current slices
- ❌ Error if circular dependency detected
- ✓ Success indicator when step is valid

**Smart Defaults:**
- First step defaults to available structures
- Subsequent steps default to previous result as input A

### 8. Pipeline Templates

Enhanced template system:
```json
{
  "name": "PTV Expansion with Body Constraint",
  "description": "Create PTV from CTV+GTV, expand, constrain to BODY",
  "steps": [
    {
      "number": 1,
      "operation": "union",
      "inputA": "CTV",
      "inputB": "GTV",
      "result": "CTV_GTV_combined"
    },
    {
      "number": 2,
      "operation": "expand",
      "input": "CTV_GTV_combined",
      "margin": "5mm",
      "result": "PTV_expanded"
    },
    {
      "number": 3,
      "operation": "intersect",
      "inputA": "PTV_expanded",
      "inputB": "BODY",
      "result": "PTV_final"
    }
  ],
  "output": {
    "mode": "new",
    "name": "PTV_Final",
    "color": "#FF6B6B",
    "saveAsSuperstructure": true
  }
}
```

### 9. Compact "Mini" View

For completed pipelines, show compact summary:
```
┌──────────────────────────────────────────────┐
│ Pipeline: PTV Expansion (3 steps)    [Edit] │
│ CTV ∪ GTV → expand 5mm → ∩ BODY              │
└──────────────────────────────────────────────┘
```

## Enhanced Workflow Examples

### Example 1: Basic PTV Creation
```
Step 1: CTV ∪ GTV → temp_ptv_base
Step 2: temp_ptv_base − SpinalCord → PTV_Final
Output: Create New "PTV_Final"
```

### Example 2: Complex Organ Avoidance
```
Step 1: Parotid_L ∪ Parotid_R → temp_parotids
Step 2: Mandible ∪ temp_parotids → temp_critical_structures  
Step 3: PTV ∩ temp_critical_structures → PTV_overlap
Step 4: PTV − PTV_overlap → PTV_optimized
Output: Update Existing "PTV"
```

### Example 3: QA Check
```
Step 1: CTV_High ∪ CTV_Low → temp_all_CTV
Step 2: PTV − temp_all_CTV → PTV_margin_only
Output: Create New "QA_PTV_Margin" (verify it's uniform)
```

## Implementation Phases

### Phase 1: Core Pipeline UI (Week 1)
- [ ] Create `BooleanPipelineMode` component
- [ ] Implement step add/remove/reorder
- [ ] Basic numbered step rendering
- [ ] Intermediate result naming system

### Phase 2: Execution Engine (Week 1-2)
- [ ] Sequential step execution
- [ ] Intermediate result caching
- [ ] Error handling per step
- [ ] Progress indicators

### Phase 3: Preview System (Week 2)
- [ ] Per-step preview
- [ ] Cumulative preview
- [ ] Preview navigation (step through results)

### Phase 4: Templates & Persistence (Week 3)
- [ ] Enhanced template structure
- [ ] Pipeline save/load
- [ ] Template sharing (export/import JSON)
- [ ] Common workflow templates library

### Phase 5: Polish & Advanced Features (Week 3-4)
- [ ] Drag-and-drop reordering
- [ ] Step duplication
- [ ] Undo/redo for pipeline edits
- [ ] Keyboard shortcuts
- [ ] Accessibility improvements

## Technical Architecture

### Data Structure

```typescript
interface PipelineStep {
  id: string;
  number: number;
  operation: BooleanOp | 'expand' | 'contract';
  inputA: string; // structure name or temp result
  inputB?: string; // optional for binary ops
  parameters?: {
    margin?: number; // for expand/contract
    // future: anisotropic margins, etc.
  };
  result: string; // intermediate result name
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

interface BooleanPipeline {
  id: string;
  name: string;
  description?: string;
  steps: PipelineStep[];
  output: {
    mode: 'existing' | 'new';
    targetName?: string;
    newName?: string;
    color?: string;
    saveAsSuperstructure: boolean;
  };
  createdAt: number;
  modifiedAt: number;
}

interface PipelineExecutionState {
  currentStep: number;
  intermediateResults: Map<string, ContourData[]>;
  errors: Map<number, string>;
  isExecuting: boolean;
  progress: number; // 0-100
}
```

### Component Structure

```
BooleanOperationsToolbar
├── SimpleModePanel (existing)
├── ExpressionModePanel (existing)
└── PipelineModePanel (new)
    ├── PipelineStepList
    │   └── PipelineStep (repeatable)
    │       ├── StepHeader (number, controls)
    │       ├── StepInputs (A, B selection)
    │       ├── StepOperation (op selection)
    │       ├── StepResult (preview button)
    │       └── StepValidation (errors/warnings)
    ├── PipelineOutputConfig
    └── PipelineExecutionControls
```

## Responsive Design Considerations

### Large Screens (>1400px)
- Show all steps expanded
- Side-by-side step comparison option
- Preview panel alongside pipeline

### Medium Screens (900-1400px)
- Collapsible steps
- Compact controls
- Vertical stacking

### Small Screens (<900px)
- One step at a time (accordion style)
- Floating action buttons
- Fullscreen pipeline editor

## Accessibility Features

1. **Keyboard Navigation**
   - Tab through steps
   - Arrow keys to navigate steps
   - Enter to edit, Escape to cancel

2. **Screen Reader Support**
   - ARIA labels for all controls
   - Step announcements: "Step 1 of 3: Union operation"
   - Result announcements

3. **Visual Clarity**
   - High contrast mode support
   - Larger touch targets (44x44px minimum)
   - Clear focus indicators

## User Testing Scenarios

1. **Novice User**: Create simple PTV from CTV+GTV
2. **Intermediate User**: Build 3-step avoidance structure
3. **Advanced User**: Create complex 5+ step QA workflow
4. **Clinical Workflow**: Save and reuse institutional templates

## Success Metrics

- **Efficiency**: 50% reduction in time for multi-step operations
- **Error Rate**: 30% fewer boolean operation errors
- **Adoption**: 80% of users prefer pipeline mode for complex tasks
- **Satisfaction**: >4.5/5 user satisfaction rating

## Future Enhancements

### Advanced Operations (Phase 6+)
- **Margin operations** integrated as steps
- **Branching pipelines** (conditional steps)
- **Parallel operations** (A∪B and C∪D simultaneously)
- **Loops** (repeat operation on multiple structures)

### Visualization
- **3D preview** of intermediate results
- **Graph view** (node-based visual editor)
- **Diff view** (compare step results)

### Collaboration
- **Share pipelines** across users
- **Version control** for templates
- **Comments** on steps

### AI Integration
- **Suggest next step** based on patterns
- **Auto-optimize** pipeline (remove redundant steps)
- **Smart naming** for results

## Conclusion

The proposed stepwise pipeline design transforms the boolean toolbar from a single-operation tool into a powerful multi-step workflow builder. The numbered, visual approach:

✅ **Reduces cognitive load** - Clear step-by-step progression  
✅ **Prevents errors** - Validation at each step  
✅ **Enables complexity** - Support for 5+ step operations  
✅ **Improves debugging** - Preview individual steps  
✅ **Facilitates learning** - Visual representation of operations  
✅ **Encourages reuse** - Template-based workflows  

This design positions SuperBeam as a leader in contour manipulation capabilities, matching or exceeding commercial treatment planning systems while maintaining an intuitive, modern UI.

---

**Next Steps:**
1. Review this proposal with stakeholders
2. Create high-fidelity mockups in Figma
3. Build Phase 1 prototype
4. User testing with clinical workflow scenarios
5. Iterate based on feedback

**Questions for Discussion:**
- Should we support margin operations in the pipeline?
- How many steps should be the practical maximum?
- Should intermediate results be automatically cleaned up?
- Do we need a visual graph editor mode (node-based)?








