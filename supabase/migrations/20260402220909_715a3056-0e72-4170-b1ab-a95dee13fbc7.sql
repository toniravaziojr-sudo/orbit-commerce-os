
-- Desativar todos os planos antigos
UPDATE billing_plans SET is_active = false, updated_at = now() WHERE plan_key IN ('basico','evolucao','profissional','avancado','impulso','consolidar','comando_maximo','customizado');

-- Inserir os 3 novos planos
INSERT INTO billing_plans (plan_key, name, description, price_monthly_cents, price_annual_cents, included_orders_per_month, is_active, is_public, is_recommended, sort_order, support_level, feature_bullets)
VALUES
  ('basico_v2', 'Básico', 'Ideal para quem está começando. Todos os módulos essenciais com integrações básicas.', 15900, 162180, 300, true, true, false, 1, 'email',
   '["Todos os módulos essenciais", "Domínio + SSL incluso", "5 GB de armazenamento (Meu Drive)", "500 créditos de IA inclusos", "Até 300 pedidos/mês (R$ 1,00/pedido extra)", "Emails ilimitados para notificações", "Integrações: Mercado Pago, Frenet", "Pixel/CAPI: TikTok, Google, Meta", "Sem Marketing Avançado, Agenda, Parcerias, Atendimento"]'::jsonb),

  ('medio_v2', 'Médio', 'Para lojas em crescimento. CRM completo, marketplaces e atendimento via WhatsApp.', 99700, 1016940, 700, true, true, true, 2, 'email_whatsapp',
   '["Tudo do Básico +", "CRM completo liberado", "Calendário de Conteúdos", "Agenda liberada", "Marketplaces liberado", "Meta/Google/TikTok: publicações completas", "WhatsApp + Atendimento liberado", "10 GB de armazenamento (Meu Drive)", "1.000 créditos de IA inclusos", "Até 700 pedidos/mês (R$ 0,75/pedido extra)", "Emails e WhatsApp ilimitados"]'::jsonb),

  ('completo_v2', 'Completo', 'Acesso total a todas as funcionalidades. Para operações profissionais.', 249700, 2546940, 2000, true, true, false, 3, 'priority',
   '["Tudo liberado, sem restrições", "30 GB de armazenamento (Meu Drive)", "2.000 créditos de IA inclusos", "Até 2.000 pedidos/mês (R$ 0,50/pedido extra)", "Marketing Avançado completo", "Auxiliar de Comando completo", "Financeiro e Compras completo", "Importador de Dados completo", "Parcerias e Afiliados completo", "Todas as integrações liberadas", "Suporte prioritário"]'::jsonb)

ON CONFLICT (plan_key) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  price_monthly_cents = EXCLUDED.price_monthly_cents,
  price_annual_cents = EXCLUDED.price_annual_cents,
  included_orders_per_month = EXCLUDED.included_orders_per_month,
  is_active = EXCLUDED.is_active,
  is_public = EXCLUDED.is_public,
  is_recommended = EXCLUDED.is_recommended,
  sort_order = EXCLUDED.sort_order,
  support_level = EXCLUDED.support_level,
  feature_bullets = EXCLUDED.feature_bullets,
  updated_at = now();
