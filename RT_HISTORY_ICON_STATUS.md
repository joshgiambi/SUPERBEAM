# RT History Icon Status Implementation

## Feature: Grey Out History Icon When No History Available

### Problem
History icons were always blue and clickable, even when there was no history data available for that RT structure set.

### Solution
Added dynamic status checking and visual feedback based on history availability.

## Implementation Details

### 1. State Management

**New State Variable:**
```typescript
const [seriesHistoryStatus, setSeriesHistoryStatus] = useState<Map<number, boolean>>(new Map());
```

Tracks which RT series have history available (true = has history, false = no history).

### 2. History Status Checking

**useEffect Hook (lines 296-321):**
```typescript
useEffect(() => {
  if (rtSeries.length === 0) return;
  
  const checkHistoryStatus = async () => {
    const statusMap = new Map<number, boolean>();
    
    for (const rtS of rtSeries) {
      try {
        const response = await fetch(`/api/rt-structures/${rtS.id}/history?limit=1`);
        if (response.ok) {
          const data = await response.json();
          statusMap.set(rtS.id, data.history && data.history.length > 0);
        } else {
          statusMap.set(rtS.id, false);
        }
      } catch (error) {
        statusMap.set(rtS.id, false);
      }
    }
    
    setSeriesHistoryStatus(statusMap);
  };
  
  checkHistoryStatus();
}, [rtSeries]);
```

**Features:**
- Runs when RT series are loaded/changed
- Fetches only 1 history entry per series (efficient)
- Maps each series ID to boolean status
- Handles errors gracefully (defaults to false)

### 3. Visual Styling

**History Icon Conditional Styling:**

**With History (Blue):**
```typescript
className="text-blue-400 hover:text-blue-300 cursor-pointer"
```

**No History (Grey):**
```typescript
className="text-gray-600 cursor-not-allowed"
```

### 4. Click Behavior

**Conditional Click Handler:**
```typescript
onClick={(e) => {
  e.stopPropagation();
  if (seriesHistoryStatus.get(rtS.id)) {
    setHistorySeriesId(rtS.id);
    setShowHistoryModal(true);
  }
}}
```

- Only opens modal if history exists
- No action when greyed out

### 5. Tooltip Messages

**Dynamic Tooltip:**
```typescript
<TooltipContent>
  <p>{seriesHistoryStatus.get(rtS.id) ? 'View History' : 'No history available'}</p>
</TooltipContent>
```

- "View History" when clickable
- "No history available" when greyed out

### 6. Status Updates

**After Save As New:**
```typescript
onSaveSuccess={(newSeriesId) => {
  // ... reload RT series ...
  
  // Refresh history status (original series now has history)
  if (saveAsNewSeriesId) {
    setSeriesHistoryStatus(prev => new Map(prev).set(saveAsNewSeriesId, true));
  }
}}
```

**Automatically updates** when:
- RT series are loaded/reloaded
- Save As New creates history
- User navigates between patients/studies

## Locations Updated

Both RT structure display locations:

1. **Primary RT Structures** (lines ~1349-1371)
   - Under CT series in main list
   
2. **PET/CT Fusion RT Structures** (lines ~1881-1903)
   - Under CT in fusion groups

## Visual States

### Has History ✅
```
[RT] ARIA RadOnc Structure Sets    🕐 (blue, hoverable)
                                    ↑
                            "View History" tooltip
```

### No History ⚫
```
[RT] ARIA RadOnc Structure Sets    🕐 (grey, disabled)
                                    ↑
                        "No history available" tooltip
```

## User Experience

1. **Initial State**: All icons grey until status check completes
2. **After Check**: Blue if history exists, grey if not
3. **After Save**: Icon turns blue (history created)
4. **Hover**: 
   - Blue icons show "View History"
   - Grey icons show "No history available"
5. **Click**:
   - Blue icons open history modal
   - Grey icons do nothing

## Performance

- Only fetches 1 history entry per series (minimal data transfer)
- Single batch check on RT series load
- Cached in state (no repeated API calls)
- Updates only when necessary

## Files Modified

- `client/src/components/dicom/series-selector.tsx`
  - Line 110: Added state
  - Lines 296-321: Added history status check
  - Lines 1349-1371: Updated primary RT icon
  - Lines 1881-1903: Updated fusion RT icon
  - Line 3142-3144: Update status after save

## Benefits

✅ Clear visual feedback  
✅ Prevents confusion (clicking greyed icon)  
✅ Informs user when history is available  
✅ Automatic updates after saves  
✅ Consistent across all RT displays  



