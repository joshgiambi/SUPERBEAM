# Superstructure Feature Implementation

## Overview
The Superstructure system provides automatic tracking and regeneration of boolean operation-derived structures. When you create a structure using boolean operations (e.g., `Contour A + Contour B = Contour C`), the system remembers the operation and automatically regenerates the result when source structures are edited.

## Key Features

### 1. **Operation Lineage Tracking**
- Every boolean operation is stored with its complete metadata
- Tracks source structures, operation expression, and operation type
- Preserves operation history even if source structures are renamed

### 2. **Auto-Update on Source Changes**
- When any source structure (input to a boolean operation) is edited, superstructures that depend on it are automatically regenerated
- Can be toggled on/off per superstructure
- Runs asynchronously to avoid blocking the UI

### 3. **Dedicated UI Component**
- Superstructures are displayed separately in the series list
- Shows operation summary and source structure list
- Provides controls for:
  - Manual regeneration
  - Auto-update toggle
  - Deletion
  - Navigation to source structures

### 4. **Smart Operation Detection**
- Automatically determines operation type (union, intersection, subtraction, XOR, or complex)
- Supports complex multi-operation expressions
- Handles nested operations correctly

## Architecture

### Database Schema

#### `rt_superstructures` Table
```sql
CREATE TABLE rt_superstructures (
  id SERIAL PRIMARY KEY,
  rt_structure_id INTEGER NOT NULL,           -- The resulting structure
  rt_structure_set_id INTEGER NOT NULL,       -- Parent structure set
  source_structure_ids INTEGER[] NOT NULL,    -- Input structure IDs
  source_structure_names TEXT[] NOT NULL,     -- For display
  operation_expression TEXT NOT NULL,         -- e.g., "A ∪ B - C"
  operation_type TEXT NOT NULL,               -- union|intersect|subtract|xor|complex
  auto_update BOOLEAN NOT NULL DEFAULT true,  -- Enable/disable auto-regen
  last_updated TIMESTAMP NOT NULL,
  created_at TIMESTAMP NOT NULL
);
```

### Components

#### 1. `SuperstructureManager` Component
**Location**: `client/src/components/dicom/SuperstructureManager.tsx`

**Purpose**: Displays and manages superstructures in the UI

**Features**:
- Lists all superstructures for a structure set
- Shows operation summary with formatted expression
- Displays source structures with visual color indicators
- Provides regenerate, delete, and auto-update controls
- Expandable details view

#### 2. `useSuperstructures` Hook
**Location**: Same file as `SuperstructureManager`

**Purpose**: Manages superstructure state and operations

**API**:
```typescript
const {
  superstructures,                    // Current superstructures
  isLoading,                          // Loading state
  error,                              // Error state
  createSuperstructure,               // Create new superstructure
  regenerateSuperstructure,           // Manually regenerate
  deleteSuperstructure,               // Delete superstructure
  toggleAutoUpdate,                   // Toggle auto-update setting
  checkAndRegenerateAutoUpdates,      // Check if auto-regen needed
  reload                              // Reload from server
} = useSuperstructures(rtStructureSetId);
```

### Server Routes

#### GET `/api/superstructures/:rtStructureSetId`
Get all superstructures for a structure set

#### POST `/api/superstructures`
Create a new superstructure
```json
{
  "rtStructureId": 123,
  "rtStructureSetId": 456,
  "sourceStructureIds": [1, 2],
  "sourceStructureNames": ["GTV", "CTV"],
  "operationExpression": "GTV ∪ CTV",
  "operationType": "union",
  "autoUpdate": true
}
```

#### POST `/api/superstructures/:id/regenerate`
Manually regenerate a superstructure

#### PUT `/api/superstructures/:id/auto-update`
Update auto-update setting
```json
{
  "autoUpdate": true
}
```

#### DELETE `/api/superstructures/:id`
Delete a superstructure

#### POST `/api/superstructures/check-auto-update`
Check and regenerate auto-update enabled superstructures
```json
{
  "rtStructureSetId": 456,
  "modifiedStructureIds": [1, 2, 3]
}
```

## User Workflow

### Creating a Superstructure

1. Open the Boolean Operations panel
2. Enter an expression like: `GTV ∪ CTV - SpinalCord`
3. **Enable "🔄 Auto-Update" toggle** (ON by default) - This determines if the operation should be saved as a superstructure
   - **ON**: The result will auto-regenerate when source structures change
   - **OFF**: The result is a normal structure with no tracking
4. Click "Apply"
5. The result structure is created
6. If Auto-Update was enabled, a superstructure record is automatically created in the background
7. The superstructure appears in the "Superstructures" section below the normal structures

### Viewing Superstructures

1. Navigate to the Structures accordion in the series selector
2. Scroll to the bottom to see the "Superstructures" section
3. Each superstructure shows:
   - Result structure name with color indicator
   - Auto-update status (🔄 Auto or ⏸ Manual)
   - Expand button for details

### Managing Superstructures

**Expand Details**:
- Click on a superstructure to expand
- Shows:
  - Full operation expression
  - Operation type
  - Source structures list
  - Auto-update toggle
  - Creation and update timestamps

**Manual Regeneration**:
- Click the refresh icon (🔄)
- Immediately regenerates the superstructure using current source structures

**Toggle Auto-Update**:
- Use the switch in the expanded view
- When enabled, automatically regenerates when source structures change
- When disabled, requires manual regeneration

**Delete**:
- Click the delete icon (🗑️)
- Removes the superstructure metadata
- Does not delete the result structure itself

## Technical Details

### Auto-Update Detection

The auto-update system hooks into the contour save mechanism:

