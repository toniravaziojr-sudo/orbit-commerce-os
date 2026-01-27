-- =====================================================
-- MIGRAÇÃO: Novos Planos + Sistema de Créditos de IA
-- =====================================================

-- 1. ATUALIZAR ENUM DE PLANOS (adicionar novos valores)
-- Primeiro, criar novo enum com todos os valores
DO $$
BEGIN
  -- Dropar constraint temporariamente se existir
  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'plan_tier') THEN
    -- Adicionar novos valores ao enum existente
    ALTER TYPE plan_tier ADD VALUE IF NOT EXISTS 'basico';
    ALTER TYPE plan_tier ADD VALUE IF NOT EXISTS 'evolucao';
    ALTER TYPE plan_tier ADD VALUE IF NOT EXISTS 'profissional';
    ALTER TYPE plan_tier ADD VALUE IF NOT EXISTS 'avancado';
    ALTER TYPE plan_tier ADD VALUE IF NOT EXISTS 'impulso';
    ALTER TYPE plan_tier ADD VALUE IF NOT EXISTS 'consolidar';
    ALTER TYPE plan_tier ADD VALUE IF NOT EXISTS 'comando_maximo';
    ALTER TYPE plan_tier ADD VALUE IF NOT EXISTS 'customizado';
  END IF;
END$$;

-- 2. LIMPAR PLANOS ANTIGOS E INSERIR NOVOS
DELETE FROM public.billing_plans WHERE plan_key NOT IN ('free');

-- Inserir novos planos
INSERT INTO public.billing_plans (
  plan_key, name, description, price_monthly_cents, price_annual_cents,
  included_orders_per_month, support_level, feature_bullets, is_active, is_public,
  is_recommended, sort_order
) VALUES
  -- BÁSICO: 2.5% sobre vendas (sem mensalidade fixa)
  ('basico', 'Básico', 'Para quem está começando', 0, 0, NULL, 'email',
   '["2,5% sobre vendas", "Central: Visão Geral", "E-commerce parcial", "Loja Online parcial", "Blog manual", "CRM: Email + Avaliações", "Fiscal liberado", "1 GB armazenamento"]'::jsonb,
   true, true, false, 1),
  
  -- EVOLUÇÃO: R$ 397,00/mês
  ('evolucao', 'Evolução', 'Para quem vende até 30 mil/mês', 39700, 429000, 350, 'email',
   '["Até 350 pedidos/mês", "Central: Visão Geral", "E-commerce completo", "Loja Online completa", "Blog manual", "Logística completa", "1 GB armazenamento"]'::jsonb,
   true, true, false, 2),
  
  -- PROFISSIONAL: R$ 699,90/mês
  ('profissional', 'Profissional', 'Para quem vende de 30 a 50 mil/mês', 69990, 755000, 500, 'chat',
   '["Até 500 pedidos/mês", "Central: Quase completa", "Blog com IA", "Marketing Básico completo", "Marketing Avançado parcial", "Marketplaces completo", "5 GB armazenamento"]'::jsonb,
   true, true, true, 3),
  
  -- AVANÇADO: R$ 1.299,00/mês
  ('avancado', 'Avançado', 'Para quem vende de 70 a 120 mil/mês', 129900, 1402920, 1000, 'chat',
   '["Até 1.000 pedidos/mês", "20 interações Auxiliar IA", "2 usuários", "CRM completo", "Importação 4 usos", "15 GB armazenamento"]'::jsonb,
   true, true, false, 4),
  
  -- IMPULSO: R$ 2.499,90/mês
  ('impulso', 'Impulso', 'Para quem vende de 130 a 200 mil/mês', 249990, 2699892, 1500, 'whatsapp',
   '["Até 1.500 pedidos/mês", "50 interações Auxiliar IA", "30 imagens + 10 vídeos IA", "4 usuários", "Parcerias liberado", "30 GB armazenamento"]'::jsonb,
   true, true, false, 5),
  
  -- CONSOLIDAR: R$ 3.997,00/mês
  ('consolidar', 'Consolidar', 'Para quem vende de 200 a 300 mil/mês', 399700, 4316760, 3000, 'whatsapp',
   '["Até 3.000 pedidos/mês", "Auxiliar IA ilimitado", "100 imagens + 30 vídeos IA", "Gestor Criativos completo", "6 usuários", "60 GB armazenamento"]'::jsonb,
   true, true, false, 6),
  
  -- COMANDO MÁXIMO: R$ 5.990,00/mês
  ('comando_maximo', 'Comando Máximo', 'Para quem vende acima de 300 mil/mês', 599000, 6469200, 5000, 'priority',
   '["Até 5.000 pedidos/mês", "Auxiliar IA ilimitado", "200 imagens + 60 vídeos IA", "Gestor Criativos premium", "6 usuários", "100 GB armazenamento"]'::jsonb,
   true, true, false, 7),
  
  -- CUSTOMIZADO
  ('customizado', 'Customizado', 'Para quem busca algo único e faturamento consolidado', 0, 0, NULL, 'dedicated',
   '["Limites personalizados", "Recursos sob demanda", "Suporte dedicado", "SLA garantido"]'::jsonb,
   true, true, false, 8)
