-- Criar bucket público para vozes do sistema
INSERT INTO storage.buckets (id, name, public)
VALUES ('system-voice-presets', 'system-voice-presets', true)
ON CONFLICT (id) DO NOTHING;

-- Política de leitura pública
CREATE POLICY "Voice presets are publicly accessible"
ON storage.objects FOR SELECT
USING (bucket_id = 'system-voice-presets');

-- Apenas admins podem fazer upload (via service role)
CREATE POLICY "Only service role can upload voice presets"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'system-voice-presets' AND auth.role() = 'service_role');

-- Apenas admins podem deletar
CREATE POLICY "Only service role can delete voice presets"
ON storage.objects FOR DELETE
USING (bucket_id = 'system-voice-presets' AND auth.role() = 'service_role');