1. When structures are saved, `saveContourUpdates` is called
2. After successful save, a check is made to `/api/superstructures/check-auto-update`
3. The server identifies superstructures that depend on modified structures
4. Returns list of superstructures that need regeneration
5. Client receives notification and can optionally reload structures

**Note**: Actual regeneration is currently handled server-side by updating timestamps. Full regeneration logic needs to be implemented to actually recompute contours.

### Operation Type Detection

The system automatically determines operation type from the expression:

```typescript
// Single operation types
"A ∪ B" → union
"A ∩ B" → intersect
"A - B" → subtract
"A ⊕ B" → xor

// Complex expressions
"A ∪ B - C" → complex
"(A ∩ B) ∪ (C - D)" → complex
```

### Expression Formatting

Expressions are stored with Unicode operators and displayed with formatting:

- `∪` for union
- `∩` for intersection
- `−` for subtraction
- `⊕` for XOR

## Future Enhancements

### Phase 2 - Full Auto-Regeneration
Currently, auto-update only marks superstructures as needing regeneration. Phase 2 will:
- Implement actual contour regeneration server-side
- Cache boolean operation results for performance
- Provide progress feedback for long operations
- Support batch regeneration

### Phase 3 - Advanced Features
- **Dependency Visualization**: Show dependency graph of superstructures
- **Cascade Updates**: Handle chains of superstructures (A→B→C)
- **Version History**: Track regeneration history
- **Performance Optimization**: Incremental updates instead of full regeneration
- **Conflict Resolution**: Handle circular dependencies

### Phase 4 - UI Enhancements
- Drag-and-drop to create new operations
- Visual expression builder
- Real-time preview of operations
- Undo/redo for superstructure operations

## Migration

To apply the database migration:

```bash
# Using Drizzle migrations
npx drizzle-kit push

# Or manually run the migration SQL
psql $DATABASE_URL < migrations/0001_add_superstructures_table.sql
```

## Testing the Feature

### Manual Testing Steps

1. **Create a Superstructure**:
   ```
   - Load a patient with RT structures
   - Open Boolean Operations panel
   - Enter: "GTV ∪ CTV"
   - Click Apply
   - Verify superstructure appears in list
   ```

2. **Test Auto-Update**:
   ```
   - Edit one of the source structures (GTV or CTV)
   - Save changes
   - Check console for auto-regeneration message
   - Verify superstructure shows updated timestamp
   ```

3. **Test Manual Regeneration**:
   ```
   - Expand a superstructure
   - Click the refresh icon
   - Verify loading state
   - Verify success message
   ```

4. **Test Auto-Update Toggle**:
   ```
   - Expand a superstructure
   - Toggle auto-update off
   - Edit source structure
   - Verify no auto-regeneration occurs
   - Toggle auto-update on
   - Verify auto-regeneration resumes
   ```

5. **Test Deletion**:
   ```
   - Click delete icon on a superstructure
   - Verify it disappears from list
   - Verify result structure still exists
   ```

## Console Messages

The system uses distinctive emoji prefixes for logging:

- `🏗️` Creating superstructure
- `✅` Superstructure created successfully
- `🔄` Auto-regenerating superstructures
- `⚠️` Warnings and errors

## Known Limitations

1. **Server-Side Regeneration**: Currently only updates timestamps, not actual contours
2. **No Circular Dependency Detection**: System doesn't prevent A→B→A cycles
3. **No Progress Feedback**: Long operations don't show progress
4. **Single-Level Dependencies**: Doesn't handle chains of superstructures optimally

## Troubleshooting

### Superstructures Not Appearing
- Check browser console for errors
- Verify `rtStructures.seriesId` is set
- Check network tab for API call failures

### Auto-Update Not Working
- Verify auto-update is enabled on superstructure
- Check if source structure IDs match
- Look for errors in server console

### Regeneration Fails
- Check if source structures still exist
- Verify operation expression is valid
- Check server logs for detailed errors

## API Response Examples

### List Superstructures
```json
[
  {
    "id": 1,
    "rtStructureId": 10,
    "rtStructureSetId": 5,
    "sourceStructureIds": [1, 2],
    "sourceStructureNames": ["GTV", "CTV"],
    "operationExpression": "GTV ∪ CTV",
    "operationType": "union",
    "autoUpdate": true,
    "lastUpdated": "2025-10-31T12:00:00Z",
    "createdAt": "2025-10-31T10:00:00Z"
  }
]
```

### Create Superstructure Response
```json
{
  "id": 2,
  "rtStructureId": 11,
  "rtStructureSetId": 5,
  "sourceStructureIds": [1, 2, 3],
  "sourceStructureNames": ["GTV", "CTV", "SpinalCord"],
  "operationExpression": "GTV ∪ CTV - SpinalCord",
  "operationType": "complex",
  "autoUpdate": true,
  "lastUpdated": "2025-10-31T12:30:00Z",
  "createdAt": "2025-10-31T12:30:00Z"
}
```

### Check Auto-Update Response
```json
{
  "success": true,
  "regeneratedCount": 2,
  "regeneratedIds": [1, 2]
}
```

## Code Organization

```
client/src/
  components/dicom/
    SuperstructureManager.tsx       # Main component + hook
    series-selector.tsx             # Integrated display
    viewer-interface.tsx            # Boolean operation integration
    working-viewer.tsx              # Auto-update trigger
  types/
    rt-structures.ts                # TypeScript types

server/
  storage.ts                        # Database operations
  routes.ts                         # API endpoints

shared/
  schema.ts                         # Database schema

migrations/
  0001_add_superstructures_table.sql  # Initial migration
```

## Support and Feedback

For issues or feature requests related to superstructures, check:
1. Browser console for client-side errors
2. Server logs for API errors
3. Network tab for failed requests
4. Database logs for query issues

