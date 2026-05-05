-- 1. Birth date in checkout sessions and orders
ALTER TABLE public.checkout_sessions ADD COLUMN IF NOT EXISTS customer_birth_date date;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS customer_birth_date date;

-- 2. Allow customer_birthday in email automation flows
ALTER TABLE public.email_automation_flows
  DROP CONSTRAINT IF EXISTS email_automation_flows_trigger_type_check;
ALTER TABLE public.email_automation_flows
  ADD CONSTRAINT email_automation_flows_trigger_type_check
  CHECK (trigger_type = ANY (ARRAY[
    'list_subscription','tag_added','tag_removed',
    'order_placed','order_paid','cart_abandoned',
    'customer_birthday','manual'
  ]));

-- 3. Index on customers (month+day) for fast birthday cron lookup
CREATE INDEX IF NOT EXISTS idx_customers_birthday_mmdd
  ON public.customers (tenant_id, (EXTRACT(MONTH FROM birth_date)::int), (EXTRACT(DAY FROM birth_date)::int))
  WHERE birth_date IS NOT NULL;

-- 4. Document new notification trigger event (no CHECK constraint exists on notification_rules.trigger_event_type, so just a comment for clarity)
COMMENT ON COLUMN public.notification_rules.trigger_event_type IS
  'Event types: order.paid, customer.birthday, ...';
