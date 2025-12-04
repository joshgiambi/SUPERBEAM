# RT Structure UI Fixes - Completed

## Changes Made

### ✅ 1. History Button Integrated Into RT Structure Card

**Before:** History and Save buttons appeared as separate buttons next to the RT structure card.

**After:** History button is now integrated INSIDE the RT structure card itself (similar to fusion buttons), appearing on the right side of the card with `justify-between` layout.

**Location:** `client/src/components/dicom/series-selector.tsx` (lines ~1751-1791)

**Changes:**
- Removed separate button row structure
- Integrated history button directly into the RT structure button using flexbox `justify-between`
- History button now appears on the right edge within the same card
- Removed the purple "Save As New" button from this location entirely

### ✅ 2. Removed Save Button from Series Panel

**Before:** Purple "Save" icon appeared next to history button in series selection area.

**After:** Completely removed from series selector panel.

**Rationale:** Save functionality is more contextual to structures, not series selection.

### ✅ 3. Added Save Button to Structures Accordion

**Location:** `client/src/components/dicom/series-selector.tsx` (lines ~2074-2094)

**Implementation:**
- Added green "Save" button next to purple "Settings" button
- Button is disabled when no RT structure set is loaded
- Opens "Save As New" dialog when clicked
- Styled consistently with other toolbar buttons (green theme)
- Includes tooltip: "Save As New"

**Visual:**
```
[Eye] [FolderTree] [Sort] [+] [Settings] [Save]
                                  ^         ^
                                 purple   green
```

### ✅ 4. Topbar Save Button

**Status:** No save button currently exists in the topbar/toolbar.

**Note:** The `viewer-toolbar.tsx` component does not currently have a save/export button. If one needs to be added:
- Would need to add to `ViewerToolbarProps` interface
- Add button in toolbar layout
- Wire up to call save function
- Should trigger the same "Save As New" dialog

## UI Pattern Now Matches Fusion Buttons

The RT structure history button now follows the same pattern as fusion buttons:
- Integrated into the card itself
- Positioned on the right side
- Uses icon-only button style
- Click stops propagation to prevent card selection

## Code Structure

### RT Structure Card Layout:
```tsx
<Button onClick={handleRTSeriesSelect} className="justify-between">
  <div className="flex items-center gap-2">
    <Badge>RT</Badge>
    <span>{seriesDescription}</span>
  </div>
  
  <Tooltip>
    <Button onClick={handleHistory} className="flex-shrink-0">
      <History />
    </Button>
  </Tooltip>
</Button>
```

### Save Button in Structures Accordion:
```tsx
<Tooltip>
  <Button 
    onClick={() => setSaveAsNewDialog(true)}
    disabled={!selectedRTSeries}
    className="bg-green-500/10 border-green-500/30..."
  >
    <Save className="w-4 h-4" />
  </Button>
</Tooltip>
```

## Remaining Questions

1. **Topbar Save Button:** User mentioned a save button in the topbar "beside export" - this doesn't currently exist. Should we:
   - Add a new save button to the toolbar?
   - Use an existing button?
   - Skip this requirement?

2. **Primary RT Structures:** User mentioned applying to "primary RT structure sets nested directly under the primary/CT scan" - the current implementation handles RT structures shown under CT scans in the PET-CT fusion cards. Are there other locations where RT structures are displayed that need this treatment?

## Files Modified

- `client/src/components/dicom/series-selector.tsx`
  - Lines ~1751-1791: RT structure card with integrated history button
  - Lines ~2074-2094: Save button added to structures accordion toolbar

## Testing Recommendations

1. **History Button Integration:**
   - Click RT structure card - should select the structure set
   - Click history button - should open history modal without selecting
   - Verify button appears on right edge of card
   - Check tooltip appears on hover

2. **Save Button in Accordion:**
   - Verify button is disabled when no RT structures loaded
   - Click save button - should open "Save As New" dialog
   - Verify green styling matches design
   - Check tooltip

3. **Visual Consistency:**
   - Compare RT structure card layout to fusion button cards
   - Verify consistent spacing and alignment
   - Test on different screen sizes