ON CONFLICT (plan_key) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  price_monthly_cents = EXCLUDED.price_monthly_cents,
  price_annual_cents = EXCLUDED.price_annual_cents,
  included_orders_per_month = EXCLUDED.included_orders_per_month,
  support_level = EXCLUDED.support_level,
  feature_bullets = EXCLUDED.feature_bullets,
  is_recommended = EXCLUDED.is_recommended,
  sort_order = EXCLUDED.sort_order,
  updated_at = now();

-- 3. TABELA DE LIMITES POR PLANO (detalhado)
CREATE TABLE IF NOT EXISTS public.plan_limits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_key TEXT NOT NULL REFERENCES public.billing_plans(plan_key) ON DELETE CASCADE,
  
  -- Limites de pedidos e vendas
  orders_per_month INTEGER,
  sales_fee_bps INTEGER DEFAULT 0, -- Basis points (250 = 2.5%)
  
  -- Limites de usuários
  max_users INTEGER DEFAULT 1,
  
  -- Armazenamento (bytes)
  storage_bytes BIGINT DEFAULT 1073741824, -- 1 GB
  
  -- Importação
  import_uses_per_month INTEGER DEFAULT 0,
  
  -- IA - Auxiliar de Comando
  assistant_interactions_per_month INTEGER DEFAULT 0,
  
  -- IA - Geração de mídias
  ai_images_per_month INTEGER DEFAULT 0,
  ai_videos_per_month INTEGER DEFAULT 0,
  
  -- IA - Gestor de Criativos
  creative_ugc_per_month INTEGER DEFAULT 0,
  creative_ugc_ai_per_month INTEGER DEFAULT 0,
  creative_shorts_per_month INTEGER DEFAULT 0,
  creative_tech_per_month INTEGER DEFAULT 0,
  creative_product_per_month INTEGER DEFAULT 0,
  creative_avatar_per_month INTEGER DEFAULT 0,
  
  -- Tráfego
  traffic_campaigns_per_month INTEGER DEFAULT 0,
  traffic_ads_accounts INTEGER DEFAULT 0,
  
  -- SEO e conteúdo IA (a partir do plano 5)
  seo_generations_per_month INTEGER DEFAULT 0,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  UNIQUE(plan_key)
);

-- Inserir limites para cada plano
INSERT INTO public.plan_limits (
  plan_key, orders_per_month, sales_fee_bps, max_users, storage_bytes, import_uses_per_month,
  assistant_interactions_per_month, ai_images_per_month, ai_videos_per_month,
  creative_ugc_per_month, creative_ugc_ai_per_month, creative_shorts_per_month,
  creative_tech_per_month, creative_product_per_month, creative_avatar_per_month,
  traffic_campaigns_per_month, traffic_ads_accounts, seo_generations_per_month
) VALUES
  ('basico', NULL, 250, 1, 1073741824, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0),
  ('evolucao', 350, 0, 1, 1073741824, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0),
  ('profissional', 500, 0, 1, 5368709120, 2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0),
  ('avancado', 1000, 0, 2, 16106127360, 4, 20, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0),
  ('impulso', 1500, 0, 4, 32212254720, 10, 50, 30, 10, 0, 0, 0, 0, 0, 0, 10, 1, 10),
  ('consolidar', 3000, 0, 6, 64424509440, 15, -1, 100, 30, 10, 15, 30, 15, 30, 15, 30, 3, 10),
  ('comando_maximo', 5000, 0, 6, 107374182400, 15, -1, 200, 60, 20, 20, 60, 25, 60, 25, 50, 6, 10),
  ('customizado', NULL, 0, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1)
