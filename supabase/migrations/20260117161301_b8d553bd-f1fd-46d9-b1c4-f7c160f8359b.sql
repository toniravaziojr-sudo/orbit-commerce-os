-- Drop the existing policy that doesn't have WITH CHECK
DROP POLICY IF EXISTS "Admins can manage related products" ON public.related_products;

-- Recreate with proper WITH CHECK clause for INSERT/UPDATE/DELETE
CREATE POLICY "Admins can manage related products"
ON public.related_products
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM products p
    WHERE p.id = related_products.product_id
    AND (
      has_role(auth.uid(), p.tenant_id, 'owner'::app_role) OR
      has_role(auth.uid(), p.tenant_id, 'admin'::app_role) OR
      has_role(auth.uid(), p.tenant_id, 'operator'::app_role)
    )
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM products p
    WHERE p.id = related_products.product_id
    AND (
      has_role(auth.uid(), p.tenant_id, 'owner'::app_role) OR
      has_role(auth.uid(), p.tenant_id, 'admin'::app_role) OR
      has_role(auth.uid(), p.tenant_id, 'operator'::app_role)
    )
  )
);