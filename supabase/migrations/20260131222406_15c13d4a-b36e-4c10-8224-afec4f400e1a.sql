-- Adicionar application/octet-stream para aceitar uploads
UPDATE storage.buckets 
SET allowed_mime_types = ARRAY[
  'audio/ogg',
  'audio/mpeg',
  'audio/mp3',
  'audio/wav',
  'audio/webm',
  'audio/flac',
  'audio/aac',
  'audio/m4a',
  'audio/x-m4a',
  'application/ogg',
  'application/octet-stream'
]
WHERE id = 'system-voice-presets';