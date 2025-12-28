-- Remove IMAP-related columns that are no longer needed
-- We're simplifying to use Resend Inbound instead of IMAP polling

ALTER TABLE public.email_provider_configs 
DROP COLUMN IF EXISTS support_imap_host,
DROP COLUMN IF EXISTS support_imap_port,
DROP COLUMN IF EXISTS support_imap_user,
DROP COLUMN IF EXISTS support_imap_password,
DROP COLUMN IF EXISTS support_imap_tls,
DROP COLUMN IF EXISTS support_last_poll_at;

-- Keep these columns:
-- support_email_enabled: toggles if support email is active
-- support_email_address: optional exclusive SAC email (if empty, uses from_email)
-- support_connection_status: status of the integration
-- support_last_error: last error message
-- support_reply_from_name: name to use when replying
-- support_reply_from_email: kept for compatibility but logic uses support_email_address or from_email