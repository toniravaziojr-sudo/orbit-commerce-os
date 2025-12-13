-- Permitir acesso público aos tenants (apenas leitura de slug/nome) para o storefront
CREATE POLICY "Anyone can view tenant by slug"
ON public.tenants
FOR SELECT
USING (true);

-- Permitir acesso público aos produtos ativos para o storefront
CREATE POLICY "Anyone can view active products for storefront"
ON public.products
FOR SELECT
USING (status = 'active');

-- Permitir acesso público às imagens de produtos ativos
CREATE POLICY "Anyone can view product images for active products"
ON public.product_images
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM products p 
    WHERE p.id = product_images.product_id 
    AND p.status = 'active'
  )
);

-- Permitir acesso público às categorias ativas
CREATE POLICY "Anyone can view active categories for storefront"
ON public.categories
FOR SELECT
USING (is_active = true);

-- Permitir acesso público às relações produto-categoria
CREATE POLICY "Anyone can view product categories for storefront"
ON public.product_categories
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM products p 
    WHERE p.id = product_categories.product_id 
    AND p.status = 'active'
  )
);