ON CONFLICT (plan_key) DO UPDATE SET
  orders_per_month = EXCLUDED.orders_per_month,
  sales_fee_bps = EXCLUDED.sales_fee_bps,
  max_users = EXCLUDED.max_users,
  storage_bytes = EXCLUDED.storage_bytes,
  import_uses_per_month = EXCLUDED.import_uses_per_month,
  assistant_interactions_per_month = EXCLUDED.assistant_interactions_per_month,
  ai_images_per_month = EXCLUDED.ai_images_per_month,
  ai_videos_per_month = EXCLUDED.ai_videos_per_month,
  creative_ugc_per_month = EXCLUDED.creative_ugc_per_month,
  creative_ugc_ai_per_month = EXCLUDED.creative_ugc_ai_per_month,
  creative_shorts_per_month = EXCLUDED.creative_shorts_per_month,
  creative_tech_per_month = EXCLUDED.creative_tech_per_month,
  creative_product_per_month = EXCLUDED.creative_product_per_month,
  creative_avatar_per_month = EXCLUDED.creative_avatar_per_month,
  traffic_campaigns_per_month = EXCLUDED.traffic_campaigns_per_month,
  traffic_ads_accounts = EXCLUDED.traffic_ads_accounts,
  seo_generations_per_month = EXCLUDED.seo_generations_per_month,
  updated_at = now();

-- 4. TABELA DE RESTRIÇÕES DE MÓDULOS POR PLANO
CREATE TABLE IF NOT EXISTS public.plan_module_access (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_key TEXT NOT NULL REFERENCES public.billing_plans(plan_key) ON DELETE CASCADE,
  module_key TEXT NOT NULL,
  access_level TEXT NOT NULL DEFAULT 'full', -- 'none', 'partial', 'full'
  allowed_features JSONB DEFAULT '[]'::jsonb,
  blocked_features JSONB DEFAULT '[]'::jsonb,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  UNIQUE(plan_key, module_key)
);

-- Inserir restrições de módulos para BÁSICO
INSERT INTO public.plan_module_access (plan_key, module_key, access_level, blocked_features, notes) VALUES
  ('basico', 'central', 'partial', '["analytics", "reports", "agenda", "assistant"]', 'Apenas Visão Geral'),
  ('basico', 'ecommerce', 'partial', '["export_orders", "export_customers"]', 'Sem exportação'),
  ('basico', 'loja_online', 'partial', '["templates"]', 'Sem templates prontos'),
  ('basico', 'blog', 'partial', '["ai_campaigns"]', 'Apenas criação manual'),
  ('basico', 'marketing_basico', 'partial', '["attribution"]', 'Sem atribuição de vendas'),
  ('basico', 'marketing_avancado', 'none', '["*"]', 'Totalmente bloqueado'),
  ('basico', 'crm', 'partial', '["whatsapp_notifications", "support_chat", "support_whatsapp"]', 'Email + Avaliações apenas'),
  ('basico', 'erp_fiscal', 'full', '[]', 'Liberado'),
  ('basico', 'erp_compras', 'none', '["*"]', 'Bloqueado'),
  ('basico', 'erp_financeiro', 'none', '["*"]', 'Bloqueado'),
  ('basico', 'erp_logistica', 'partial', '["remessas", "frete_personalizado", "conversao_carrinho"]', 'Apenas Frenet + Regras frete grátis'),
  ('basico', 'parcerias', 'none', '["*"]', 'Bloqueado'),
  ('basico', 'marketplaces', 'partial', '["mercadolivre", "shopee", "amazon"]', 'Apenas Olist'),
  ('basico', 'sistema_usuarios', 'none', '["*"]', 'Bloqueado'),
  ('basico', 'sistema_importacao', 'none', '["*"]', 'Bloqueado'),
  ('basico', 'sistema_integracoes', 'partial', '["pagseguro", "pix_proprio", "meta", "tiktok"]', 'Apenas Mercado Pago + Domínio'),
  ('basico', 'suporte', 'partial', '["whatsapp", "customizacoes", "tutorials"]', 'Email + Sugestões')
ON CONFLICT (plan_key, module_key) DO UPDATE SET
  access_level = EXCLUDED.access_level,
  blocked_features = EXCLUDED.blocked_features,
  notes = EXCLUDED.notes;

-- Inserir restrições para EVOLUÇÃO (similar ao básico com algumas liberações)
INSERT INTO public.plan_module_access (plan_key, module_key, access_level, blocked_features, notes) VALUES
  ('evolucao', 'central', 'partial', '["analytics", "reports", "agenda", "assistant"]', 'Apenas Visão Geral'),
  ('evolucao', 'ecommerce', 'full', '[]', 'Completo'),
  ('evolucao', 'loja_online', 'full', '[]', 'Completo'),
  ('evolucao', 'blog', 'partial', '["ai_campaigns"]', 'Apenas criação manual'),
  ('evolucao', 'marketing_basico', 'partial', '["attribution"]', 'Sem atribuição de vendas'),
  ('evolucao', 'marketing_avancado', 'none', '["*"]', 'Bloqueado'),
  ('evolucao', 'crm', 'partial', '["whatsapp_notifications", "support_chat", "support_whatsapp"]', 'Email + Avaliações'),
  ('evolucao', 'erp_logistica', 'full', '[]', 'Completo'),
  ('evolucao', 'parcerias', 'none', '["*"]', 'Bloqueado'),
  ('evolucao', 'marketplaces', 'partial', '["mercadolivre", "shopee", "amazon"]', 'Apenas Olist'),
  ('evolucao', 'sistema_usuarios', 'none', '["*"]', 'Bloqueado'),
  ('evolucao', 'sistema_importacao', 'partial', '[]', '1 uso/mês'),
  ('evolucao', 'sistema_integracoes', 'partial', '["meta", "tiktok"]', 'Pagamentos + Domínio'),
  ('evolucao', 'suporte', 'partial', '["whatsapp", "customizacoes", "tutorials"]', 'Email + Sugestões')
