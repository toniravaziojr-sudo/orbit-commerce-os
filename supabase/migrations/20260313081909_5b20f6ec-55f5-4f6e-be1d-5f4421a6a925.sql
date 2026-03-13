
-- ============================================
-- SECURITY PLAN v3.1 — Phase 3B: Remove anonymous SELECT policies
-- orders and order_items now read via edge functions (order-lookup, get-review-data, get-order)
-- ============================================

-- 1. orders: anonymous SELECT no longer needed
DROP POLICY IF EXISTS "Anyone can view order by number for confirmation" ON public.orders;

-- 2. order_items: anonymous SELECT no longer needed
DROP POLICY IF EXISTS "Anyone can view order items for checkout" ON public.order_items;
