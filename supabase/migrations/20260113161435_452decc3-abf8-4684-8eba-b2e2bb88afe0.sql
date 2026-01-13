-- =============================================
-- MULTI-TEMPLATE SYSTEM FOR STOREFRONT
-- =============================================
-- This migration creates a system where:
-- 1. Each tenant can have multiple templates
-- 2. Each template has its own name, draft/published content
-- 3. Only one template is "active" (published) at a time via store_settings.published_template_id

-- Create the new template sets table
CREATE TABLE IF NOT EXISTS public.storefront_template_sets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    base_preset TEXT NOT NULL DEFAULT 'blank', -- 'blank', 'cosmetics', 'custom'
    draft_content JSONB DEFAULT '{}'::jsonb,
    published_content JSONB DEFAULT NULL,
    is_published BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_edited_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    is_archived BOOLEAN DEFAULT FALSE
);

-- Create index for tenant lookups
CREATE INDEX IF NOT EXISTS idx_storefront_template_sets_tenant 
    ON public.storefront_template_sets(tenant_id);

-- Add published_template_id to store_settings if not exists
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'store_settings' 
        AND column_name = 'published_template_id'
    ) THEN
        ALTER TABLE public.store_settings 
        ADD COLUMN published_template_id UUID REFERENCES public.storefront_template_sets(id) ON DELETE SET NULL;
    END IF;
END $$;

-- Enable RLS
ALTER TABLE public.storefront_template_sets ENABLE ROW LEVEL SECURITY;

-- RLS Policies for storefront_template_sets
-- SELECT: tenant members can view their templates
CREATE POLICY "Tenant members can view their templates" 
ON public.storefront_template_sets 
FOR SELECT 
USING (public.user_belongs_to_tenant(auth.uid(), tenant_id));

-- INSERT: tenant members with appropriate roles can create templates
CREATE POLICY "Tenant members can create templates" 
ON public.storefront_template_sets 
FOR INSERT 
WITH CHECK (public.user_belongs_to_tenant(auth.uid(), tenant_id));

-- UPDATE: tenant members can update their templates
CREATE POLICY "Tenant members can update templates" 
ON public.storefront_template_sets 
FOR UPDATE 
USING (public.user_belongs_to_tenant(auth.uid(), tenant_id));

-- DELETE: tenant members can delete their templates
CREATE POLICY "Tenant members can delete templates" 
ON public.storefront_template_sets 
FOR DELETE 
USING (public.user_belongs_to_tenant(auth.uid(), tenant_id));

-- Trigger to update updated_at
CREATE OR REPLACE FUNCTION public.update_storefront_template_sets_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_storefront_template_sets_updated_at ON public.storefront_template_sets;
CREATE TRIGGER update_storefront_template_sets_updated_at
    BEFORE UPDATE ON public.storefront_template_sets
    FOR EACH ROW
    EXECUTE FUNCTION public.update_storefront_template_sets_updated_at();

-- Migration function: Create initial template from existing data for each tenant
-- This ensures backward compatibility
CREATE OR REPLACE FUNCTION public.migrate_existing_templates_to_sets()
RETURNS void AS $$
DECLARE
    tenant_record RECORD;
    new_template_id UUID;
    existing_content JSONB;
BEGIN
    -- For each tenant that has store_settings but no template_sets
    FOR tenant_record IN 
        SELECT ss.tenant_id, ss.id as settings_id, ss.is_published
        FROM public.store_settings ss
        WHERE NOT EXISTS (
            SELECT 1 FROM public.storefront_template_sets sts 
            WHERE sts.tenant_id = ss.tenant_id
        )
    LOOP
        -- Try to get existing home template content from storefront_page_templates
        SELECT jsonb_build_object(
            'home', (SELECT content FROM public.store_page_versions spv 
                     JOIN public.storefront_page_templates spt ON spv.tenant_id = spt.tenant_id 
                     AND spv.page_type = spt.page_type
                     WHERE spt.tenant_id = tenant_record.tenant_id 
                     AND spt.page_type = 'home'
                     ORDER BY spv.version DESC LIMIT 1)
        ) INTO existing_content;
        
        -- If no content, use empty object
        IF existing_content IS NULL OR existing_content->>'home' IS NULL THEN
            existing_content := '{}'::jsonb;
        END IF;
        
        -- Create default template
        INSERT INTO public.storefront_template_sets (
            tenant_id, 
            name, 
            base_preset,
            draft_content,
            published_content,
            is_published
        ) VALUES (
            tenant_record.tenant_id,
            'Template Padrão',
            'cosmetics',
            existing_content,
            CASE WHEN tenant_record.is_published THEN existing_content ELSE NULL END,
            tenant_record.is_published
        )
        RETURNING id INTO new_template_id;
        
        -- Update store_settings with the new template id
        UPDATE public.store_settings 
        SET published_template_id = new_template_id
        WHERE tenant_id = tenant_record.tenant_id;
    END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Run the migration
SELECT public.migrate_existing_templates_to_sets();