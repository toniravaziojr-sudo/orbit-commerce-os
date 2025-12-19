-- Add public SELECT policy for tenant_domains (only verified + active SSL domains)
-- This allows the storefront to resolve custom domains without authentication
CREATE POLICY "Public can view active domains" 
ON public.tenant_domains 
FOR SELECT 
TO anon
USING (
  status = 'verified' 
  AND ssl_status = 'active'
);