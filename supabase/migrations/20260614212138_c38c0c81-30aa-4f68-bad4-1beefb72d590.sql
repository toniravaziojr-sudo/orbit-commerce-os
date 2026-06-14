
-- Onda H.4.2 — Auto-flip do lifecycle da Proposta de Campanha quando todos os criativos terminam
-- Quando um creative_job vinculado a uma proposta (settings.proposal_action_id) muda para status terminal,
-- verifica se TODOS os jobs daquela proposta já terminaram. Se sim:
--   - todos com sucesso ou parcial → lifecycle.status = 'campaign_creatives_ready'
--   - todos falharam → lifecycle.status = 'campaign_creatives_failed'
-- Não toca em proposta cujo lifecycle.status não seja 'campaign_creatives_generating'.

CREATE OR REPLACE FUNCTION public.flip_campaign_proposal_lifecycle_on_creative_done()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_action_id uuid;
  v_total int;
  v_terminal int;
  v_succeeded int;
  v_failed int;
  v_new_status text;
  v_action_data jsonb;
  v_lifecycle jsonb;
  v_current_status text;
BEGIN
  -- Só age em transições de status para terminal
  IF NEW.status NOT IN ('succeeded', 'failed', 'cancelled') THEN
    RETURN NEW;
  END IF;
  IF OLD.status = NEW.status THEN
    RETURN NEW;
  END IF;

  v_action_id := NULLIF(NEW.settings->>'proposal_action_id', '')::uuid;
  IF v_action_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Carrega proposta
  SELECT action_data INTO v_action_data
  FROM public.ads_autopilot_actions
  WHERE id = v_action_id;

  IF v_action_data IS NULL THEN
    RETURN NEW;
  END IF;

  v_lifecycle := COALESCE(v_action_data->'lifecycle', '{}'::jsonb);
  v_current_status := v_lifecycle->>'status';

  -- Só age se está aguardando geração de criativos
  IF v_current_status IS DISTINCT FROM 'campaign_creatives_generating' THEN
    RETURN NEW;
  END IF;

  -- Conta jobs da proposta
  SELECT
    COUNT(*),
    COUNT(*) FILTER (WHERE status IN ('succeeded', 'failed', 'cancelled')),
    COUNT(*) FILTER (WHERE status = 'succeeded'),
    COUNT(*) FILTER (WHERE status IN ('failed', 'cancelled'))
  INTO v_total, v_terminal, v_succeeded, v_failed
  FROM public.creative_jobs
  WHERE (settings->>'proposal_action_id')::uuid = v_action_id;

  -- Ainda há jobs em andamento
  IF v_terminal < v_total THEN
    RETURN NEW;
  END IF;

  -- Decide novo status
  IF v_succeeded > 0 THEN
    v_new_status := 'campaign_creatives_ready';
  ELSE
    v_new_status := 'campaign_creatives_failed';
  END IF;

  -- Atualiza proposta
  UPDATE public.ads_autopilot_actions
  SET action_data = jsonb_set(
    jsonb_set(
      action_data,
      '{lifecycle,status}',
      to_jsonb(v_new_status),
      true
    ),
    '{lifecycle,creatives_summary}',
    jsonb_build_object(
      'total', v_total,
      'succeeded', v_succeeded,
      'failed', v_failed,
      'finalized_at', now()
    ),
    true
  ),
  updated_at = now()
  WHERE id = v_action_id;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_flip_campaign_proposal_lifecycle ON public.creative_jobs;
CREATE TRIGGER trg_flip_campaign_proposal_lifecycle
AFTER UPDATE OF status ON public.creative_jobs
FOR EACH ROW
EXECUTE FUNCTION public.flip_campaign_proposal_lifecycle_on_creative_done();
