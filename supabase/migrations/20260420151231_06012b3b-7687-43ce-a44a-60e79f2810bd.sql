
-- Corrigir policy "service role full access" para não usar TRUE puro
DROP POLICY IF EXISTS "Service role full access incidents" ON public.whatsapp_health_incidents;
CREATE POLICY "Service role manages incidents"
  ON public.whatsapp_health_incidents FOR ALL
  TO service_role
  USING (true) WITH CHECK (true);
