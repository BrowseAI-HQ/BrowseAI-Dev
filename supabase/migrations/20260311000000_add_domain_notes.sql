-- Add optional notes column to domain_authority for admin annotations
ALTER TABLE domain_authority ADD COLUMN IF NOT EXISTS notes TEXT;
