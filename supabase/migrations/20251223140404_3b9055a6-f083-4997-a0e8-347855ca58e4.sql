-- Add UNIQUE constraint to shipment_events for ON CONFLICT to work
-- Note: provider_event_id can be NULL, so we need a partial unique index

-- First, handle potential duplicates by keeping only the first occurrence
DELETE FROM shipment_events a
USING shipment_events b
WHERE a.id > b.id 
  AND a.shipment_id = b.shipment_id 
  AND a.provider_event_id = b.provider_event_id
  AND a.provider_event_id IS NOT NULL;

-- Create unique index for non-null provider_event_id
CREATE UNIQUE INDEX IF NOT EXISTS shipment_events_shipment_provider_unique 
ON shipment_events (shipment_id, provider_event_id) 
WHERE provider_event_id IS NOT NULL;

-- Also sync the order #5005 shipping_status based on existing shipment
-- Map delivery_status 'unknown' to shipping_status 'pending' (will be updated on next poll)
UPDATE orders 
SET shipping_status = 'pending',
    shipping_carrier = 'correios'
WHERE id = '05a89511-c64a-4cd7-ba91-40343bcbedf5' 
  AND (shipping_carrier IS NULL OR shipping_status = 'pending');