-- Migration: user_saved_places
-- Created: 2026-04-08
-- Purpose: Cross-device save memory for authenticated users.
--          AsyncStorage remains the fast-path local cache;
--          this table is the authoritative server-side store.

CREATE TABLE IF NOT EXISTS user_saved_places (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  place_id     TEXT NOT NULL,
  source_table TEXT NOT NULL,
  categoria    TEXT NOT NULL,
  titulo       TEXT,
  localizacao  TEXT,
  image_url    TEXT,
  saved_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT user_saved_places_unique UNIQUE (user_id, place_id, source_table)
);

ALTER TABLE user_saved_places ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'user_saved_places' AND policyname = 'users_own_saves_select'
  ) THEN
    CREATE POLICY users_own_saves_select ON user_saved_places
      FOR SELECT USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'user_saved_places' AND policyname = 'users_own_saves_insert'
  ) THEN
    CREATE POLICY users_own_saves_insert ON user_saved_places
      FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'user_saved_places' AND policyname = 'users_own_saves_delete'
  ) THEN
    CREATE POLICY users_own_saves_delete ON user_saved_places
      FOR DELETE USING (auth.uid() = user_id);
  END IF;

  -- UPDATE policy is required for upsert on-conflict paths
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'user_saved_places' AND policyname = 'users_own_saves_update'
  ) THEN
    CREATE POLICY users_own_saves_update ON user_saved_places
      FOR UPDATE
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS user_saved_places_user_idx ON user_saved_places (user_id);
