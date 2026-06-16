-- 1) Add 'cancelled' to enum
ALTER TYPE public.creative_job_status ADD VALUE IF NOT EXISTS 'cancelled';
