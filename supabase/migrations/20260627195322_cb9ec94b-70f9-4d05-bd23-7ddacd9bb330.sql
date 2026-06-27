
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS ml_search_summary text,
  ADD COLUMN IF NOT EXISTS ml_search_summary_signature text;

COMMENT ON COLUMN public.products.ml_search_summary IS 'Resumo funcional curto (TIPO + atributo + volume) usado como fallback de termo de busca na categorização do Mercado Livre. Gerado por IA sob demanda a partir do cadastro completo.';
COMMENT ON COLUMN public.products.ml_search_summary_signature IS 'Assinatura SHA-256 do conteúdo do cadastro usada para invalidar ml_search_summary quando algum campo de entrada muda.';
