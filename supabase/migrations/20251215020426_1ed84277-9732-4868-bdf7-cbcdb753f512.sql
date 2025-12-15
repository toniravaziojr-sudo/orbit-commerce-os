-- Adicionar novos campos à tabela store_settings existente
-- Mantendo campos existentes para não quebrar nada

-- 1) Informações do negócio (novos campos)
ALTER TABLE public.store_settings
ADD COLUMN IF NOT EXISTS business_legal_name text,
ADD COLUMN IF NOT EXISTS business_cnpj text;

-- 2) Informações de contato (novos campos)
ALTER TABLE public.store_settings
ADD COLUMN IF NOT EXISTS contact_phone text,
ADD COLUMN IF NOT EXISTS contact_email text,
ADD COLUMN IF NOT EXISTS contact_address text,
ADD COLUMN IF NOT EXISTS contact_support_hours text;

-- 3) Redes sociais (novos campos)
ALTER TABLE public.store_settings
ADD COLUMN IF NOT EXISTS social_tiktok text,
ADD COLUMN IF NOT EXISTS social_youtube text,
ADD COLUMN IF NOT EXISTS social_custom jsonb DEFAULT '[]'::jsonb;

-- Criar bucket para assets da loja (logo, favicon)
INSERT INTO storage.buckets (id, name, public)
VALUES ('store-assets', 'store-assets', true)
ON CONFLICT (id) DO NOTHING;

-- RLS para storage: permitir upload apenas para usuários autenticados do tenant
CREATE POLICY "Users can upload store assets for their tenant"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'store-assets' AND
  (storage.foldername(name))[1] = 'tenants' AND
  EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
    AND ur.tenant_id::text = (storage.foldername(name))[2]
    AND ur.role IN ('owner', 'admin')
  )
);

-- Permitir update de assets
CREATE POLICY "Users can update store assets for their tenant"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'store-assets' AND
  (storage.foldername(name))[1] = 'tenants' AND
  EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
    AND ur.tenant_id::text = (storage.foldername(name))[2]
    AND ur.role IN ('owner', 'admin')
  )
);

-- Permitir delete de assets
CREATE POLICY "Users can delete store assets for their tenant"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'store-assets' AND
  (storage.foldername(name))[1] = 'tenants' AND
  EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
    AND ur.tenant_id::text = (storage.foldername(name))[2]
    AND ur.role IN ('owner', 'admin')
  )
);

-- Permitir leitura pública dos assets (bucket é público)
CREATE POLICY "Anyone can view store assets"
ON storage.objects
FOR SELECT
USING (bucket_id = 'store-assets');