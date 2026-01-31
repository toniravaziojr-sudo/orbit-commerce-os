-- 1. Tornar o bucket NÃO público (impede download direto via URL pública)
UPDATE storage.buckets 
SET public = false 
WHERE id = 'system-voice-presets';

-- 2. Limpar políticas conflitantes
DROP POLICY IF EXISTS "Anyone can view voice preset audios" ON storage.objects;
DROP POLICY IF EXISTS "Voice presets are publicly accessible" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload voice preset audios" ON storage.objects;

-- 3. Criar nova policy: Apenas Edge Functions (service_role) podem acessar
-- Isso permite que o creative-process acesse via service_role
-- mas bloqueia download direto pelo usuário
CREATE POLICY "Only service role can access voice presets"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'system-voice-presets' 
  AND auth.role() = 'service_role'
);

-- 4. Manter policy de upload apenas para service_role (já existe, apenas garantir)
DROP POLICY IF EXISTS "Only service role can upload voice presets" ON storage.objects;
CREATE POLICY "Only service role can upload voice presets"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'system-voice-presets' 
  AND auth.role() = 'service_role'
);

-- 5. Manter policy de delete apenas para service_role
DROP POLICY IF EXISTS "Only service role can delete voice presets" ON storage.objects;
CREATE POLICY "Only service role can delete voice presets"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'system-voice-presets' 
  AND auth.role() = 'service_role'
);