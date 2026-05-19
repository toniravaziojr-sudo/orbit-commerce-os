UPDATE public.fiscal_invoices
SET dest_endereco_uf = dest_endereco_uf
WHERE fiscal_stage = 'pedido_venda'
  AND pendencia_avisos IS NOT NULL;