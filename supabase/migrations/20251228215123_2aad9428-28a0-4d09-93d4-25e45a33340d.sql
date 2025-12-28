-- Add channel-specific AI config
CREATE TABLE IF NOT EXISTS public.ai_channel_config (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  channel_type text NOT NULL,
  is_enabled boolean NOT NULL DEFAULT true,
  system_prompt_override text,
  forbidden_topics text[] DEFAULT '{}',
  max_response_length integer,
  use_emojis boolean,
  custom_instructions text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, channel_type)
);

-- Enable RLS
ALTER TABLE public.ai_channel_config ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view their tenant's AI channel config"
  ON public.ai_channel_config FOR SELECT
  USING (tenant_id IN (SELECT tenant_id FROM user_roles WHERE user_id = auth.uid()));

CREATE POLICY "Users can insert their tenant's AI channel config"
  ON public.ai_channel_config FOR INSERT
  WITH CHECK (tenant_id IN (SELECT tenant_id FROM user_roles WHERE user_id = auth.uid()));

CREATE POLICY "Users can update their tenant's AI channel config"
  ON public.ai_channel_config FOR UPDATE
  USING (tenant_id IN (SELECT tenant_id FROM user_roles WHERE user_id = auth.uid()));

CREATE POLICY "Users can delete their tenant's AI channel config"
  ON public.ai_channel_config FOR DELETE
  USING (tenant_id IN (SELECT tenant_id FROM user_roles WHERE user_id = auth.uid()));

-- Add trigger for updated_at
CREATE TRIGGER update_ai_channel_config_updated_at
  BEFORE UPDATE ON public.ai_channel_config
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();