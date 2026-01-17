-- Adicionar policy para leitura pública de offer_rules ativas
-- Necessário para Cross-sell/OrderBump/Upsell funcionarem no storefront público
CREATE POLICY "Public can view active offer rules"
ON public.offer_rules
FOR SELECT
USING (is_active = true);