CREATE OR REPLACE FUNCTION public.trg_recompute_pedido_venda_pendencias()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_motivos jsonb;
  v_avisos  jsonb;
  v_avisos_arr text[] := ARRAY[]::text[];
  v_ibge text;
  v_uf_oficial text;
  v_uf_pedido text;
BEGIN
  IF NEW.fiscal_stage = 'pedido_venda' THEN
    -- Pendências bloqueantes: recomputa a partir do id (dados já refletem NEW
    -- para itens; campos do destinatário do pedido em si vamos passar adiante
    -- via tabela porque BEFORE trigger ainda não persistiu — então em vez de
    -- ler do banco, inlineamos o cálculo essencial usando NEW.*).
    v_motivos := public.compute_pedido_venda_pendencias_v2(
      NEW.id,
      NEW.dest_nome,
      NEW.dest_cpf_cnpj,
      NEW.dest_endereco_logradouro,
      NEW.dest_endereco_municipio,
      NEW.dest_endereco_uf,
      NEW.dest_endereco_cep,
      NEW.dest_endereco_municipio_codigo,
      NEW.valor_total
    );
    IF NEW.pendencia_motivos IS DISTINCT FROM v_motivos THEN
      NEW.pendencia_motivos := v_motivos;
    END IF;

    -- Avisos: calcula inline com NEW.* (não pode ler da tabela em BEFORE UPDATE)
    v_ibge := regexp_replace(coalesce(NEW.dest_endereco_municipio_codigo, ''), '\D', '', 'g');
    v_uf_pedido := upper(trim(coalesce(NEW.dest_endereco_uf, '')));

    IF length(v_ibge) = 7 AND v_uf_pedido <> '' THEN
      SELECT upper(uf) INTO v_uf_oficial
      FROM public.ibge_municipios
      WHERE codigo = v_ibge
      LIMIT 1;

      IF v_uf_oficial IS NOT NULL AND v_uf_oficial <> v_uf_pedido THEN
        v_avisos_arr := array_append(
          v_avisos_arr,
          'Endereço incompatível com o CEP: o CEP pertence a ' || v_uf_oficial
            || ', mas o pedido informa ' || v_uf_pedido
            || '. Confirme cidade e estado com o cliente antes de despachar.'
        );
      END IF;
    END IF;

    IF array_length(v_avisos_arr, 1) IS NULL THEN
      v_avisos := NULL;
    ELSE
      v_avisos := to_jsonb(v_avisos_arr);
    END IF;

    IF NEW.pendencia_avisos IS DISTINCT FROM v_avisos THEN
      NEW.pendencia_avisos := v_avisos;
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;

-- Versão da função de pendências que aceita valores NEW como parâmetros
-- (porque BEFORE UPDATE ainda não persistiu na tabela).
CREATE OR REPLACE FUNCTION public.compute_pedido_venda_pendencias_v2(
  p_invoice_id uuid,
  p_dest_nome text,
  p_dest_cpf_cnpj text,
  p_logradouro text,
  p_municipio text,
  p_uf text,
  p_cep text,
  p_municipio_codigo text,
  p_valor_total numeric
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_errors text[] := ARRAY[]::text[];
  v_doc text;
  v_cep text;
  v_ibge text;
  v_item_count int := 0;
  v_item record;
  v_ncm_clean text;
  v_cfop_clean text;
BEGIN
  v_doc := regexp_replace(coalesce(p_dest_cpf_cnpj, ''), '\D', '', 'g');
  IF length(v_doc) <> 11 AND length(v_doc) <> 14 THEN
    v_errors := array_append(v_errors, 'CPF/CNPJ do cliente inválido ou ausente.');
  END IF;

  IF coalesce(trim(p_dest_nome), '') = '' THEN
    v_errors := array_append(v_errors, 'Nome do cliente ausente.');
  END IF;

  IF coalesce(trim(p_logradouro), '') = ''
     OR coalesce(trim(p_municipio), '') = ''
     OR coalesce(trim(p_uf), '') = '' THEN
    v_errors := array_append(v_errors, 'Endereço do cliente incompleto (rua, cidade ou UF).');
  END IF;

  v_cep := regexp_replace(coalesce(p_cep, ''), '\D', '', 'g');
  IF length(v_cep) <> 8 THEN
    v_errors := array_append(v_errors, 'CEP do cliente inválido (precisa ter 8 dígitos).');
  END IF;

  v_ibge := regexp_replace(coalesce(p_municipio_codigo, ''), '\D', '', 'g');
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
        v_errors := array_append(v_errors, 'Item com NCM inválido (precisa ter 8 dígitos).');
      END IF;
      v_cfop_clean := regexp_replace(coalesce(v_item.cfop, ''), '\D', '', 'g');
      IF length(v_cfop_clean) <> 4 THEN
        v_errors := array_append(v_errors, 'Item com CFOP inválido (precisa ter 4 dígitos).');
      END IF;
      IF coalesce(v_item.quantidade, 0) <= 0 THEN
        v_errors := array_append(v_errors, 'Item com quantidade inválida.');
      END IF;
      IF coalesce(v_item.valor_unitario, 0) <= 0 THEN
        v_errors := array_append(v_errors, 'Item com valor unitário inválido.');
      END IF;
    END LOOP;
  END IF;

  IF coalesce(p_valor_total, 0) <= 0 THEN
    v_errors := array_append(v_errors, 'Valor total do pedido inválido.');
  END IF;

  IF array_length(v_errors, 1) IS NULL THEN
    RETURN NULL;
  END IF;
  RETURN to_jsonb(v_errors);
END;
$function$;

-- Força recálculo dos pedidos abertos com aviso pendente
UPDATE public.fiscal_invoices
SET updated_at = updated_at
WHERE fiscal_stage = 'pedido_venda'
  AND pendencia_avisos IS NOT NULL;