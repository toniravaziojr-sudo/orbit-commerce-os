-- 1.1 Criar enum tenant_plan (idempotente)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'tenant_plan') THEN
    CREATE TYPE tenant_plan AS ENUM ('start', 'growth', 'scale', 'enterprise', 'unlimited');
  END IF;
END $$;

-- 1.2 Adicionar colunas em tenants
ALTER TABLE tenants
  ADD COLUMN IF NOT EXISTS plan tenant_plan NOT NULL DEFAULT 'start',
  ADD COLUMN IF NOT EXISTS is_special boolean NOT NULL DEFAULT false;

-- Garantir valores para registros existentes
UPDATE tenants SET plan = 'start' WHERE plan IS NULL;
UPDATE tenants SET is_special = false WHERE is_special IS NULL;

-- Índices para queries de plano
CREATE INDEX IF NOT EXISTS idx_tenants_plan ON tenants(plan);
CREATE INDEX IF NOT EXISTS idx_tenants_is_special ON tenants(is_special);

-- 1.3 Setar "Respeite o Homem" como special/unlimited
UPDATE tenants
SET plan = 'unlimited', is_special = true
WHERE slug IN ('respeite-o-homem', 'respeiteohomem', 'respeite-o-homem-loja')
   OR lower(name) = 'respeite o homem';

-- 1.4 Criar tabela tenant_feature_overrides (preparação Enterprise)
CREATE TABLE IF NOT EXISTS tenant_feature_overrides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  feature_key text NOT NULL,
  is_enabled boolean NOT NULL,
  note text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, feature_key)
);

CREATE INDEX IF NOT EXISTS idx_tfo_tenant_id ON tenant_feature_overrides(tenant_id);
CREATE INDEX IF NOT EXISTS idx_tfo_feature_key ON tenant_feature_overrides(feature_key);

-- RLS para tenant_feature_overrides
ALTER TABLE tenant_feature_overrides ENABLE ROW LEVEL SECURITY;

-- Policy: admins do tenant podem ler/escrever
CREATE POLICY "Tenant admins can manage their overrides"
ON tenant_feature_overrides
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM user_roles ur
    WHERE ur.user_id = auth.uid()
    AND ur.tenant_id = tenant_feature_overrides.tenant_id
    AND ur.role IN ('owner', 'admin')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM user_roles ur
    WHERE ur.user_id = auth.uid()
    AND ur.tenant_id = tenant_feature_overrides.tenant_id
    AND ur.role IN ('owner', 'admin')
  )
);

-- Policy: platform admins podem ler todos
CREATE POLICY "Platform admins can read all overrides"
ON tenant_feature_overrides
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM platform_admins pa
    WHERE pa.email = (SELECT email FROM auth.users WHERE id = auth.uid())
    AND pa.is_active = true
  )
);