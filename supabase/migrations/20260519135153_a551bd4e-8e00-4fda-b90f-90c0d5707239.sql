UPDATE public.fiscal_invoices
SET status = 'rejected',
    status_motivo = 'Emissão de teste em homologação descartada na virada para produção. Reemita esta nota em ambiente de produção.',
    ambiente = 'producao',
    updated_at = now()
WHERE id = 'cf2a46a2-6bd1-40eb-898a-07ecde3176d2'
  AND status = 'processing';