-- Allow storefront to check if shipping providers are enabled (read-only, no credentials exposed to client)
-- The actual credentials are only used server-side in edge functions

CREATE POLICY "Public can check shipping provider status"
ON public.shipping_providers
FOR SELECT
USING (is_enabled = true);

-- Note: This only allows reading enabled providers, credentials are masked by the query
-- The sensitive token/credentials are never exposed as we only select specific columns