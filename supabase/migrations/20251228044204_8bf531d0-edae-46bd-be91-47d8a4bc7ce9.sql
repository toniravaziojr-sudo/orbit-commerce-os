-- Add rules column to ai_support_config for storing AI behavior rules
ALTER TABLE public.ai_support_config 
ADD COLUMN IF NOT EXISTS rules JSONB DEFAULT '[]'::jsonb;

-- Add comment
COMMENT ON COLUMN public.ai_support_config.rules IS 'Array of AI behavior rules with condition, action, response, priority, category';