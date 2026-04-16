-- Adicionar coluna service_name em shipments para armazenar o nome do serviço (PAC, Sedex, Loggi Express, etc)
ALTER TABLE public.shipments ADD COLUMN IF NOT EXISTS service_name text;

CREATE INDEX IF NOT EXISTS idx_shipments_carrier_service ON public.shipments(tenant_id, carrier, service_name);

COMMENT ON COLUMN public.shipments.service_name IS 'Nome do serviço de envio escolhido pelo cliente (ex: PAC, Sedex, Loggi Express). Complementa o campo carrier (Correios, Loggi, Frenet).';
COMMENT ON COLUMN public.shipments.service_code IS 'Código do serviço de envio (ex: 03298=PAC, 03220=Sedex). Complementa carrier + service_name.';