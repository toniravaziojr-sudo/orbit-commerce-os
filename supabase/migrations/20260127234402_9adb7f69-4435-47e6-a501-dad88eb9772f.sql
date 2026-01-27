-- Adicionar coluna updated_at que está faltando na tabela creative_jobs
ALTER TABLE public.creative_jobs 
ADD COLUMN IF NOT EXISTS updated_at timestamp with time zone DEFAULT now();