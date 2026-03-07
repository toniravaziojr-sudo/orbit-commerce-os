ALTER TABLE public.storefront_prerendered_pages ALTER COLUMN publish_version TYPE bigint;

ALTER TABLE public.storefront_prerender_jobs ALTER COLUMN metadata TYPE jsonb USING metadata::jsonb;