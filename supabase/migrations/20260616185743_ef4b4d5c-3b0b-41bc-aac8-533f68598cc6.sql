ALTER TABLE public.ai_prompt_conflict_cache
  ALTER COLUMN channel SET DEFAULT '',
  ALTER COLUMN ad_account_id SET DEFAULT '';
UPDATE public.ai_prompt_conflict_cache SET channel = '' WHERE channel IS NULL;
UPDATE public.ai_prompt_conflict_cache SET ad_account_id = '' WHERE ad_account_id IS NULL;
ALTER TABLE public.ai_prompt_conflict_cache
  ALTER COLUMN channel SET NOT NULL,
  ALTER COLUMN ad_account_id SET NOT NULL;
DROP INDEX IF EXISTS public.ai_prompt_conflict_cache_unique_key;
CREATE UNIQUE INDEX ai_prompt_conflict_cache_unique_key
  ON public.ai_prompt_conflict_cache (tenant_id, scope, channel, ad_account_id, prompt_hash);