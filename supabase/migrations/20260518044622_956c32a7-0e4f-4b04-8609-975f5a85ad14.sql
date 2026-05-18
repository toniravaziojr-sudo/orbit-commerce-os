WITH reclass AS (
  SELECT
    id,
    (SELECT jsonb_agg(m) FROM jsonb_array_elements_text(pendencia_motivos) m
       WHERE m NOT ILIKE '%incompatível com o CEP%') AS new_motivos,
    (SELECT jsonb_agg(m) FROM jsonb_array_elements_text(pendencia_motivos) m
       WHERE m ILIKE '%incompatível com o CEP%') AS uf_warnings
  FROM fiscal_invoices
  WHERE fiscal_stage IN ('pedido_venda','pendencia')
    AND pendencia_motivos IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM jsonb_array_elements_text(pendencia_motivos) m
      WHERE m ILIKE '%incompatível com o CEP%'
    )
)
UPDATE fiscal_invoices f
SET
  pendencia_motivos = CASE WHEN r.new_motivos IS NULL OR jsonb_array_length(r.new_motivos) = 0
                            THEN NULL ELSE r.new_motivos END,
  pendencia_avisos = COALESCE(f.pendencia_avisos, '[]'::jsonb) || COALESCE(r.uf_warnings, '[]'::jsonb),
  fiscal_stage = CASE
    WHEN (r.new_motivos IS NULL OR jsonb_array_length(r.new_motivos) = 0) THEN 'pedido_venda'
    ELSE f.fiscal_stage
  END,
  updated_at = now()
FROM reclass r
WHERE f.id = r.id;