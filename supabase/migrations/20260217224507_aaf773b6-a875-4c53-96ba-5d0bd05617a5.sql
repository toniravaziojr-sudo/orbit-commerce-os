-- Allow M2M (machine-to-machine) calls to create creative_jobs without a real user
ALTER TABLE public.creative_jobs ALTER COLUMN created_by DROP NOT NULL;