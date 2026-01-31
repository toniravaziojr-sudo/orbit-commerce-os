-- Atualizar bucket para aceitar tipos MIME de áudio
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
  'application/ogg'
]
WHERE id = 'system-voice-presets';