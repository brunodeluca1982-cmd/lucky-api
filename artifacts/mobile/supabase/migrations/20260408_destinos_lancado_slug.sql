-- Migration: add lancado, descricao, slug to destinos table
-- Created: 2026-04-08
-- Purpose: The existing destinos table (id bigint, nome, pais, vibe_principal) is extended
--          with the fields the mobile app needs to render destination cards from Supabase
--          instead of hardcoded mockData.ts.

ALTER TABLE destinos
  ADD COLUMN IF NOT EXISTS lancado  BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS descricao TEXT,
  ADD COLUMN IF NOT EXISTS slug     TEXT UNIQUE;

-- Seed Rio de Janeiro (the only launched destination)
INSERT INTO destinos (nome, pais, lancado, descricao, slug)
VALUES (
  'Rio de Janeiro',
  'Brasil',
  true,
  'A cidade maravilhosa — praias douradas, florestas urbanas e o carnaval mais famoso do mundo.',
  'rio'
)
ON CONFLICT (slug) DO UPDATE
  SET nome=EXCLUDED.nome, pais=EXCLUDED.pais, lancado=EXCLUDED.lancado, descricao=EXCLUDED.descricao;

-- Public read policy (RLS was enabled, no policies existed)
-- Uses DO $$ block for idempotency — CREATE POLICY IF NOT EXISTS is not valid PostgreSQL
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'destinos' AND policyname = 'anon_select_destinos'
  ) THEN
    CREATE POLICY "anon_select_destinos" ON destinos FOR SELECT USING (true);
  END IF;
END;
$$;
