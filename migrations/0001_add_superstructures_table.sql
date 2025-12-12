-- Migration: Add superstructures table for boolean operation lineage tracking
-- Created: 2025-10-31
-- Description: Adds rt_superstructures table to track boolean operations and enable auto-updates

CREATE TABLE IF NOT EXISTS "rt_superstructures" (
  "id" SERIAL PRIMARY KEY,
  "rt_structure_id" INTEGER NOT NULL REFERENCES "rt_structures"("id"),
  "rt_structure_set_id" INTEGER NOT NULL REFERENCES "rt_structure_sets"("id"),
  "source_structure_ids" INTEGER[] NOT NULL,
  "source_structure_names" TEXT[] NOT NULL,
  "operation_expression" TEXT NOT NULL,
  "operation_type" TEXT NOT NULL,
  "auto_update" BOOLEAN NOT NULL DEFAULT true,
  "last_updated" TIMESTAMP NOT NULL DEFAULT NOW(),
  "created_at" TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS "idx_rt_superstructures_structure_id" ON "rt_superstructures"("rt_structure_id");
CREATE INDEX IF NOT EXISTS "idx_rt_superstructures_structure_set_id" ON "rt_superstructures"("rt_structure_set_id");
CREATE INDEX IF NOT EXISTS "idx_rt_superstructures_auto_update" ON "rt_superstructures"("auto_update");

-- Add comments
COMMENT ON TABLE "rt_superstructures" IS 'Tracks boolean operation lineage for auto-updating structures';
COMMENT ON COLUMN "rt_superstructures"."rt_structure_id" IS 'The resulting structure from the boolean operation';
COMMENT ON COLUMN "rt_superstructures"."source_structure_ids" IS 'Array of source structure IDs used in the operation';
COMMENT ON COLUMN "rt_superstructures"."source_structure_names" IS 'Array of source structure names for display';
COMMENT ON COLUMN "rt_superstructures"."operation_expression" IS 'Boolean expression (e.g., "A ∪ B - C")';
COMMENT ON COLUMN "rt_superstructures"."operation_type" IS 'Type of operation: union, intersect, subtract, xor, or complex';
COMMENT ON COLUMN "rt_superstructures"."auto_update" IS 'Whether to automatically regenerate when source structures change';



