-- Sync avg_rating and review_count from product_reviews to products table
UPDATE products p
SET 
  avg_rating = sub.avg_rating,
  review_count = sub.review_count
FROM (
  SELECT 
    product_id,
    ROUND(AVG(rating)::numeric, 1) as avg_rating,
    COUNT(*)::int as review_count
  FROM product_reviews
  WHERE status = 'approved'
  GROUP BY product_id
) sub
WHERE p.id = sub.product_id
  AND (p.avg_rating IS DISTINCT FROM sub.avg_rating OR p.review_count IS DISTINCT FROM sub.review_count);

-- Create a trigger to automatically sync ratings when reviews change
CREATE OR REPLACE FUNCTION sync_product_rating()
RETURNS TRIGGER AS $$
DECLARE
  target_product_id uuid;
  new_avg numeric;
  new_count int;
BEGIN
  -- Determine which product_id to update
  IF TG_OP = 'DELETE' THEN
    target_product_id := OLD.product_id;
  ELSE
    target_product_id := NEW.product_id;
  END IF;

  -- Calculate new stats
  SELECT 
    COALESCE(ROUND(AVG(rating)::numeric, 1), 0),
    COALESCE(COUNT(*), 0)
  INTO new_avg, new_count
  FROM product_reviews
  WHERE product_id = target_product_id
    AND status = 'approved';

  -- Update the products table
  UPDATE products
  SET avg_rating = new_avg, review_count = new_count
  WHERE id = target_product_id;

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop existing trigger if any
DROP TRIGGER IF EXISTS trg_sync_product_rating ON product_reviews;

-- Create trigger
CREATE TRIGGER trg_sync_product_rating
AFTER INSERT OR UPDATE OR DELETE ON product_reviews
FOR EACH ROW
EXECUTE FUNCTION sync_product_rating();