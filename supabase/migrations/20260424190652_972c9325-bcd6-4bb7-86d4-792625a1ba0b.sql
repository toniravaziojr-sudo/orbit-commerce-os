-- Reconcilia fila: snapshots já foram gerados após o enqueue, marca como done
UPDATE ai_snapshot_regen_queue q
SET status = 'done', updated_at = NOW()
FROM ai_business_snapshot s
WHERE q.tenant_id = s.tenant_id
  AND q.status = 'processing'
  AND q.created_at > NOW() - INTERVAL '2 hours'
  AND s.generated_at > q.created_at;