ON CONFLICT (plan_key, module_key) DO UPDATE SET
  access_level = EXCLUDED.access_level,
  blocked_features = EXCLUDED.blocked_features,
  notes = EXCLUDED.notes;

-- Inserir restrições para PROFISSIONAL
INSERT INTO public.plan_module_access (plan_key, module_key, access_level, blocked_features, notes) VALUES
  ('profissional', 'central', 'partial', '["agenda"]', 'Quase completo, sem agenda'),
  ('profissional', 'ecommerce', 'full', '[]', 'Completo'),
  ('profissional', 'loja_online', 'full', '[]', 'Completo'),
  ('profissional', 'blog', 'full', '[]', 'Completo com IA'),
  ('profissional', 'marketing_basico', 'full', '[]', 'Completo'),
  ('profissional', 'marketing_avancado', 'partial', '["email_marketing", "quizzes"]', 'Sem Email Marketing e Quizzes'),
  ('profissional', 'crm', 'partial', '["support_chat", "support_whatsapp"]', 'Notificações completas + Avaliações'),
  ('profissional', 'erp_compras', 'none', '["*"]', 'Bloqueado'),
  ('profissional', 'erp_financeiro', 'none', '["*"]', 'Bloqueado'),
  ('profissional', 'parcerias', 'none', '["*"]', 'Bloqueado'),
  ('profissional', 'marketplaces', 'full', '[]', 'Completo'),
  ('profissional', 'sistema_usuarios', 'none', '["*"]', 'Bloqueado'),
  ('profissional', 'sistema_importacao', 'partial', '[]', '2 usos/mês'),
  ('profissional', 'sistema_integracoes', 'full', '[]', 'Completo'),
  ('profissional', 'suporte', 'partial', '["whatsapp", "customizacoes"]', 'Chat liberado')
ON CONFLICT (plan_key, module_key) DO UPDATE SET
  access_level = EXCLUDED.access_level,
  blocked_features = EXCLUDED.blocked_features,
  notes = EXCLUDED.notes;

-- Inserir restrições para AVANÇADO
INSERT INTO public.plan_module_access (plan_key, module_key, access_level, blocked_features, notes) VALUES
  ('avancado', 'central', 'full', '[]', 'Completo'),
  ('avancado', 'marketing_avancado', 'partial', '["email_marketing", "quizzes"]', 'Sem Email Marketing e Quizzes'),
  ('avancado', 'crm', 'full', '[]', 'Completo com limite 1000 pedidos'),
  ('avancado', 'erp_compras', 'none', '["*"]', 'Bloqueado'),
  ('avancado', 'erp_financeiro', 'none', '["*"]', 'Bloqueado'),
  ('avancado', 'parcerias', 'none', '["*"]', 'Bloqueado'),
  ('avancado', 'sistema_usuarios', 'partial', '[]', 'Até 2 usuários'),
  ('avancado', 'suporte', 'partial', '["customizacoes"]', 'Sem customizações')
ON CONFLICT (plan_key, module_key) DO UPDATE SET
  access_level = EXCLUDED.access_level,
  blocked_features = EXCLUDED.blocked_features,
  notes = EXCLUDED.notes;

-- IMPULSO e superiores: Full access
INSERT INTO public.plan_module_access (plan_key, module_key, access_level, notes) 
SELECT p.plan_key, m.module_key, 'full', 'Completo'
FROM (VALUES ('impulso'), ('consolidar'), ('comando_maximo'), ('customizado')) AS p(plan_key)
CROSS JOIN (VALUES 
  ('central'), ('ecommerce'), ('loja_online'), ('blog'), ('marketing_basico'),
  ('marketing_avancado'), ('crm'), ('erp_fiscal'), ('erp_compras'), ('erp_financeiro'),
  ('erp_logistica'), ('parcerias'), ('marketplaces'), ('sistema_usuarios'),
  ('sistema_importacao'), ('sistema_integracoes'), ('suporte')
) AS m(module_key)
ON CONFLICT (plan_key, module_key) DO UPDATE SET access_level = 'full';

