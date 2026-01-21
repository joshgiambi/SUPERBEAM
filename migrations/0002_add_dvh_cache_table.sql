-- Migration: Add DVH Cache Table
-- Purpose: Persistent storage for pre-computed Dose-Volume Histogram data
-- This enables instant DVH loading by storing computed results in the database

CREATE TABLE IF NOT EXISTS dvh_cache (
    id SERIAL PRIMARY KEY,
    dose_series_id INTEGER NOT NULL REFERENCES series(id) ON DELETE CASCADE,
    structure_set_series_id INTEGER NOT NULL REFERENCES series(id) ON DELETE CASCADE,
    prescription_dose DOUBLE PRECISION NOT NULL,
    dvh_data JSONB NOT NULL,
    computation_time_ms INTEGER,
    structure_count INTEGER,
    created_at TIMESTAMP DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- Create unique index to prevent duplicate entries for the same dose/struct/rx combination
CREATE UNIQUE INDEX IF NOT EXISTS idx_dvh_cache_unique 
ON dvh_cache(dose_series_id, structure_set_series_id, prescription_dose);

-- Index for fast lookups by dose series
CREATE INDEX IF NOT EXISTS idx_dvh_cache_dose_series 
ON dvh_cache(dose_series_id);

-- Index for cleanup when structure sets are updated
CREATE INDEX IF NOT EXISTS idx_dvh_cache_structure_set 
ON dvh_cache(structure_set_series_id);

COMMENT ON TABLE dvh_cache IS 'Stores pre-computed DVH data for instant loading. DVH calculation is expensive (5-30s) but results are deterministic for the same inputs.';
COMMENT ON COLUMN dvh_cache.dvh_data IS 'JSON containing full DVH response: curves array with points, statistics, volume for each ROI';
COMMENT ON COLUMN dvh_cache.prescription_dose IS 'The prescription dose (Gy) used for V100 calculations - different Rx values require separate DVH entries';
