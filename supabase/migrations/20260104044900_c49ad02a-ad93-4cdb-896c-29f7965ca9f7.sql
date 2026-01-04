-- =============================================
-- SISTEMA DE KITS E COMPOSIÇÃO DE PRODUTOS
-- =============================================

-- Adicionar colunas de formato e tipo de estoque em products
ALTER TABLE products ADD COLUMN IF NOT EXISTS product_format TEXT DEFAULT 'simple' 
  CHECK (product_format IN ('simple', 'with_variants', 'with_composition'));

ALTER TABLE products ADD COLUMN IF NOT EXISTS stock_type TEXT DEFAULT 'physical' 
  CHECK (stock_type IN ('physical', 'virtual'));

-- Criar tabela de componentes de produtos (para kits)
CREATE TABLE IF NOT EXISTS product_components (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  component_product_id UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  quantity DECIMAL(10,2) NOT NULL DEFAULT 1,
  cost_price DECIMAL(10,2),
  sale_price DECIMAL(10,2),
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  
  -- Constraints
  UNIQUE(parent_product_id, component_product_id),
  -- Evitar que produto seja seu próprio componente
  CHECK(parent_product_id != component_product_id)
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_product_components_parent ON product_components(parent_product_id);
CREATE INDEX IF NOT EXISTS idx_product_components_component ON product_components(component_product_id);

-- Trigger para updated_at
CREATE OR REPLACE FUNCTION update_product_components_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_product_components_updated_at_trigger ON product_components;
CREATE TRIGGER update_product_components_updated_at_trigger
  BEFORE UPDATE ON product_components
  FOR EACH ROW
  EXECUTE FUNCTION update_product_components_updated_at();

-- RLS para product_components
ALTER TABLE product_components ENABLE ROW LEVEL SECURITY;

-- Policy: Users can manage product components for their tenant
CREATE POLICY "Users can manage product components for their tenant"
ON product_components FOR ALL USING (
  EXISTS (
    SELECT 1 FROM products p
    JOIN user_roles ur ON ur.tenant_id = p.tenant_id
    WHERE p.id = product_components.parent_product_id
    AND ur.user_id = auth.uid()
  )
);

-- Adicionar coluna de desmembramento em fiscal_settings
ALTER TABLE fiscal_settings ADD COLUMN IF NOT EXISTS desmembrar_estrutura BOOLEAN DEFAULT false;