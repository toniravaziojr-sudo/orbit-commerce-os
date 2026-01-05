-- Inserir credenciais faltantes para Z-API e Firecrawl
INSERT INTO platform_credentials (credential_key, credential_value, description, is_active)
VALUES 
  ('ZAPI_INSTANCE_ID', NULL, 'Instance ID da conta gerenciadora Z-API para WhatsApp', true),
  ('ZAPI_TOKEN', NULL, 'Token de autenticação da instância gerenciadora Z-API', true),
  ('FIRECRAWL_API_KEY', NULL, 'API Key do Firecrawl para web scraping e importação', true)
ON CONFLICT (credential_key) DO NOTHING;