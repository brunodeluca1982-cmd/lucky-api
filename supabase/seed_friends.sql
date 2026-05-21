-- =============================================================================
-- SEED: friends (perfis dos amigos da Lucky Trip)
-- =============================================================================
-- Cole no SQL Editor do Supabase e execute.
-- Script idempotente — usa INSERT ... ON CONFLICT (slug) DO UPDATE.
-- =============================================================================
-- Amigos confirmados:
--   Carolina Dieckmann · Isabeli Fontana · Ana Clara Lima · Celina Loks
--   Di Ferrero · Ronald Domingues · Bruno De Luca
-- Storage base: https://lsibzflaaqzvtzjlvrxw.supabase.co/storage/v1/object/public/media
-- Fotos dos friends: pasta media/FRIENDS/[nome]/
-- =============================================================================
-- =============================================================================

INSERT INTO friends (slug, display_name, full_name, bio, profile_photo_url, cover_photo_url)
VALUES

  -- ── Carolina Dieckmann ──────────────────────────────────────────────────
  (
    'carolina-dieckmann',
    'Carol',
    'Carolina Dieckmann',
    'O Rio é a minha cidade — conheço cada cantinho, cada restaurante escondido, cada praia que só quem é daqui sabe. Aqui estão os lugares que eu amo de verdade, os que eu levo meus amigos quando visitam, os que eu nunca enjoo. Rio com o meu olhar.',
    'https://lsibzflaaqzvtzjlvrxw.supabase.co/storage/v1/object/public/media/FRIENDS/carolina/carolina2.jpg',
    'https://lsibzflaaqzvtzjlvrxw.supabase.co/storage/v1/object/public/media/FRIENDS/carolina/carolina2.jpg'
  ),

  -- ── Isabeli Fontana ─────────────────────────────────────────────────────
  (
    'isabeli-fontana',
    'Isabeli',
    'Isabeli Fontana',
    'Viajei o mundo inteiro como modelo e aprendi que os melhores lugares não estão nos guias. São aqueles que você descobre andando sem pressa, entrando numa porta qualquer, pedindo o prato do dia. Aqui estão os meus favoritos — curados com cuidado e muito carinho.',
    null,   -- substitua pela URL da foto de perfil
    null    -- substitua pela URL da foto de capa
  ),

  -- ── Ana Clara Lima ──────────────────────────────────────────────────────
  (
    'ana-clara-lima',
    'Ana Clara',
    'Ana Clara Lima',
    'Rio é a minha casa, mas o mundo inteiro virou o meu quintal. Amo descobrir o lado autêntico de cada cidade — os botecos escondidos, os mercados de manhã cedo, os pôr-do-sol que ninguém fotografa. Cada dica aqui é um lugar que eu voltaria amanhã.',
    null,
    null
  ),

  -- ── Celina Loks ─────────────────────────────────────────────────────────
  (
    'celina-loks',
    'Celina',
    'Celina Loks',
    'Surfe me levou para os lugares mais incríveis do planeta. Aprendi que a melhor parte de viajar não é o destino — é o que acontece quando você larga o roteiro e deixa o dia te surpreender. Minhas dicas são exatamente isso: as surpresas que valeram a viagem.',
    null,
    null
  ),

  -- ── Di Ferrero ──────────────────────────────────────────────────────────
  (
    'di-ferrero',
    'Di Ferrero',
    'Di Ferrero',
    'Músico viajante. Já me apresentei em mais de 30 países e cada show me trouxe uma cidade nova para explorar. Minha lista é feita de lugares onde a música te encontra na rua, nos bares, nos festivais. Onde a alma do lugar pulsa de verdade.',
    null,
    null
  ),

  -- ── Ronald Domingues ────────────────────────────────────────────────────
  (
    'ronald-domingues',
    'Ronald',
    'Ronald Domingues',
    'Gastronomia é a minha linguagem. Cada cidade que visito, busco o mesmo: a receita que a avó ainda faz, o mercado onde os cozinheiros compram, o restaurante sem placa na porta. Aqui estão os lugares que mudaram a minha forma de comer — e de viajar.',
    null,
    null
  ),

  -- ── Bruno De Luca ───────────────────────────────────────────────────────
  (
    'bruno-de-luca',
    'Bruno',
    'Bruno De Luca',
    '18 anos viajando o mundo para o trabalho e nunca parei de me apaixonar por lugares novos. O Lucky Trip nasceu da vontade de compartilhar tudo isso: os hotéis que mudaram minha vida, os restaurantes que não estão no TripAdvisor, os segredos que só locais sabem. Aqui está o meu mundo — feito para o seu.',
    null,
    null
  )

ON CONFLICT (slug) DO UPDATE SET
  display_name      = EXCLUDED.display_name,
  full_name         = EXCLUDED.full_name,
  bio               = EXCLUDED.bio,
  profile_photo_url = COALESCE(EXCLUDED.profile_photo_url, friends.profile_photo_url),
  cover_photo_url   = COALESCE(EXCLUDED.cover_photo_url,   friends.cover_photo_url),
  updated_at        = now();

-- =============================================================================
-- VERIFICAÇÃO
-- =============================================================================
-- SELECT slug, display_name, LEFT(bio, 60) AS bio_preview FROM friends ORDER BY slug;
