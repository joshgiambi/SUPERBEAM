/**
 * RT Dose Module - Public API
 * 
 * Provides all exports for radiotherapy dose visualization.
 */

// Context and hooks
export { DoseProvider, useDose, useDoseOptional } from './dose-context';
export type { DoseLoadStatus, DoseOverlayRequest } from './dose-context';

// Components - re-exported from dicom components
export { 
  RTDoseOverlay as DoseOverlay,
  DoseLegend,
} from '@/components/dicom/rt-dose-overlay';

// Floating control panel (like fusion toolbar)
export { DoseControlPanel } from '@/components/dicom/dose-control-panel';

// Core dose manager
export {
  RTDoseManager,
  applyDoseColormap,
  getIsodoseColor,
  formatDose,
  calculateDoseStatistics,
  getDefaultDoseConfig,
  ISODOSE_COLORS,
} from '@/lib/rt-dose-manager';

export type {
  DoseColormap,
  RTDoseConfig,
  RTDoseMetadata,
  RTDoseSlice,
  IsodoseLine,
  DoseOverlayCanvas,
} from '@/lib/rt-dose-manager';

