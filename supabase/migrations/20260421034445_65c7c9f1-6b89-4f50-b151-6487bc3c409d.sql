INSERT INTO public.channel_accounts (tenant_id, channel_type, account_name, is_active)
SELECT t.id, x.channel_type::support_channel_type, x.name, false
FROM public.tenants t
CROSS JOIN (VALUES
  ('whatsapp'::text, 'WhatsApp Principal'::text),
  ('chat',           'Chat do Site'),
  ('instagram',      'Instagram DM'),
  ('email',          'E-mail Suporte')
) AS x(channel_type, name)
WHERE t.slug = 'respeiteohomem'
ON CONFLICT DO NOTHING;