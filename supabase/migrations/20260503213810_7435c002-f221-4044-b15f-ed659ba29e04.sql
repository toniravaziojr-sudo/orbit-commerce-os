-- Onda 1B — Configuração assistida da Visão da IA para produtos reais do tenant Respeite o Homem
-- Tenant: d1a4d0ed-8842-495e-b741-540a9a345b25
-- Apenas dados; nenhuma alteração de schema. Marca como manual override.

-- Balm 1x (base puro)
UPDATE public.ai_product_commercial_payload
SET is_base_candidate = true,
    base_product_id = NULL,
    when_to_recommend = 'Cliente iniciando o protocolo pós-banho ou querendo testar 1 unidade antes de evoluir para combos de quantidade.',
    recommendation_notes = 'Produto-base puro da linha Balm Pós-Banho Calvície Zero (uso diurno). Ponto de entrada da família Balm.',
    source = 'manual', has_manual_overrides = true, updated_at = now()
WHERE product_id = '52fdbf3f-1b8f-43cb-affe-a58e907574c0';

-- Balm 2x / 3x / 6x (packs apontando para Balm 1x)
UPDATE public.ai_product_commercial_payload
SET is_base_candidate = false,
    base_product_id = '52fdbf3f-1b8f-43cb-affe-a58e907574c0',
    product_kind = 'pack',
    when_to_recommend = 'Cliente já conhece o Balm 1x ou busca economia em quantidade.',
    recommendation_notes = 'Pack de quantidade do Balm Pós-Banho. Não oferecer como primeira recomendação; partir do Balm 1x.',
    source = 'manual', has_manual_overrides = true, updated_at = now()
WHERE product_id IN (
  'a69da21b-6c4e-41fd-9af5-4f713e22be73',
  'bd811151-d7a8-4b5d-b27c-dd448c1804a9',
  '44225e5e-6297-4be0-ad71-2d1704eaa7b0'
);

-- Shampoo Calvície Zero (base puro)
UPDATE public.ai_product_commercial_payload
SET is_base_candidate = true,
    base_product_id = NULL,
    when_to_recommend = 'Primeira recomendação para queda capilar / protocolo Calvície Zero.',
    recommendation_notes = 'Produto-base principal da linha Calvície Zero (Shampoo).',
    source = 'manual', has_manual_overrides = true, updated_at = now()
WHERE product_id = '8259065f-16f5-4aad-bc80-7d9cac4fa0c2';

-- Loção Pós-Banho Noite (base/complemento — aparece na recomendação inicial noturna)
UPDATE public.ai_product_commercial_payload
SET is_base_candidate = true,
    base_product_id = NULL,
    when_to_recommend = 'Cliente busca complementar o tratamento à noite ou maximizar resultado pós-banho.',
    recommendation_notes = 'Produto-base da família Loção Pós-Banho (uso noturno). Complementa Shampoo e Balm.',
    source = 'manual', has_manual_overrides = true, updated_at = now()
WHERE product_id = '15d5e847-919e-4302-8599-9ac2595b5a24';

-- Kit Banho Calvície Zero (kit/combo, composição em product_components)
UPDATE public.ai_product_commercial_payload
SET is_base_candidate = false,
    product_kind = 'kit',
    base_product_id = NULL,
    when_to_recommend = 'Cliente quer o protocolo completo (Shampoo + Balm + Loção) com economia de combo.',
    recommendation_notes = 'Kit completo do protocolo Calvície Zero. Composição real em product_components: Shampoo + Balm + Loção. Não duplicar composição em ai_product_relations.',
    source = 'manual', has_manual_overrides = true, updated_at = now()
WHERE product_id = '29794329-a23b-4ea6-889f-0bc4f7d1fa4c';

-- Relações complementares (idempotente via ON CONFLICT no índice único tenant/source/target/relation_type)
INSERT INTO public.ai_product_relations
  (tenant_id, source_product_id, target_product_id, relation_type, position, source, manual_override)
VALUES
  ('d1a4d0ed-8842-495e-b741-540a9a345b25','8259065f-16f5-4aad-bc80-7d9cac4fa0c2','52fdbf3f-1b8f-43cb-affe-a58e907574c0','complement',1,'manual',true),
  ('d1a4d0ed-8842-495e-b741-540a9a345b25','8259065f-16f5-4aad-bc80-7d9cac4fa0c2','15d5e847-919e-4302-8599-9ac2595b5a24','complement',2,'manual',true),
  ('d1a4d0ed-8842-495e-b741-540a9a345b25','52fdbf3f-1b8f-43cb-affe-a58e907574c0','15d5e847-919e-4302-8599-9ac2595b5a24','complement',1,'manual',true),
  ('d1a4d0ed-8842-495e-b741-540a9a345b25','15d5e847-919e-4302-8599-9ac2595b5a24','52fdbf3f-1b8f-43cb-affe-a58e907574c0','complement',1,'manual',true),
  ('d1a4d0ed-8842-495e-b741-540a9a345b25','52fdbf3f-1b8f-43cb-affe-a58e907574c0','8259065f-16f5-4aad-bc80-7d9cac4fa0c2','complement',2,'manual',true),
  ('d1a4d0ed-8842-495e-b741-540a9a345b25','15d5e847-919e-4302-8599-9ac2595b5a24','8259065f-16f5-4aad-bc80-7d9cac4fa0c2','complement',2,'manual',true)
ON CONFLICT DO NOTHING;