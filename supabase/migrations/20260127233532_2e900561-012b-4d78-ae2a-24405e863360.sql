-- Atualizar constraint de store_page_versions para incluir todos os tipos de página
ALTER TABLE public.store_page_versions 
DROP CONSTRAINT IF EXISTS store_page_versions_page_type_check;

ALTER TABLE public.store_page_versions 
ADD CONSTRAINT store_page_versions_page_type_check 
CHECK (page_type IS NULL OR page_type = ANY (ARRAY[
  'home', 'category', 'product', 'cart', 'checkout', 
  'thank_you', 'account', 'account_orders', 'account_order_detail', 
  'institutional', 'blog', 'tracking'
]));