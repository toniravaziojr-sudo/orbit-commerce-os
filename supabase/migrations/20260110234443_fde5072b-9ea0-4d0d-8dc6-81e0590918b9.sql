-- Add is_system_folder column to files table
ALTER TABLE files ADD COLUMN IF NOT EXISTS is_system_folder boolean DEFAULT false;

-- Create unique partial index to ensure only one system folder per tenant
CREATE UNIQUE INDEX IF NOT EXISTS files_system_folder_unique_per_tenant 
ON files (tenant_id) 
WHERE is_system_folder = true AND folder_id IS NULL;