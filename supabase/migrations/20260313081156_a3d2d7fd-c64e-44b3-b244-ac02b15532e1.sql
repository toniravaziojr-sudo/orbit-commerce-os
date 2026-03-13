
-- ============================================
-- SECURITY PLAN v3.1 — Phase 3A: Remove unnecessary public INSERT/UPDATE policies
-- These operations are now handled by edge functions using service_role
-- ============================================

-- 1. orders: INSERT not needed (checkout-create-order uses service_role)
DROP POLICY IF EXISTS "Anyone can create orders for checkout" ON public.orders;

-- 2. order_items: INSERT not needed (checkout-create-order uses service_role)
DROP POLICY IF EXISTS "Anyone can create order items for checkout" ON public.order_items;

-- 3. customers: INSERT not needed (checkout-create-order uses service_role)
DROP POLICY IF EXISTS "Anyone can create customers for checkout" ON public.customers;

-- 4. customers: UPDATE not needed (checkout-create-order uses service_role)
DROP POLICY IF EXISTS "Anyone can update customers for checkout" ON public.customers;

-- 5. payment_transactions: INSERT not needed (pagarme/mercadopago-create-charge use service_role)
DROP POLICY IF EXISTS "Anyone can create payment transactions for checkout" ON public.payment_transactions;

-- 6. order_attribution: INSERT not needed (checkout-create-order uses service_role)
DROP POLICY IF EXISTS "Anon can insert attribution" ON public.order_attribution;
