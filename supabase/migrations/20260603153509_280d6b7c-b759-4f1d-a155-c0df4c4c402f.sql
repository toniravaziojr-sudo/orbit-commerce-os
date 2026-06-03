DELETE FROM shipments WHERE id='333b846a-a7e2-4323-b869-51eb465733f5';
DELETE FROM shipping_remessas WHERE id='426a0d02-1b47-439b-9507-7a28d9c2fd07';
DELETE FROM shipping_content_declarations WHERE fiscal_invoice_id='41076bf4-8647-47b4-a14c-5ae79f8fe470';
UPDATE shipping_draft_queue SET status='cancelled', cancel_reason='manual_test_cleanup' WHERE source_pedido_venda_id='41076bf4-8647-47b4-a14c-5ae79f8fe470' AND status IN ('pending','processing');