-- 5. SISTEMA DE CRÉDITOS DE IA
-- Pacotes de créditos para compra
CREATE TABLE IF NOT EXISTS public.credit_packages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sku TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  credits INTEGER NOT NULL,
  bonus_credits INTEGER DEFAULT 0,
  price_cents INTEGER NOT NULL,
  is_active BOOLEAN DEFAULT true,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Inserir pacotes de créditos
INSERT INTO public.credit_packages (sku, name, description, credits, bonus_credits, price_cents, sort_order) VALUES
  ('CC_CREDITS_1K', '1.000 Créditos', 'Pacote inicial', 1000, 0, 1000, 1),
  ('CC_CREDITS_5K', '5.000 Créditos', 'Pacote básico', 5000, 0, 5000, 2),
  ('CC_CREDITS_15K', '15.000 Créditos', 'Pacote intermediário', 15000, 500, 15000, 3),
  ('CC_CREDITS_50K', '50.000 Créditos', 'Pacote avançado', 50000, 2500, 50000, 4),
  ('CC_CREDITS_150K', '150.000 Créditos', 'Pacote profissional', 150000, 10000, 150000, 5),
  ('CC_CREDITS_500K', '500.000 Créditos', 'Pacote enterprise', 500000, 50000, 500000, 6)
ON CONFLICT (sku) DO UPDATE SET
  name = EXCLUDED.name,
  credits = EXCLUDED.credits,
  bonus_credits = EXCLUDED.bonus_credits,
  price_cents = EXCLUDED.price_cents,
  sort_order = EXCLUDED.sort_order,
  updated_at = now();

-- Carteira de créditos do tenant
CREATE TABLE IF NOT EXISTS public.credit_wallet (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  balance_credits INTEGER NOT NULL DEFAULT 0,
  reserved_credits INTEGER NOT NULL DEFAULT 0,
  lifetime_purchased INTEGER NOT NULL DEFAULT 0,
  lifetime_consumed INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  UNIQUE(tenant_id),
  CONSTRAINT positive_balance CHECK (balance_credits >= 0),
  CONSTRAINT positive_reserved CHECK (reserved_credits >= 0)
);

-- Ledger de transações de créditos
CREATE TABLE IF NOT EXISTS public.credit_ledger (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id UUID,
  
  -- Tipo de transação
  transaction_type TEXT NOT NULL, -- 'purchase', 'reserve', 'consume', 'refund', 'adjust', 'bonus'
  
  -- Detalhes do uso
  provider TEXT, -- 'openai', 'fal', 'gemini'
  model TEXT,
  feature TEXT, -- 'chat', 'vision', 'audio', 'image', 'video', 'avatar', 'seo', 'embedding'
  
  -- Quantidades
  units_json JSONB, -- {"tokens_in": 1000, "tokens_out": 500} ou {"seconds": 30} ou {"images": 1}
  
  -- Valores
  cost_usd DECIMAL(10, 6), -- Custo real do provedor
  sell_usd DECIMAL(10, 6), -- Custo com markup (50%)
  credits_delta INTEGER NOT NULL, -- Positivo para compras, negativo para consumo
  
  -- Controle de duplicação
  idempotency_key TEXT,
  
  -- Referência a job (para vídeos/avatares)
  job_id UUID,
  
  -- Metadados
  metadata JSONB,
  description TEXT,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  UNIQUE(idempotency_key)
);

-- Tabela de preços de IA (custo base do provedor)
CREATE TABLE IF NOT EXISTS public.ai_pricing (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider TEXT NOT NULL,
  model TEXT NOT NULL,
  pricing_type TEXT NOT NULL, -- 'per_1m_tokens_in', 'per_1m_tokens_out', 'per_minute', 'per_second', 'per_image'
  cost_usd DECIMAL(10, 6) NOT NULL,
  resolution TEXT, -- Para imagens: 'low_1024', 'medium_1024x1536', etc
  quality TEXT, -- 'standard', 'pro', 'fast'
  has_audio BOOLEAN, -- Para vídeos
  effective_from TIMESTAMPTZ NOT NULL DEFAULT now(),
  effective_until TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  UNIQUE(provider, model, pricing_type, resolution, quality, has_audio, effective_from)
);

