-- Frente 4 — Cleanup da fila + nova proposta sintética para validar Product/Funnel Fit Gate
-- 1) Arquivar a proposta "Kit 3x em Frio" (caso ruim) preservando auditoria
UPDATE public.ads_autopilot_actions
SET status = 'rejected',
    rejection_reason = '[CLEANUP F4] Arquivada para validar nova UX com Product/Funnel Fit Gate. kit_quantidade em Frio = baixa adequação.',
    action_data = jsonb_set(action_data, '{cleanup_audit}', '"archived_for_fit_gate_validation_2026_06_09"'::jsonb)
WHERE id = 'f24d6ceb-d654-41b2-ad07-3e4f01cd3962';

-- 2) Inserir nova proposta sintética (kit_unitario_apresentacao em Frio — alta adequação)
INSERT INTO public.ads_autopilot_actions (
  tenant_id, session_id, channel, action_type, status, confidence, reasoning, expected_impact, action_data, created_at
)
VALUES (
  'd1a4d0ed-8842-495e-b741-540a9a345b25',
  'bf7fb0ef-a805-4329-b13e-c2c716edb042',
  'meta',
  'create_campaign',
  'pending_approval',
  'high',
  'A IA recomenda criar uma campanha de Público Frio apresentando o Kit Banho Calvície Zero Dia (Shampoo + Balm) como porta de entrada da marca para novos compradores. Composição: 1 unidade de cada produto base — perfeito como produto de apresentação. Clientes atuais são excluídos para evitar canibalização.',
  'Custo por aquisição estimado entre R$ 35 e R$ 55 para audiência fria. Conversão esperada: 1,2% a 2,0%.',
  jsonb_build_object(
    'flow_version', 'two_step_v1',
    'campaign_name', '[VALIDAÇÃO F4] Prospecção Frio — Kit Banho Dia (apresentação)',
    'campaign_type', 'sales',
    'funnel_stage', 'tof',
    'destination_url', 'https://respeiteohomem.com.br/produto/kit-banho-calvicie-zero-dia',
    'product_id', '4d7326de-c158-45cd-a112-e0ec4c39f854',
    'product_name', 'Kit Banho Calvície Zero Dia',
    'product_price', 140.10,
    'product_price_display', 'R$ 140,10',
    'daily_budget_cents', 5000,
    'daily_budget_display', 'R$ 50,00/dia',
    'cta_type', 'SHOP_NOW',
    'customer_audience_exclusion', jsonb_build_object('enabled', true, 'audience_id', 'cust-cliente-segment'),
    'creative_brief', jsonb_build_object(
      'product_name', 'Kit Banho Calvície Zero Dia',
      'product_id', '4d7326de-c158-45cd-a112-e0ec4c39f854',
      'prompt', 'Foto premium em estúdio do Kit Banho Calvície Zero Dia (Shampoo + Balm pós-banho) sobre fundo claro e clean. Foco em produto, iluminação natural, sensação de cuidado masculino. Sem texto sobreposto.',
      'format', '1:1',
      'formats_suggested', jsonb_build_array('1:1','9:16'),
      'funnel_stage', 'tof',
      'variations', 3,
      'deferred', true
    ),
    'headline', 'Conheça o ritual de banho que cuida do couro cabeludo',
    'copy_text', 'O Kit Banho Calvície Zero Dia traz Shampoo + Balm pós-banho num passo simples de manhã. Apresentação ideal para quem quer começar com o pé direito.'
  ),
  NOW()
);