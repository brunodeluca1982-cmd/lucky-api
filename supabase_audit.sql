-- ============================================================
-- THE LUCKY TRIP — Auditoria Completa do Supabase
-- Execute cada bloco separadamente no SQL Editor do Supabase
-- Dashboard → SQL Editor → New Query
-- ============================================================


-- ============================================================
-- BLOCO 1: TODAS AS TABELAS + COLUNAS (schema public)
-- ============================================================
SELECT
  t.table_name                        AS tabela,
  c.ordinal_position                  AS ordem,
  c.column_name                       AS coluna,
  c.data_type                         AS tipo,
  c.character_maximum_length          AS max_chars,
  c.is_nullable                       AS nulo,
  c.column_default                    AS valor_padrao
FROM information_schema.tables t
JOIN information_schema.columns c
  ON t.table_name  = c.table_name
 AND t.table_schema = c.table_schema
WHERE t.table_schema = 'public'
  AND t.table_type   = 'BASE TABLE'
ORDER BY t.table_name, c.ordinal_position;


-- ============================================================
-- BLOCO 2: TODAS AS VIEWS + DEFINIÇÃO
-- ============================================================
SELECT
  table_name   AS view_name,
  view_definition
FROM information_schema.views
WHERE table_schema = 'public'
ORDER BY table_name;


-- ============================================================
-- BLOCO 3: CONTAGEM DE LINHAS POR TABELA
-- (mostra quais tabelas têm dados de verdade)
-- ============================================================
SELECT
  schemaname,
  tablename,
  n_live_tup AS linhas_estimadas
FROM pg_stat_user_tables
WHERE schemaname = 'public'
ORDER BY n_live_tup DESC;


-- ============================================================
-- BLOCO 4: STORAGE — BUCKETS EXISTENTES
-- ============================================================
SELECT
  id,
  name,
  public,
  created_at,
  updated_at
FROM storage.buckets
ORDER BY created_at;


-- ============================================================
-- BLOCO 5: STORAGE — ARQUIVOS/PASTAS (primeiros 200)
-- Mostra estrutura de pastas e tipos de arquivo
-- ============================================================
SELECT
  bucket_id,
  name,
  metadata->>'mimetype'  AS tipo,
  metadata->>'size'      AS tamanho_bytes,
  created_at
FROM storage.objects
WHERE bucket_id IS NOT NULL
ORDER BY bucket_id, name
LIMIT 200;


-- ============================================================
-- BLOCO 6: RLS POLICIES ATIVAS
-- ============================================================
SELECT
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd   AS operacao,
  qual  AS condicao_where
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;


-- ============================================================
-- BLOCO 7: ÍNDICES EXISTENTES
-- ============================================================
SELECT
  tablename,
  indexname,
  indexdef
FROM pg_indexes
WHERE schemaname = 'public'
ORDER BY tablename, indexname;


-- ============================================================
-- BLOCO 8: FUNÇÕES/EDGE FUNCTIONS REGISTRADAS NO BANCO
-- ============================================================
SELECT
  routine_name    AS funcao,
  routine_type    AS tipo,
  data_type       AS retorno,
  created         AS criada_em
FROM information_schema.routines
WHERE routine_schema = 'public'
ORDER BY routine_name;


-- ============================================================
-- BLOCO 9: DETALHES DAS TABELAS MAIS IMPORTANTES
-- Verifica dados reais em cada tabela chave
-- ============================================================

-- 9a. Tabela destinos — ver todas as colunas disponíveis
SELECT * FROM destinos LIMIT 5;

-- 9b. Tabela o_que_fazer_rio_v2 — ver estrutura e amostra
SELECT * FROM o_que_fazer_rio_v2 LIMIT 5;

-- 9c. Tabela restaurantes — ver estrutura e amostra
SELECT * FROM restaurantes LIMIT 5;

-- 9d. Tabela home_hero_items — existe? tem dados?
SELECT * FROM home_hero_items LIMIT 10;

-- 9e. View v_rio_hero_media_public — existe? tem dados?
SELECT * FROM v_rio_hero_media_public LIMIT 10;

-- 9f. Tabela lucky_list_rio_v2 — ver amostra
SELECT * FROM lucky_list_rio_v2 LIMIT 5;

-- 9g. Tabela friends — ver estrutura
SELECT * FROM friends LIMIT 5;

-- 9h. Tabela stay_hotels ou stay_neighborhoods_with_hotels
SELECT * FROM stay_hotels LIMIT 5;

-- 9i. Tabela user_itineraries — tem roteiros salvos?
SELECT COUNT(*) AS total_roteiros FROM user_itineraries;

-- 9j. Tabela eventos — existe? (para Modo Evento)
SELECT * FROM eventos LIMIT 5;


-- ============================================================
-- BLOCO 10: RESUMO RÁPIDO — o que tem dados vs o que está vazio
-- ============================================================
SELECT
  'destinos'               AS tabela, COUNT(*) AS total FROM destinos
UNION ALL SELECT 'o_que_fazer_rio_v2',  COUNT(*) FROM o_que_fazer_rio_v2
UNION ALL SELECT 'restaurantes',         COUNT(*) FROM restaurantes
UNION ALL SELECT 'lucky_list_rio_v2',    COUNT(*) FROM lucky_list_rio_v2
UNION ALL SELECT 'friends',              COUNT(*) FROM friends
UNION ALL SELECT 'user_itineraries',     COUNT(*) FROM user_itineraries
UNION ALL SELECT 'roteiro_itens',        COUNT(*) FROM roteiro_itens
UNION ALL SELECT 'user_saved_places',    COUNT(*) FROM user_saved_places
UNION ALL SELECT 'transporte_rio',       COUNT(*) FROM transporte_rio
ORDER BY total DESC;
