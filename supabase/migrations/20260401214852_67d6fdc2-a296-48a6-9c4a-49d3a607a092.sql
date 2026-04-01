-- Add result column for business-level tracking
-- status = success | error (technical outcome)
-- result = created | updated | unchanged | skipped (business outcome)
ALTER TABLE public.import_items 
ADD COLUMN IF NOT EXISTS result text;

-- Add comment for documentation
COMMENT ON COLUMN public.import_items.result IS 'Business outcome: created, updated, unchanged, skipped. Separate from status (technical: success/error).';

-- Create index for efficient querying by result
CREATE INDEX IF NOT EXISTS idx_import_items_result ON public.import_items (result) WHERE result IS NOT NULL;