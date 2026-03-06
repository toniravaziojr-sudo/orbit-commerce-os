-- Add free_shipping_method to products (override per product)
ALTER TABLE products ADD COLUMN IF NOT EXISTS free_shipping_method text DEFAULT NULL;

-- Add default_free_shipping_method to store_settings  
ALTER TABLE store_settings ADD COLUMN IF NOT EXISTS default_free_shipping_method text DEFAULT NULL;

COMMENT ON COLUMN products.free_shipping_method IS 'Método de envio para frete grátis (ex: PAC, SEDEX). NULL = usa padrão da logística';
COMMENT ON COLUMN store_settings.default_free_shipping_method IS 'Método de envio padrão para frete grátis global (ex: PAC)';