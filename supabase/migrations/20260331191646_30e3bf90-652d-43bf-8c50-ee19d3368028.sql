-- Remove config_id do perfil meta_auth_external para usar escopos diretos
-- Isso evita erro "recurso indisponível" na Meta para tenants normais
UPDATE meta_auth_profiles
SET config_id = NULL,
    effective_scopes = ARRAY[
      'public_profile',
      'pages_show_list',
      'pages_read_engagement',
      'pages_manage_metadata',
      'pages_manage_posts',
      'instagram_basic',
      'instagram_content_publish',
      'instagram_manage_comments',
      'whatsapp_business_management',
      'whatsapp_business_messaging',
      'read_insights'
    ]
WHERE profile_key = 'meta_auth_external';