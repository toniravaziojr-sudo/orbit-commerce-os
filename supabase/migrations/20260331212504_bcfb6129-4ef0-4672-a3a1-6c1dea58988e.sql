-- Add Threads scopes to both auth profiles
UPDATE meta_auth_profiles 
SET effective_scopes = effective_scopes || ARRAY['threads_basic', 'threads_content_publish', 'threads_manage_insights', 'threads_manage_replies']
WHERE profile_key = 'meta_auth_full' AND is_active = true;

UPDATE meta_auth_profiles 
SET effective_scopes = effective_scopes || ARRAY['threads_basic', 'threads_content_publish', 'threads_manage_insights', 'threads_manage_replies']
WHERE profile_key = 'meta_auth_external' AND is_active = true;