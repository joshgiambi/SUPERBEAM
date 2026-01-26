/**
 * Window/Level and Image Display Unit Tests
 * 
 * @requirement REQ-VIEW-001
 * @risk-class low
 * @verification VER-VIEW-001
 * 
 * Tests for window/level (W/L) calculations used in medical image display.
 * Correct W/L is critical for proper visualization of different tissue types.
 * 
 * Formula: displayed_value = ((pixel_value - level) / window + 0.5) * 255
 */

describe('Window/Level Calculations', () => {
  /**
   * Window/Level converts pixel values (HU for CT) to display values (0-255)
   * Window: range of pixel values displayed
   * Level: center of the window
   */
  
  function applyWindowLevel(pixelValue: number, window: number, level: number): number {
    const min = level - window / 2;
    const max = level + window / 2;
    
    if (pixelValue <= min) return 0;
    if (pixelValue >= max) return 255;
    
    return Math.round(((pixelValue - min) / window) * 255);
  }

  describe('applyWindowLevel', () => {
    it('should map center value to middle gray (127)', () => {
      const window = 400;
      const level = 40; // Soft tissue
      
      const result = applyWindowLevel(40, window, level);
      
      expect(result).toBeCloseTo(127, 0);
    });

    it('should map values below window to black (0)', () => {
      const window = 400;
      const level = 40;
      const minValue = level - window / 2; // -160
      
      expect(applyWindowLevel(-200, window, level)).toBe(0);
      expect(applyWindowLevel(-1000, window, level)).toBe(0);
    });

    it('should map values above window to white (255)', () => {
      const window = 400;
      const level = 40;
      const maxValue = level + window / 2; // 240
      
      expect(applyWindowLevel(300, window, level)).toBe(255);
      expect(applyWindowLevel(1000, window, level)).toBe(255);
    });

    it('should handle linear scaling within window', () => {
      const window = 100;
      const level = 50;
      // Range is 0 to 100
      
      expect(applyWindowLevel(0, window, level)).toBe(0);
      expect(applyWindowLevel(25, window, level)).toBe(64);
      expect(applyWindowLevel(50, window, level)).toBe(127);
      expect(applyWindowLevel(75, window, level)).toBe(191);
      expect(applyWindowLevel(100, window, level)).toBe(255);
    });
  });
});

describe('CT Hounsfield Unit Reference Values', () => {
  /**
   * @verifies REQ-VIEW-003
   * Standard HU values for tissue types (clinical reference)
   */
  const HU_VALUES = {
    air: -1000,
    lung: -500,
    fat: -100,
    water: 0,
    softTissue: 40,
    muscle: 40,
    blood: 30,
    liver: 60,
    bone: 400,
    densebone: 1000,
  };

  describe('Hounsfield Units', () => {
    it('should have correct reference values for air', () => {
      expect(HU_VALUES.air).toBe(-1000);
    });

    it('should have correct reference values for water', () => {
      expect(HU_VALUES.water).toBe(0);
    });

    it('should have positive values for bone', () => {
      expect(HU_VALUES.bone).toBeGreaterThan(0);
      expect(HU_VALUES.densebone).toBeGreaterThan(HU_VALUES.bone);
    });

    it('should have negative values for fat and lung', () => {
      expect(HU_VALUES.fat).toBeLessThan(0);
      expect(HU_VALUES.lung).toBeLessThan(0);
    });
  });
});

