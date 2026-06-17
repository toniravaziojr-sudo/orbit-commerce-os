
-- Onda 3.3 — Saneamento PT-BR
-- 1) Traduz os rationales das 3 propostas atuais do tenant Respeite o Homem
UPDATE ads_autopilot_actions
SET action_data = jsonb_set(
  action_data,
  '{campaign,rationale}',
  to_jsonb('Testar variações de criativo para identificar a mensagem e o visual mais impactantes para o novo produto "Fast Upgrade" e definir o potencial de escala.'::text)
)
WHERE id = '0d6405cf-d40a-4e3a-bc39-2b3f11f4fc70';

UPDATE ads_autopilot_actions
SET action_data = jsonb_set(
  action_data,
  '{campaign,rationale}',
  to_jsonb('Focar em converter visitantes recentes e quem adicionou produtos ao carrinho mas não finalizou a compra, usando remarketing para aumentar a taxa de conversão.'::text)
)
WHERE id = '73fbc1b9-0fc2-4d68-9046-1bc0bba0d711';

UPDATE ads_autopilot_actions
SET action_data = jsonb_set(
  action_data,
  '{campaign,rationale}',
  to_jsonb('Realocar orçamento para o produto prioritário "Shampoo Calvície Zero" pela sua relevância estratégica na aquisição de novos clientes e na maximização das vendas.'::text)
)
WHERE id = '93a71c66-8cd5-47fc-86f0-1c9a4a31c7ce';

-- 2) Limpa o aprendizado poluído (mantém apenas o feedback do usuário)
UPDATE ads_ai_learnings
SET 
  title = 'Plano bem estruturado de acordo com o que eu preciso no momento, gostei da estrutura, faria exatamente assim.',
  description = NULL,
  metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object('cleaned_at', now(), 'cleanup_reason', 'remove_ai_diagnosis_from_user_feedback_learning')
WHERE id = '50a715a9-c26e-440b-b5d5-53998d1a2ee6';
