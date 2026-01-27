-- Add foreign key from purchases to suppliers if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'purchases_supplier_id_fkey'
    AND table_name = 'purchases'
  ) THEN
    ALTER TABLE public.purchases
    ADD CONSTRAINT purchases_supplier_id_fkey 
    FOREIGN KEY (supplier_id) REFERENCES public.suppliers(id) ON DELETE SET NULL;
  END IF;
END $$;