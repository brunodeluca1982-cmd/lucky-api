-- =============================================================================
-- SEED: eventos + evento_itens
-- Schema real da tabela evento_itens (confirmado pelo Bruno):
--   id, evento_id, slug, titulo, tipo, descricao, local_nome, bairro,
--   google_maps_url, instagram, data_inicio, data_fim, ordem, ativo, tags
-- =============================================================================
-- Cole no SQL Editor do Supabase e execute.
-- Todos os eventos começam com is_active = false.
-- Para ativar: UPDATE eventos SET is_active = true WHERE nome = 'Modo Shakira';
-- Script idempotente — pode rodar várias vezes sem duplicar dados.
-- =============================================================================

DELETE FROM evento_itens
WHERE evento_id IN (
  SELECT id FROM eventos
  WHERE nome IN ('Modo Shakira','Modo Copa do Mundo','Modo Feriadão','Modo Rock in Rio')
);
DELETE FROM eventos
WHERE nome IN ('Modo Shakira','Modo Copa do Mundo','Modo Feriadão','Modo Rock in Rio');

-- =============================================================================
-- 1. MODO SHAKIRA — Rio de Janeiro (Maracanã, Nov 2026)
-- =============================================================================
WITH ev AS (
  INSERT INTO eventos (cidade_id, nome, tipo, cor_destaque, icone, is_active, data_inicio, data_fim)
  VALUES ('rio','Modo Shakira','show','#9B59B6','music',false,
          '2026-11-14 00:00:00+00','2026-11-16 23:59:59+00')
  RETURNING id
)
INSERT INTO evento_itens (evento_id, slug, titulo, tipo, descricao, local_nome, bairro, google_maps_url, instagram, ordem, ativo, tags)
SELECT ev.id, slug, titulo, tipo, descricao, local_nome, bairro, google_maps_url, instagram, ordem, true, tags
FROM ev, (VALUES
  ('shakira-ingresso',  'Ingressos Shakira',          'ingresso',   'Compre no site oficial antes que esgotem',   null,                   null,     'https://www.ticketmaster.com.br', null,              1, ARRAY['show','ingresso']),
  ('shakira-hotel',     'Hotéis perto do Maracanã',   'hospedagem', 'Fique a pé do show, sem stress de transfer', 'Tijuca / Maracanã',    'Tijuca', null,                             null,              2, ARRAY['hospedagem']),
  ('shakira-jantar',    'Onde jantar antes do show',  'restaurante','Restaurantes no Maracanã que não lotam',     null,                   'Tijuca', null,                             null,              3, ARRAY['gastronomia']),
  ('shakira-metro',     'Como chegar ao Maracanã',    'transporte', 'Metrô Linha 2 — estação Maracanã (mais fácil)',null,                  null,     'https://maps.app.goo.gl/maraca', null,              4, ARRAY['transporte']),
  ('shakira-fan-zone',  'Fan Zone pré-show',          'dica',       'Concentração de fãs antes do show com música e drinks',null,          'Maracanã',null,                           null,              5, ARRAY['dica','show']),
  ('shakira-pos-show',  'Após o show — evite Uber',   'dica',       'Pós-show: use o metrô. Uber triplica de preço na saída',null,         null,     null,                             null,              6, ARRAY['dica','transporte'])
) AS t(slug, titulo, tipo, descricao, local_nome, bairro, google_maps_url, instagram, ordem, tags);

-- =============================================================================
-- 2. MODO COPA DO MUNDO — Miami (Copa FIFA 2026, Jun–Jul 2026)
-- =============================================================================
WITH ev AS (
  INSERT INTO eventos (cidade_id, nome, tipo, cor_destaque, icone, is_active, data_inicio, data_fim)
  VALUES ('miami','Modo Copa do Mundo','copa','#009C3B','award',false,
          '2026-06-11 00:00:00+00','2026-07-19 23:59:59+00')
  RETURNING id
)
INSERT INTO evento_itens (evento_id, slug, titulo, tipo, descricao, local_nome, bairro, google_maps_url, instagram, ordem, ativo, tags)
SELECT ev.id, slug, titulo, tipo, descricao, local_nome, bairro, google_maps_url, instagram, ordem, true, tags
FROM ev, (VALUES
  ('copa-ingresso',    'Ingressos FIFA',               'ingresso',   'Pacotes de jogos no site oficial da FIFA',      null,                     null,             'https://www.fifa.com/tickets',          null, 1, ARRAY['copa','ingresso']),
  ('copa-fan-zone',    'Fan Zone Miami',               'dica',       'Fort Lauderdale e Miami Beach — festa oficial', 'Bayfront Park Fan Zone', 'Downtown Miami', 'https://maps.app.goo.gl/miami-fz',      null, 2, ARRAY['copa','evento']),
  ('copa-hotel',       'Hotéis perto do estádio',      'hospedagem', 'Hard Rock Stadium em Miami Gardens',            null,                     'Miami Gardens',  null,                                    null, 3, ARRAY['hospedagem']),
  ('copa-bares',       'Sports bars em South Beach',   'restaurante','Os melhores lugares para assistir os jogos',    null,                     'South Beach',    null,                                    null, 4, ARRAY['gastronomia']),
  ('copa-transporte',  'Transport ao estádio',         'transporte', 'Uber/Lyft ou shuttles oficiais da FIFA',        null,                     null,             null,                                    null, 5, ARRAY['transporte']),
  ('copa-dica-bruno',  'Dica do Bruno',                'dica',       'Chegue 2h antes — a segurança da FIFA demora muito',null,               null,             null,                                    null, 6, ARRAY['dica'])
) AS t(slug, titulo, tipo, descricao, local_nome, bairro, google_maps_url, instagram, ordem, tags);