-- Inserir preços base (custo do provedor, sem markup)
INSERT INTO public.ai_pricing (provider, model, pricing_type, cost_usd, resolution, quality, has_audio) VALUES
  -- OpenAI GPT-5.2
  ('openai', 'gpt-5.2', 'per_1m_tokens_in', 1.75, NULL, NULL, NULL),
  ('openai', 'gpt-5.2', 'per_1m_tokens_in_cached', 0.175, NULL, NULL, NULL),
  ('openai', 'gpt-5.2', 'per_1m_tokens_out', 14.00, NULL, NULL, NULL),
  
  -- OpenAI GPT-4o (Vision)
  ('openai', 'gpt-4o', 'per_1m_tokens_in', 2.50, NULL, NULL, NULL),
  ('openai', 'gpt-4o', 'per_1m_tokens_in_cached', 1.25, NULL, NULL, NULL),
  ('openai', 'gpt-4o', 'per_1m_tokens_out', 10.00, NULL, NULL, NULL),
  
  -- Whisper
  ('openai', 'whisper-1', 'per_minute', 0.006, NULL, NULL, NULL),
  
  -- Embeddings
  ('openai', 'text-embedding-3-small', 'per_1m_tokens', 0.02, NULL, NULL, NULL),
  
  -- Gemini 2.5 Flash
  ('gemini', 'gemini-2.5-flash', 'per_1m_tokens_in', 0.30, NULL, NULL, NULL),
  ('gemini', 'gemini-2.5-flash', 'per_1m_tokens_in_cached', 0.03, NULL, NULL, NULL),
  ('gemini', 'gemini-2.5-flash', 'per_1m_tokens_out', 2.50, NULL, NULL, NULL),
  
  -- Fal GPT Image 1.5 (por imagem, por resolução)
  ('fal', 'gpt-image-1.5', 'per_image', 0.009, 'low_1024', NULL, NULL),
  ('fal', 'gpt-image-1.5', 'per_image', 0.013, 'low_other', NULL, NULL),
  ('fal', 'gpt-image-1.5', 'per_image', 0.034, 'medium_1024', NULL, NULL),
  ('fal', 'gpt-image-1.5', 'per_image', 0.051, 'medium_1024x1536', NULL, NULL),
  ('fal', 'gpt-image-1.5', 'per_image', 0.050, 'medium_1536x1024', NULL, NULL),
  ('fal', 'gpt-image-1.5', 'per_image', 0.133, 'high_1024', NULL, NULL),
  ('fal', 'gpt-image-1.5', 'per_image', 0.200, 'high_1024x1536', NULL, NULL),
  ('fal', 'gpt-image-1.5', 'per_image', 0.199, 'high_1536x1024', NULL, NULL),
  
  -- Fal Sora 2 (por segundo)
  ('fal', 'sora-2', 'per_second', 0.10, NULL, 'standard', NULL),
  ('fal', 'sora-2', 'per_second', 0.30, NULL, 'pro_720p', NULL),
  ('fal', 'sora-2', 'per_second', 0.50, NULL, 'pro_1080p', NULL),
  
  -- Fal Veo 3.1 (por segundo)
  ('fal', 'veo-3.1', 'per_second', 0.10, NULL, 'fast', false),
  ('fal', 'veo-3.1', 'per_second', 0.15, NULL, 'fast', true),
  ('fal', 'veo-3.1', 'per_second', 0.20, NULL, 'standard', false),
  ('fal', 'veo-3.1', 'per_second', 0.40, NULL, 'standard', true),
  ('fal', 'veo-3.1', 'per_second', 0.40, '4k', 'standard', false),
  ('fal', 'veo-3.1', 'per_second', 0.60, '4k', 'standard', true),
  
  -- Fal Kling Video
  ('fal', 'kling-video', 'per_second', 0.07, NULL, 'pro', NULL),
  
  -- Fal Kling Avatar
  ('fal', 'kling-avatar-v2-pro', 'per_second', 0.115, NULL, NULL, NULL)
ON CONFLICT DO NOTHING;

-- 6. FUNÇÕES PARA GESTÃO DE CRÉDITOS

-- Função para verificar saldo antes de uso
CREATE OR REPLACE FUNCTION public.check_credit_balance(p_tenant_id UUID, p_credits_needed INTEGER)
RETURNS TABLE(has_balance BOOLEAN, current_balance INTEGER, credits_missing INTEGER)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    (COALESCE(balance_credits, 0) - COALESCE(reserved_credits, 0)) >= p_credits_needed,
    COALESCE(balance_credits, 0) - COALESCE(reserved_credits, 0),
    GREATEST(0, p_credits_needed - (COALESCE(balance_credits, 0) - COALESCE(reserved_credits, 0)))
  FROM credit_wallet
  WHERE tenant_id = p_tenant_id
  UNION ALL
  SELECT false, 0, p_credits_needed
  WHERE NOT EXISTS (SELECT 1 FROM credit_wallet WHERE tenant_id = p_tenant_id)
  LIMIT 1;
