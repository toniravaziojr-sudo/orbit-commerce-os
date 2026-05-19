-- 1) Add new enum value to order_status
ALTER TYPE public.order_status ADD VALUE IF NOT EXISTS 'cancelled_by_user';