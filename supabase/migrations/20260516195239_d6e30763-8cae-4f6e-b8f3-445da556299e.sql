
-- =============================================
-- PEDIDO DE VENDA — Cálculo automático de pendências
-- =============================================
-- Trigger SQL puro que mantém fiscal_invoices.pendencia_motivos
-- sempre atualizado para registros em fiscal_stage='pedido_venda'.
-- Roda em INSERT/UPDATE da NF e em qualquer mudança nos itens.
-- Padrão: Pure SQL trigger for metadata (Core rule).
-- =============================================

CREATE OR REPLACE FUNCTION public.compute_pedido_venda_pendencias(p_invoice_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_inv record;
  v_errors text[] := ARRAY[]::text[];
  v_doc text;
  v_cep text;
  v_item_count int := 0;
  v_item record;
  v_ncm_clean text;
  v_cfop_clean text;
BEGIN
  SELECT
    id, fiscal_stage,
    dest_nome, dest_cpf_cnpj,
    dest_endereco_logradouro, dest_endereco_municipio, dest_endereco_uf, dest_endereco_cep,
    valor_total
  INTO v_inv
  FROM fiscal_invoices
  WHERE id = p_invoice_id;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  -- Só validamos pendências do Pedido de Venda neste motor.
  -- Outros stages (pronta_emitir / pendencia / emitida) seguem o motor existente em fiscal-prepare-invoice.
  IF v_inv.fiscal_stage <> 'pedido_venda' THEN
    RETURN NULL;
  END IF;

  -- Destinatário
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

  -- Itens
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

  -- Valor total
  IF v_inv.valor_total IS NULL OR v_inv.valor_total <= 0 THEN
    v_errors := array_append(v_errors, 'Valor total do pedido inválido.');
  END IF;

  IF array_length(v_errors, 1) IS NULL THEN
    RETURN NULL;
  END IF;

  RETURN to_jsonb(v_errors);
END;
$$;

-- Trigger function: recalcula pendencia_motivos do próprio registro
CREATE OR REPLACE FUNCTION public.trg_recompute_pedido_venda_pendencias()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_motivos jsonb;
BEGIN
  IF NEW.fiscal_stage = 'pedido_venda' THEN
    v_motivos := public.compute_pedido_venda_pendencias(NEW.id);
    -- Evita loop: só atualiza se diferente
    IF NEW.pendencia_motivos IS DISTINCT FROM v_motivos THEN
      NEW.pendencia_motivos := v_motivos;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_pedido_venda_pendencias_recompute ON public.fiscal_invoices;
CREATE TRIGGER trg_pedido_venda_pendencias_recompute
BEFORE INSERT OR UPDATE OF
  dest_nome, dest_cpf_cnpj,
  dest_endereco_logradouro, dest_endereco_municipio, dest_endereco_uf, dest_endereco_cep,
  valor_total, fiscal_stage
ON public.fiscal_invoices
FOR EACH ROW
EXECUTE FUNCTION public.trg_recompute_pedido_venda_pendencias();

-- Trigger function nos itens: recomputa o pai (UPDATE separado para não causar recursão na NF)
CREATE OR REPLACE FUNCTION public.trg_recompute_pedido_venda_pendencias_from_items()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invoice_id uuid;
  v_motivos jsonb;
  v_stage text;
BEGIN
  v_invoice_id := COALESCE(NEW.invoice_id, OLD.invoice_id);
  IF v_invoice_id IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  SELECT fiscal_stage INTO v_stage FROM fiscal_invoices WHERE id = v_invoice_id;
  IF v_stage <> 'pedido_venda' THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  v_motivos := public.compute_pedido_venda_pendencias(v_invoice_id);

  UPDATE fiscal_invoices
  SET pendencia_motivos = v_motivos
  WHERE id = v_invoice_id
    AND pendencia_motivos IS DISTINCT FROM v_motivos;

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_pedido_venda_pendencias_from_items ON public.fiscal_invoice_items;
CREATE TRIGGER trg_pedido_venda_pendencias_from_items
AFTER INSERT OR UPDATE OR DELETE ON public.fiscal_invoice_items
FOR EACH ROW
EXECUTE FUNCTION public.trg_recompute_pedido_venda_pendencias_from_items();

-- Backfill único de todos os pedidos de venda existentes
UPDATE public.fiscal_invoices
SET pendencia_motivos = public.compute_pedido_venda_pendencias(id)
WHERE fiscal_stage = 'pedido_venda';

-- Índice auxiliar para consulta rápida de "Concluído" (pedido com NF autorizada derivada)
CREATE INDEX IF NOT EXISTS idx_fiscal_invoices_source_authorized
  ON public.fiscal_invoices (source_order_invoice_id)
  WHERE source_order_invoice_id IS NOT NULL AND status = 'authorized';