-- =============================================================================
-- 3. MODO FERIADÃO — Rio de Janeiro (template Tiradentes Apr 2026)
-- Para outros feriados: duplique e ajuste as datas no INSERT de eventos
-- =============================================================================
WITH ev AS (
  INSERT INTO eventos (cidade_id, nome, tipo, cor_destaque, icone, is_active, data_inicio, data_fim)
  VALUES ('rio','Modo Feriadão','feriado','#F39C12','sun',false,
          '2026-04-21 00:00:00+00','2026-04-26 23:59:59+00')
  RETURNING id
)
INSERT INTO evento_itens (evento_id, slug, titulo, tipo, descricao, local_nome, bairro, google_maps_url, instagram, ordem, ativo, tags)
SELECT ev.id, slug, titulo, tipo, descricao, local_nome, bairro, google_maps_url, instagram, ordem, true, tags
FROM ev, (VALUES
  ('feriado-rio-roteiro',    'Roteiro 3 dias no Rio',      'dica',       'O melhor do Rio em um feriadão perfeito',         null,             null,          null, null, 1, ARRAY['dica','roteiro']),
  ('feriado-rio-reserve',    'Reserve antes — vai lotar',  'dica',       'Hotéis e restaurantes esgotam cedo no feriadão',  null,             null,          null, null, 2, ARRAY['dica']),
  ('feriado-rio-praia',      'Praia de segunda a quarta',  'dica',       'Evite fins de semana — menos gente, mais paz',    null,             'Ipanema',     null, null, 3, ARRAY['dica','praia']),
  ('feriado-rio-transito',   'Evite Barra no domingo',     'transporte', 'Volta: trânsito infernal na Linha Amarela à noite',null,            null,          null, null, 4, ARRAY['transporte']),
  ('feriado-rio-ilha',       'Passeio de barco',           'oQueFazer',  'Feriadão é perfeito para Ilha Grande',            null,             'Angra/Mangaratiba','https://maps.app.goo.gl/ilha-grande', null, 5, ARRAY['passeio']),
  ('feriado-rio-bairro',     'Ipanema > Copacabana',       'dica',       'Copacabana fica caótica — prefira Ipanema e Santa Teresa',null,     'Ipanema',     null, null, 6, ARRAY['dica'])
) AS t(slug, titulo, tipo, descricao, local_nome, bairro, google_maps_url, instagram, ordem, tags);

-- =============================================================================
-- 4. MODO ROCK IN RIO — Rio de Janeiro (Set 2026)
-- =============================================================================
WITH ev AS (
  INSERT INTO eventos (cidade_id, nome, tipo, cor_destaque, icone, is_active, data_inicio, data_fim)
  VALUES ('rio','Modo Rock in Rio','festival','#E74C3C','headphones',false,
          '2026-09-18 00:00:00+00','2026-09-27 23:59:59+00')
  RETURNING id
)
INSERT INTO evento_itens (evento_id, slug, titulo, tipo, descricao, local_nome, bairro, google_maps_url, instagram, ordem, ativo, tags)
SELECT ev.id, slug, titulo, tipo, descricao, local_nome, bairro, google_maps_url, instagram, ordem, true, tags
FROM ev, (VALUES
  ('rir-ingresso',    'Ingresso Rock in Rio',        'ingresso',   '1º lote é sempre o mais barato — compre cedo',   null,               null,       'https://rockinrio.com',            '@rockinrio', 1, ARRAY['festival','ingresso']),
  ('rir-hotel',       'Hospedagem na Barra',         'hospedagem', 'Mais perto da Cidade do Rock sem transfer',       null,               'Barra',    null,                               null,         2, ARRAY['hospedagem']),
  ('rir-shuttle',     'Shuttle oficial',             'transporte', 'Use o transporte oficial — parking é caótico',    null,               null,       null,                               null,         3, ARRAY['transporte']),
  ('rir-jantar',      'Onde jantar antes',           'restaurante','VillageMall e Downtown — perto do festival',      'VillageMall',      'Barra',    'https://maps.app.goo.gl/vilagem',  null,         4, ARRAY['gastronomia']),
  ('rir-dias',        'Melhor dia para ir',          'dica',       'Quinta e domingo têm menos fila que o sábado',    null,               null,       null,                               null,         5, ARRAY['dica']),
  ('rir-kit',         'Kit essencial',               'dica',       'Protetor solar, garrafa d''água e powerbank',     null,               null,       null,                               null,         6, ARRAY['dica'])
) AS t(slug, titulo, tipo, descricao, local_nome, bairro, google_maps_url, instagram, ordem, tags);

-- =============================================================================
-- VERIFICAÇÃO — descomente para checar
-- =============================================================================
-- SELECT e.nome, e.cidade_id, e.is_active, e.cor_destaque,
--        COUNT(ei.id) AS itens
-- FROM eventos e
-- LEFT JOIN evento_itens ei ON ei.evento_id = e.id AND ei.ativo = true
-- GROUP BY e.id, e.nome, e.cidade_id, e.is_active, e.cor_destaque
-- ORDER BY e.nome, e.cidade_id;
