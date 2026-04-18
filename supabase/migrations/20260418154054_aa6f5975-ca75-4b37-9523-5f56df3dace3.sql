-- Anti-regression: invalidate ALL active prerender snapshots that predate
-- the current renderer (v8.8.0). They were generated before the universal
-- newsletter handler was injected, so popup/footer/custom forms were no-ops
-- in the served HTML.
UPDATE public.storefront_prerendered_pages
   SET status = 'stale',
       updated_at = now()
 WHERE status = 'active';