$$;

-- Função para reservar créditos (antes de job longo)
CREATE OR REPLACE FUNCTION public.reserve_credits(
  p_tenant_id UUID,
  p_credits INTEGER,
  p_idempotency_key TEXT,
  p_job_id UUID DEFAULT NULL
)
RETURNS TABLE(success BOOLEAN, error_message TEXT, new_balance INTEGER)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_available INTEGER;
BEGIN
  -- Verificar se já existe transação com essa chave
  IF EXISTS (SELECT 1 FROM credit_ledger WHERE idempotency_key = p_idempotency_key) THEN
    RETURN QUERY SELECT true, NULL::TEXT, (SELECT balance_credits - reserved_credits FROM credit_wallet WHERE tenant_id = p_tenant_id);
    RETURN;
  END IF;
  
  -- Verificar saldo disponível
  SELECT balance_credits - reserved_credits INTO v_available
  FROM credit_wallet
  WHERE tenant_id = p_tenant_id
  FOR UPDATE;
  
  IF v_available IS NULL OR v_available < p_credits THEN
    RETURN QUERY SELECT false, 'Saldo insuficiente. Faltam ' || (p_credits - COALESCE(v_available, 0)) || ' créditos.', COALESCE(v_available, 0);
    RETURN;
  END IF;
  
  -- Reservar créditos
  UPDATE credit_wallet
  SET reserved_credits = reserved_credits + p_credits, updated_at = now()
  WHERE tenant_id = p_tenant_id;
  
  -- Registrar no ledger
  INSERT INTO credit_ledger (tenant_id, transaction_type, credits_delta, idempotency_key, job_id, description)
  VALUES (p_tenant_id, 'reserve', -p_credits, p_idempotency_key, p_job_id, 'Reserva para processamento');
  
  RETURN QUERY SELECT true, NULL::TEXT, (SELECT balance_credits - reserved_credits FROM credit_wallet WHERE tenant_id = p_tenant_id);
END;
$$;

-- Função para consumir créditos (uso real)
CREATE OR REPLACE FUNCTION public.consume_credits(
  p_tenant_id UUID,
  p_user_id UUID,
  p_credits INTEGER,
  p_idempotency_key TEXT,
  p_provider TEXT,
  p_model TEXT,
  p_feature TEXT,
  p_units_json JSONB,
  p_cost_usd DECIMAL,
  p_job_id UUID DEFAULT NULL,
  p_from_reserve BOOLEAN DEFAULT false
)
RETURNS TABLE(success BOOLEAN, error_message TEXT, new_balance INTEGER)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sell_usd DECIMAL;
  v_available INTEGER;
BEGIN
  -- Verificar duplicação
  IF EXISTS (SELECT 1 FROM credit_ledger WHERE idempotency_key = p_idempotency_key AND transaction_type = 'consume') THEN
    RETURN QUERY SELECT true, NULL::TEXT, (SELECT balance_credits - reserved_credits FROM credit_wallet WHERE tenant_id = p_tenant_id);
    RETURN;
  END IF;
  
  -- Calcular preço de venda (markup 50%)
  v_sell_usd := p_cost_usd * 1.5;
  
  IF p_from_reserve THEN
    -- Liberar da reserva e debitar do saldo
    UPDATE credit_wallet
    SET 
      reserved_credits = reserved_credits - p_credits,
      balance_credits = balance_credits - p_credits,
      lifetime_consumed = lifetime_consumed + p_credits,
      updated_at = now()
    WHERE tenant_id = p_tenant_id;
  ELSE
    -- Verificar saldo disponível
    SELECT balance_credits - reserved_credits INTO v_available
    FROM credit_wallet
    WHERE tenant_id = p_tenant_id
    FOR UPDATE;
    
    IF v_available IS NULL OR v_available < p_credits THEN
      RETURN QUERY SELECT false, 'Saldo insuficiente', COALESCE(v_available, 0);
      RETURN;
    END IF;
    
    -- Debitar diretamente
    UPDATE credit_wallet
    SET 
      balance_credits = balance_credits - p_credits,
      lifetime_consumed = lifetime_consumed + p_credits,
      updated_at = now()
    WHERE tenant_id = p_tenant_id;
  END IF;
  
  -- Registrar no ledger
  INSERT INTO credit_ledger (
    tenant_id, user_id, transaction_type, provider, model, feature,
    units_json, cost_usd, sell_usd, credits_delta, idempotency_key, job_id
  ) VALUES (
    p_tenant_id, p_user_id, 'consume', p_provider, p_model, p_feature,
    p_units_json, p_cost_usd, v_sell_usd, -p_credits, p_idempotency_key, p_job_id
  );
  
  RETURN QUERY SELECT true, NULL::TEXT, (SELECT balance_credits - reserved_credits FROM credit_wallet WHERE tenant_id = p_tenant_id);
