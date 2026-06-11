CREATE UNIQUE INDEX IF NOT EXISTS uniq_wms_pratika_combined_inflight
ON public.wms_pratika_logs (tenant_id, reference_id)
WHERE operation = 'combined' AND status IN ('pending', 'success');