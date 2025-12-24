-- Add unique constraint on notification_id for upsert support
CREATE UNIQUE INDEX IF NOT EXISTS idx_notification_logs_notification_id 
ON notification_logs (notification_id) 
WHERE notification_id IS NOT NULL;