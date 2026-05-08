
ALTER TABLE public.agency_settings
  ADD COLUMN IF NOT EXISTS brand_color TEXT DEFAULT '#229c60',
  ADD COLUMN IF NOT EXISTS invoice_header_label TEXT DEFAULT 'INVOICE',
  ADD COLUMN IF NOT EXISTS receipt_header_label TEXT DEFAULT 'KUITANSI PEMBAYARAN';

-- Storage policies for agency-assets (public bucket)
DO $$ BEGIN
  CREATE POLICY "agency-assets read" ON storage.objects FOR SELECT USING (bucket_id = 'agency-assets');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "agency-assets insert" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'agency-assets');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "agency-assets update" ON storage.objects FOR UPDATE USING (bucket_id = 'agency-assets');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "agency-assets delete" ON storage.objects FOR DELETE USING (bucket_id = 'agency-assets');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
