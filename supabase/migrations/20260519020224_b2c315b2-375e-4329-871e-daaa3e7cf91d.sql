-- Estende a recomputação automática de pendências do Pedido de Venda
-- para também manter o campo `pendencia_avisos` (avisos não-bloqueantes)
-- sincronizado com os dados atuais do destinatário.
--
-- Aviso atualmente gerenciado: incompatibilidade entre UF informada no
-- destinatário e UF oficial do município (via código IBGE armazenado em
-- `dest_endereco_municipio_codigo`, cruzado com `public.ibge_municipios`).
--
-- Quando o usuário corrige a UF e salva, este recálculo limpa o aviso
-- automaticamente — sem precisar refresh manual nem reabertura do editor.

CREATE OR REPLACE FUNCTION public.compute_pedido_venda_avisos(p_invoice_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_inv record;
  v_avisos text[] := ARRAY[]::text[];
  v_ibge text;
  v_uf_oficial text;
  v_uf_pedido text;
BEGIN
  SELECT
    id, fiscal_stage,
    dest_endereco_uf, dest_endereco_municipio_codigo
  INTO v_inv
  FROM fiscal_invoices
  WHERE id = p_invoice_id;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  IF v_inv.fiscal_stage <> 'pedido_venda' THEN
    RETURN NULL;
  END IF;

  v_ibge := regexp_replace(coalesce(v_inv.dest_endereco_municipio_codigo, ''), '\D', '', 'g');
  v_uf_pedido := upper(trim(coalesce(v_inv.dest_endereco_uf, '')));

  -- Só checamos divergência quando temos os dois lados: código IBGE válido
  -- (7 dígitos) e UF informada no pedido. Sem IBGE válido, a pendência já
  -- aparece em `pendencia_motivos` (erro bloqueante), então não precisamos
  -- duplicar como aviso aqui.
  IF length(v_ibge) = 7 AND v_uf_pedido <> '' THEN
    SELECT upper(uf) INTO v_uf_oficial
    FROM public.ibge_municipios
    WHERE codigo = v_ibge
    LIMIT 1;

    IF v_uf_oficial IS NOT NULL AND v_uf_oficial <> v_uf_pedido THEN
      v_avisos := array_append(
        v_avisos,
        'Endereço incompatível com o CEP: o CEP pertence a ' || v_uf_oficial
          || ', mas o pedido informa ' || v_uf_pedido
          || '. Confirme cidade e estado com o cliente antes de despachar.'
      );
    END IF;
  END IF;

  IF array_length(v_avisos, 1) IS NULL THEN
    RETURN NULL;
  END IF;

  RETURN to_jsonb(v_avisos);
END;
$$;

CREATE OR REPLACE FUNCTION public.trg_recompute_pedido_venda_pendencias()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_motivos jsonb;
  v_avisos jsonb;
BEGIN
  IF NEW.fiscal_stage = 'pedido_venda' THEN
    v_motivos := public.compute_pedido_venda_pendencias(NEW.id);
    IF NEW.pendencia_motivos IS DISTINCT FROM v_motivos THEN
      NEW.pendencia_motivos := v_motivos;
    END IF;

    v_avisos := public.compute_pedido_venda_avisos(NEW.id);
    IF NEW.pendencia_avisos IS DISTINCT FROM v_avisos THEN
      NEW.pendencia_avisos := v_avisos;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

-- Garante que o trigger também reaja a alterações no código IBGE do município
-- (caso o usuário troque o município e o código mude).
DROP TRIGGER IF EXISTS trg_pedido_venda_pendencias_recompute ON public.fiscal_invoices;
CREATE TRIGGER trg_pedido_venda_pendencias_recompute
BEFORE INSERT OR UPDATE OF
  dest_nome,
  dest_cpf_cnpj,
  dest_endereco_logradouro,
  dest_endereco_municipio,
  dest_endereco_municipio_codigo,
  dest_endereco_uf,
  dest_endereco_cep,
  valor_total,
  fiscal_stage
ON public.fiscal_invoices
FOR EACH ROW
EXECUTE FUNCTION public.trg_recompute_pedido_venda_pendencias();