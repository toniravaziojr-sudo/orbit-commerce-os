-- Remove B2B and Suppliers related tables

-- First drop tables with foreign key dependencies
DROP TABLE IF EXISTS public.b2b_audience_members CASCADE;
DROP TABLE IF EXISTS public.b2b_export_logs CASCADE;
DROP TABLE IF EXISTS public.b2b_search_jobs CASCADE;

-- Then drop parent tables
DROP TABLE IF EXISTS public.b2b_audiences CASCADE;
DROP TABLE IF EXISTS public.b2b_entities CASCADE;
DROP TABLE IF EXISTS public.b2b_sources CASCADE;

-- Drop suppliers tables
DROP TABLE IF EXISTS public.suppliers CASCADE;
DROP TABLE IF EXISTS public.supplier_types CASCADE;

-- Drop the reset function if exists
DROP FUNCTION IF EXISTS public.reset_b2b_source_quota() CASCADE;