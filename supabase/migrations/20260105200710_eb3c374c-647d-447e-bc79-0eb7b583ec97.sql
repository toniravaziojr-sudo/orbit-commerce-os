
-- Criar enum para tipos de tenant
CREATE TYPE tenant_type AS ENUM ('platform', 'customer');

-- Adicionar coluna type na tabela tenants
ALTER TABLE tenants 
ADD COLUMN type tenant_type NOT NULL DEFAULT 'customer';

-- Marcar o tenant Comando Central como platform
UPDATE tenants 
SET type = 'platform' 
WHERE id = 'cc000000-0000-0000-0000-000000000001';

-- Adicionar comentário para documentação
COMMENT ON COLUMN tenants.type IS 'Tipo de tenant: platform (admin único), customer (clientes normais)';