END;
$$;

-- Função para adicionar créditos (compra)
CREATE OR REPLACE FUNCTION public.add_credits(
  p_tenant_id UUID,
  p_credits INTEGER,
  p_bonus INTEGER,
  p_idempotency_key TEXT,
  p_description TEXT DEFAULT 'Compra de créditos'
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total INTEGER;
  v_new_balance INTEGER;
BEGIN
  v_total := p_credits + p_bonus;
  
  -- Verificar duplicação
  IF EXISTS (SELECT 1 FROM credit_ledger WHERE idempotency_key = p_idempotency_key) THEN
    SELECT balance_credits INTO v_new_balance FROM credit_wallet WHERE tenant_id = p_tenant_id;
    RETURN v_new_balance;
  END IF;
  
  -- Criar wallet se não existir ou atualizar
  INSERT INTO credit_wallet (tenant_id, balance_credits, lifetime_purchased)
  VALUES (p_tenant_id, v_total, p_credits)
  ON CONFLICT (tenant_id) DO UPDATE SET
    balance_credits = credit_wallet.balance_credits + v_total,
    lifetime_purchased = credit_wallet.lifetime_purchased + p_credits,
    updated_at = now()
  RETURNING balance_credits INTO v_new_balance;
  
  -- Registrar compra
  INSERT INTO credit_ledger (tenant_id, transaction_type, credits_delta, idempotency_key, description)
  VALUES (p_tenant_id, 'purchase', p_credits, p_idempotency_key, p_description);
  
  -- Registrar bônus se houver
  IF p_bonus > 0 THEN
    INSERT INTO credit_ledger (tenant_id, transaction_type, credits_delta, idempotency_key, description)
    VALUES (p_tenant_id, 'bonus', p_bonus, p_idempotency_key || '_bonus', 'Bônus de compra');
  END IF;
  
  RETURN v_new_balance;
END;
$$;

-- 7. RLS POLICIES

-- plan_limits
ALTER TABLE public.plan_limits ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read plan_limits" ON public.plan_limits FOR SELECT USING (true);
CREATE POLICY "Platform admin manage plan_limits" ON public.plan_limits FOR ALL 
  USING (public.is_platform_admin_by_auth());

-- plan_module_access
ALTER TABLE public.plan_module_access ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read plan_module_access" ON public.plan_module_access FOR SELECT USING (true);
CREATE POLICY "Platform admin manage plan_module_access" ON public.plan_module_access FOR ALL 
  USING (public.is_platform_admin_by_auth());

-- credit_packages
ALTER TABLE public.credit_packages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read active credit_packages" ON public.credit_packages FOR SELECT USING (is_active = true);
CREATE POLICY "Platform admin manage credit_packages" ON public.credit_packages FOR ALL 
  USING (public.is_platform_admin_by_auth());

-- credit_wallet
ALTER TABLE public.credit_wallet ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tenant read own wallet" ON public.credit_wallet FOR SELECT 
  USING (public.user_has_tenant_access(tenant_id));
CREATE POLICY "System manage wallets" ON public.credit_wallet FOR ALL 
  USING (public.is_platform_admin_by_auth() OR public.user_has_tenant_access(tenant_id));

-- credit_ledger
ALTER TABLE public.credit_ledger ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tenant read own ledger" ON public.credit_ledger FOR SELECT 
  USING (public.user_has_tenant_access(tenant_id));
CREATE POLICY "Platform admin read all ledger" ON public.credit_ledger FOR SELECT 
  USING (public.is_platform_admin_by_auth());

-- ai_pricing
ALTER TABLE public.ai_pricing ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read ai_pricing" ON public.ai_pricing FOR SELECT USING (true);
CREATE POLICY "Platform admin manage ai_pricing" ON public.ai_pricing FOR ALL 
  USING (public.is_platform_admin_by_auth());

-- 8. ÍNDICES PARA PERFORMANCE
CREATE INDEX IF NOT EXISTS idx_credit_ledger_tenant ON public.credit_ledger(tenant_id);
CREATE INDEX IF NOT EXISTS idx_credit_ledger_created ON public.credit_ledger(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_credit_ledger_idempotency ON public.credit_ledger(idempotency_key);
CREATE INDEX IF NOT EXISTS idx_plan_limits_plan ON public.plan_limits(plan_key);
CREATE INDEX IF NOT EXISTS idx_plan_module_access_plan ON public.plan_module_access(plan_key);
CREATE INDEX IF NOT EXISTS idx_ai_pricing_provider ON public.ai_pricing(provider, model);