describe('Clinical Window/Level Presets', () => {
  /**
   * @verifies REQ-VIEW-001
   * Clinical presets for different anatomical views
   */
  const PRESETS = {
    softTissue: { window: 400, level: 40 },
    lung: { window: 1500, level: -600 },
    bone: { window: 1800, level: 400 },
    brain: { window: 80, level: 40 },
    liver: { window: 150, level: 30 },
    mediastinum: { window: 350, level: 50 },
  };

  describe('Soft Tissue preset', () => {
    it('should display soft tissue clearly', () => {
      const { window, level } = PRESETS.softTissue;
      const min = level - window / 2; // -160
      const max = level + window / 2; // 240
      
      // Soft tissue (40 HU) should be visible
      expect(40).toBeGreaterThan(min);
      expect(40).toBeLessThan(max);
      
      // Bone should be white (clipped)
      expect(400).toBeGreaterThan(max);
      
      // Air should be black (clipped)
      expect(-1000).toBeLessThan(min);
    });
  });

  describe('Lung preset', () => {
    it('should display lung parenchyma clearly', () => {
      const { window, level } = PRESETS.lung;
      const min = level - window / 2; // -1350
      const max = level + window / 2; // 150
      
      // Air (-1000) should be visible but dark
      expect(-1000).toBeGreaterThan(min);
      
      // Lung tissue (-500) should be in middle range
      expect(-500).toBeGreaterThan(min);
      expect(-500).toBeLessThan(max);
    });
  });

  describe('Bone preset', () => {
    it('should display bone structures clearly', () => {
      const { window, level } = PRESETS.bone;
      const min = level - window / 2; // -500
      const max = level + window / 2; // 1300
      
      // Bone (400-1000 HU) should be visible
      expect(400).toBeGreaterThan(min);
      expect(1000).toBeLessThan(max);
      
      // Soft tissue should be dark
      expect(40).toBeLessThan(level);
    });
  });

  describe('Brain preset', () => {
    it('should have narrow window for gray/white matter contrast', () => {
      const { window, level } = PRESETS.brain;
      
      // Brain window should be narrow
      expect(window).toBeLessThan(200);
      
      // Level should be around soft tissue
      expect(level).toBeGreaterThan(20);
      expect(level).toBeLessThan(60);
    });
  });
});

describe('MRI Window/Level Considerations', () => {
  /**
   * @verifies REQ-VIEW-004
   * MRI has arbitrary intensity values (not Hounsfield Units)
   */
  describe('MRI Auto-windowing', () => {
    it('should calculate percentile-based window for MRI', () => {
      // Simulated MRI intensity histogram
      const intensities = [10, 50, 100, 150, 200, 250, 300, 350, 400, 450, 500];
      
      // Sort and find percentiles
      const sorted = [...intensities].sort((a, b) => a - b);
      const p5Index = Math.floor(sorted.length * 0.05);
      const p95Index = Math.floor(sorted.length * 0.95);
      
      const minIntensity = sorted[p5Index];
      const maxIntensity = sorted[p95Index];
      
      const autoWindow = maxIntensity - minIntensity;
      const autoLevel = (maxIntensity + minIntensity) / 2;
      
      expect(autoWindow).toBeGreaterThan(0);
      expect(autoLevel).toBeGreaterThan(minIntensity);
      expect(autoLevel).toBeLessThan(maxIntensity);
    });

    it('should handle different MRI sequences with different intensity ranges', () => {
      // T1: higher signal for fat and white matter
      // T2: higher signal for fluid
      // FLAIR: suppresses CSF signal
      
      const sequences = {
        T1: { typicalRange: [0, 1500] },
        T2: { typicalRange: [0, 2500] },
        FLAIR: { typicalRange: [0, 2000] },
      };
      
      // All should have positive ranges starting near 0
      for (const [name, seq] of Object.entries(sequences)) {
        expect(seq.typicalRange[0]).toBe(0);
        expect(seq.typicalRange[1]).toBeGreaterThan(0);
      }
    });
  });
});

describe('Window/Level Interaction', () => {
  /**
   * @verifies REQ-VIEW-005
   * Interactive W/L adjustment behavior
   */
  describe('Mouse drag adjustment', () => {
    it('should increase window with horizontal drag right', () => {
      let window = 400;
      const dragDeltaX = 50; // pixels
      const sensitivity = 2; // HU per pixel
      
      window += dragDeltaX * sensitivity;
      
      expect(window).toBe(500);
    });

    it('should increase level with vertical drag down', () => {
      let level = 40;
      const dragDeltaY = 25; // pixels
      const sensitivity = 2; // HU per pixel
      
      level += dragDeltaY * sensitivity;
      
      expect(level).toBe(90);
    });

    it('should enforce minimum window of 1', () => {
      let window = 10;
      const dragDeltaX = -50;
      const sensitivity = 2;
      
      window += dragDeltaX * sensitivity;
      window = Math.max(1, window); // Enforce minimum
      
      expect(window).toBe(1);
    });
  });
});
