-- Phase 3 — Reclassify legacy messages with raw template placeholders or
-- "[Template: ...]" technical prefix as internal system events. Preserves
-- history but stops them from polluting the conversation timeline as bubbles.
UPDATE public.messages
SET
  is_internal = TRUE,
  metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object(
    'reclassified_at', now(),
    'reclassified_reason', 'phase3_legacy_template_leak',
    'original_sender_type', sender_type
  )
WHERE
  is_internal = FALSE
  AND (
    content LIKE '%{{%}}%'
    OR content LIKE '[Template:%'
  );