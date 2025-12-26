-- Permitir from_email e from_name serem nullable durante a etapa de verificação de domínio
-- (o usuário só vai preencher esses campos APÓS verificar o domínio)

ALTER TABLE public.email_provider_configs 
  ALTER COLUMN from_email SET DEFAULT '',
  ALTER COLUMN from_email DROP NOT NULL;

-- Garantir que from_name tenha default (já tem, mas para segurança)
ALTER TABLE public.email_provider_configs 
  ALTER COLUMN from_name SET DEFAULT '';