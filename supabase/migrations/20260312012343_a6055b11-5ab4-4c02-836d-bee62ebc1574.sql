CREATE OR REPLACE FUNCTION public.count_unique_visitors(p_tenant_id uuid, p_start timestamptz, p_end timestamptz)
RETURNS integer
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT COUNT(DISTINCT visitor_id)::integer
  FROM public.storefront_visits
  WHERE tenant_id = p_tenant_id
    AND created_at >= p_start
    AND created_at <= p_end;
$$;