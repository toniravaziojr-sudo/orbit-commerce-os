CREATE OR REPLACE FUNCTION public.compute_pedido_venda_pendencias(p_invoice_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_inv record;
  v_errors text[] := ARRAY[]::text[];
  v_doc text;
  v_cep text;
  v_ibge text;
  v_item_count int := 0;
  v_item record;
  v_ncm_clean text;
  v_cfop_clean text;
BEGIN
  SELECT
    id, fiscal_stage,
    dest_nome, dest_cpf_cnpj,
    dest_endereco_logradouro, dest_endereco_municipio, dest_endereco_uf, dest_endereco_cep,
    dest_endereco_municipio_codigo,
    valor_total
  INTO v_inv
  FROM fiscal_invoices
  WHERE id = p_invoice_id;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  IF v_inv.fiscal_stage <> 'pedido_venda' THEN
    RETURN NULL;
  END IF;

  v_doc := regexp_replace(coalesce(v_inv.dest_cpf_cnpj, ''), '\D', '', 'g');
  IF length(v_doc) <> 11 AND length(v_doc) <> 14 THEN
    v_errors := array_append(v_errors, 'CPF/CNPJ do cliente inválido ou ausente.');
  END IF;

  IF coalesce(trim(v_inv.dest_nome), '') = '' THEN
    v_errors := array_append(v_errors, 'Nome do cliente ausente.');
  END IF;

  IF coalesce(trim(v_inv.dest_endereco_logradouro), '') = ''
     OR coalesce(trim(v_inv.dest_endereco_municipio), '') = ''
     OR coalesce(trim(v_inv.dest_endereco_uf), '') = '' THEN
    v_errors := array_append(v_errors, 'Endereço do cliente incompleto (rua, cidade ou UF).');
  END IF;

  v_cep := regexp_replace(coalesce(v_inv.dest_endereco_cep, ''), '\D', '', 'g');
  IF length(v_cep) <> 8 THEN
    v_errors := array_append(v_errors, 'CEP do cliente inválido (precisa ter 8 dígitos).');
  END IF;

  -- Código IBGE do município do destinatário (obrigatório na NFe — campo cMun)
  v_ibge := regexp_replace(coalesce(v_inv.dest_endereco_municipio_codigo, ''), '\D', '', 'g');
  IF length(v_ibge) <> 7 THEN
    v_errors := array_append(
      v_errors,
      'Cidade do cliente não localizada na base oficial de municípios — confirme a grafia da cidade no endereço.'
    );
  END IF;

  SELECT count(*) INTO v_item_count FROM fiscal_invoice_items WHERE invoice_id = p_invoice_id;
  IF v_item_count = 0 THEN
    v_errors := array_append(v_errors, 'Pedido sem itens.');
  ELSE
    FOR v_item IN
      SELECT descricao, codigo_produto, ncm, cfop, quantidade, valor_unitario
      FROM fiscal_invoice_items
      WHERE invoice_id = p_invoice_id
    LOOP
      IF coalesce(trim(v_item.descricao), '') = '' THEN
        v_errors := array_append(v_errors, 'Item sem descrição.');
      END IF;

      v_ncm_clean := regexp_replace(coalesce(v_item.ncm, ''), '\D', '', 'g');
      IF length(v_ncm_clean) <> 8 THEN
        v_errors := array_append(
          v_errors,
          'Produto "' || coalesce(nullif(trim(v_item.descricao), ''), v_item.codigo_produto, 'sem nome') || '" sem NCM válido.'
        );
      END IF;

      v_cfop_clean := regexp_replace(coalesce(v_item.cfop, ''), '\D', '', 'g');
      IF length(v_cfop_clean) <> 4 THEN
        v_errors := array_append(
          v_errors,
          'Produto "' || coalesce(nullif(trim(v_item.descricao), ''), v_item.codigo_produto, 'sem nome') || '" sem CFOP.'
        );
      END IF;

      IF v_item.quantidade IS NULL OR v_item.quantidade <= 0 THEN
        v_errors := array_append(
          v_errors,
          'Produto "' || coalesce(nullif(trim(v_item.descricao), ''), v_item.codigo_produto, 'sem nome') || '" com quantidade inválida.'
        );
      END IF;

      IF v_item.valor_unitario IS NULL OR v_item.valor_unitario < 0 THEN
        v_errors := array_append(
          v_errors,
          'Produto "' || coalesce(nullif(trim(v_item.descricao), ''), v_item.codigo_produto, 'sem nome') || '" com valor inválido.'
        );
      END IF;
    END LOOP;
  END IF;

  IF v_inv.valor_total IS NULL OR v_inv.valor_total <= 0 THEN
    v_errors := array_append(v_errors, 'Valor total do pedido inválido.');
  END IF;

  IF array_length(v_errors, 1) IS NULL THEN
    RETURN NULL;
  END IF;

  RETURN to_jsonb(v_errors);
END;
$function$;

-- Recalcula pendências para todos os Pedidos de Venda existentes,
-- aplicando a nova validação de IBGE
UPDATE public.fiscal_invoices
SET pendencia_motivos = public.compute_pedido_venda_pendencias(id),
    updated_at = now()
WHERE fiscal_stage = 'pedido_venda'
  AND status = 'draft';