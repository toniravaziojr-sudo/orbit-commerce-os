-- Onda 4.2 - Migration 3: Category C - Tighten public storefront write endpoints
-- Replace bare WITH CHECK (true) with minimum validation:
--   - tenant_id must reference an existing tenant
--   - cart_id (when applicable) must reference an existing cart

-- 1. affiliate_clicks
DROP POLICY IF EXISTS "Anyone can insert affiliate clicks" ON public.affiliate_clicks;
CREATE POLICY "Anyone can insert affiliate clicks" ON public.affiliate_clicks
  AS PERMISSIVE FOR INSERT TO public
  WITH CHECK (tenant_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.tenants t WHERE t.id = tenant_id));

-- 2. carts (INSERT)
DROP POLICY IF EXISTS "Anyone can create carts" ON public.carts;
CREATE POLICY "Anyone can create carts" ON public.carts
  AS PERMISSIVE FOR INSERT TO public
  WITH CHECK (tenant_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.tenants t WHERE t.id = tenant_id));

-- 3. carts (UPDATE) - keep update permissive but add tenant check
DROP POLICY IF EXISTS "Anyone can update own cart" ON public.carts;
CREATE POLICY "Anyone can update own cart" ON public.carts
  AS PERMISSIVE FOR UPDATE TO public
  USING (tenant_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.tenants t WHERE t.id = tenant_id))
  WITH CHECK (tenant_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.tenants t WHERE t.id = tenant_id));

-- 4. cart_items (ALL) - require parent cart exists
DROP POLICY IF EXISTS "Anyone can manage cart items" ON public.cart_items;
CREATE POLICY "Anyone can manage cart items" ON public.cart_items
  AS PERMISSIVE FOR ALL TO public
  USING (cart_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.carts c WHERE c.id = cart_id))
  WITH CHECK (cart_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.carts c WHERE c.id = cart_id));

-- 5. checkouts (INSERT)
DROP POLICY IF EXISTS "Anyone can create checkouts" ON public.checkouts;
CREATE POLICY "Anyone can create checkouts" ON public.checkouts
  AS PERMISSIVE FOR INSERT TO public
  WITH CHECK (
    tenant_id IS NOT NULL 
    AND EXISTS (SELECT 1 FROM public.tenants t WHERE t.id = tenant_id)
    AND (cart_id IS NULL OR EXISTS (SELECT 1 FROM public.carts c WHERE c.id = cart_id))
  );

-- 6. checkouts (UPDATE)
DROP POLICY IF EXISTS "Anyone can update own checkout" ON public.checkouts;
CREATE POLICY "Anyone can update own checkout" ON public.checkouts
  AS PERMISSIVE FOR UPDATE TO public
  USING (tenant_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.tenants t WHERE t.id = tenant_id))
  WITH CHECK (tenant_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.tenants t WHERE t.id = tenant_id));

-- 7. product_reviews
DROP POLICY IF EXISTS "Anyone can submit product reviews" ON public.product_reviews;
CREATE POLICY "Anyone can submit product reviews" ON public.product_reviews
  AS PERMISSIVE FOR INSERT TO public
  WITH CHECK (tenant_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.tenants t WHERE t.id = tenant_id));

-- 8. shipping_quotes
DROP POLICY IF EXISTS "Anyone can insert shipping quotes" ON public.shipping_quotes;
CREATE POLICY "Anyone can insert shipping quotes" ON public.shipping_quotes
  AS PERMISSIVE FOR INSERT TO public
  WITH CHECK (tenant_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.tenants t WHERE t.id = tenant_id));

-- 9. storefront_visits
DROP POLICY IF EXISTS "Allow anonymous inserts for tracking" ON public.storefront_visits;
CREATE POLICY "Allow anonymous inserts for tracking" ON public.storefront_visits
  AS PERMISSIVE FOR INSERT TO anon
  WITH CHECK (tenant_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.tenants t WHERE t.id = tenant_id));
