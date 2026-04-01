
-- Drop and recreate trigger to fire on INSERT OR UPDATE
DROP TRIGGER IF EXISTS trg_recalc_customer_metrics_on_order ON orders;

CREATE TRIGGER trg_recalc_customer_metrics_on_order
AFTER INSERT OR UPDATE ON orders
FOR EACH ROW
EXECUTE FUNCTION trg_recalc_customer_on_order();
