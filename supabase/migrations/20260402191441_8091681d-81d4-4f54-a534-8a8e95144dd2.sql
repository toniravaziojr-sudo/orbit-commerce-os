
-- Create questionnaire responses table
CREATE TABLE public.questionnaire_responses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE NOT NULL,
  block_key TEXT NOT NULL,
  question_number INTEGER NOT NULL,
  answer TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, block_key, question_number)
);

-- Enable RLS
ALTER TABLE public.questionnaire_responses ENABLE ROW LEVEL SECURITY;

-- Platform admins can do everything
CREATE POLICY "Platform admins can manage questionnaire responses"
ON public.questionnaire_responses
FOR ALL
USING (public.is_platform_admin())
WITH CHECK (public.is_platform_admin());

-- Trigger for updated_at
CREATE TRIGGER update_questionnaire_responses_updated_at
BEFORE UPDATE ON public.questionnaire_responses
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
