-- Etapa 1: Alinhar vocabulário canônico nos enums de status

-- payment_status: novos valores canônicos
ALTER TYPE public.payment_status ADD VALUE IF NOT EXISTS 'awaiting_payment';
ALTER TYPE public.payment_status ADD VALUE IF NOT EXISTS 'paid';
ALTER TYPE public.payment_status ADD VALUE IF NOT EXISTS 'chargeback_lost';

-- shipping_status: novos valores canônicos
ALTER TYPE public.shipping_status ADD VALUE IF NOT EXISTS 'awaiting_shipment';
ALTER TYPE public.shipping_status ADD VALUE IF NOT EXISTS 'label_generated';
ALTER TYPE public.shipping_status ADD VALUE IF NOT EXISTS 'arriving';
ALTER TYPE public.shipping_status ADD VALUE IF NOT EXISTS 'awaiting_pickup';
ALTER TYPE public.shipping_status ADD VALUE IF NOT EXISTS 'problem';
ALTER TYPE public.shipping_status ADD VALUE IF NOT EXISTS 'returning';