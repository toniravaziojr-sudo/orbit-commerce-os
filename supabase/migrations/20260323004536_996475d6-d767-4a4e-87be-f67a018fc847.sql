ALTER TABLE public.events_inbox DROP CONSTRAINT IF EXISTS events_inbox_status_check;
ALTER TABLE public.events_inbox ADD CONSTRAINT events_inbox_status_check 
  CHECK (status = ANY (ARRAY['new'::text, 'pending'::text, 'processing'::text, 'processed'::text, 'ignored'::text, 'error'::text]));