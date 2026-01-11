-- Criar RPC update_import_job_module para o módulo de importação de categorias
-- Esta função atualiza atomicamente o progresso de um módulo específico no job
CREATE OR REPLACE FUNCTION public.update_import_job_module(
  p_job_id uuid,
  p_module text,
  p_current integer,
  p_total integer,
  p_imported integer,
  p_updated integer,
  p_skipped integer,
  p_failed integer
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE import_jobs
  SET 
    progress = COALESCE(progress, '{}'::jsonb) || jsonb_build_object(
      p_module, jsonb_build_object('current', p_current, 'total', p_total)
    ),
    stats = COALESCE(stats, '{}'::jsonb) || jsonb_build_object(
      p_module, jsonb_build_object(
        'imported', p_imported,
        'updated', p_updated,
        'skipped', p_skipped,
        'failed', p_failed
      )
    ),
    updated_at = now()
  WHERE id = p_job_id;
END;
$$;