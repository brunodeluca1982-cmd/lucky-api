-- Migration: add user_itinerary_id to roteiro_itens
-- Created: 2026-04-08
-- Purpose: Allow itinerary items to be retrieved by user_id via user_itineraries.
--          The existing roteiro_id FK (also references user_itineraries.id) is preserved.
--          This new column is used by the auto-save path (post-generate, before Share).
--          Existing rows remain unaffected (nullable).

ALTER TABLE roteiro_itens
  ADD COLUMN IF NOT EXISTS user_itinerary_id UUID
    REFERENCES user_itineraries(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS roteiro_itens_user_itinerary_idx
  ON roteiro_itens (user_itinerary_id)
  WHERE user_itinerary_id IS NOT NULL;
