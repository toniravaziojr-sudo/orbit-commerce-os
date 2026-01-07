-- Add metadata column to late_onboarding_states for storing platform info
ALTER TABLE public.late_onboarding_states 
ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;