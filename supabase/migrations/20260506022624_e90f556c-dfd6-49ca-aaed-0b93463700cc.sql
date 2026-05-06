
-- Enums
CREATE TYPE public.invoice_status AS ENUM ('draft','sent','partially_paid','paid','overdue','cancelled');
CREATE TYPE public.payment_method AS ENUM ('bank_transfer','cash','credit_card','e_wallet','other');

-- Agency settings (single-row)
CREATE TABLE public.agency_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL DEFAULT 'My Agency',
  email TEXT,
  phone TEXT,
  address TEXT,
  logo_url TEXT,
  bank_name TEXT,
  bank_account_number TEXT,
  bank_account_name TEXT,
  receipt_footer TEXT DEFAULT 'Terima kasih atas pembayaran Anda.',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
INSERT INTO public.agency_settings (name) VALUES ('Invoize Agency');

-- Clients
CREATE TABLE public.clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  company TEXT,
  email TEXT,
  phone TEXT,
  address TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Invoices
CREATE TABLE public.invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_number TEXT NOT NULL UNIQUE,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE RESTRICT,
  issue_date DATE NOT NULL DEFAULT CURRENT_DATE,
  due_date DATE NOT NULL DEFAULT (CURRENT_DATE + INTERVAL '14 days'),
  subtotal NUMERIC(14,2) NOT NULL DEFAULT 0,
  tax_rate NUMERIC(5,2) NOT NULL DEFAULT 0,
  tax_amount NUMERIC(14,2) NOT NULL DEFAULT 0,
  total NUMERIC(14,2) NOT NULL DEFAULT 0,
  paid_amount NUMERIC(14,2) NOT NULL DEFAULT 0,
  status public.invoice_status NOT NULL DEFAULT 'draft',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Invoice items
CREATE TABLE public.invoice_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  quantity NUMERIC(14,2) NOT NULL DEFAULT 1,
  unit_price NUMERIC(14,2) NOT NULL DEFAULT 0,
  amount NUMERIC(14,2) NOT NULL DEFAULT 0,
  position INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Payments
CREATE TABLE public.payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  receipt_number TEXT NOT NULL UNIQUE,
  invoice_id UUID NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  payment_date DATE NOT NULL DEFAULT CURRENT_DATE,
  method public.payment_method NOT NULL DEFAULT 'bank_transfer',
  amount NUMERIC(14,2) NOT NULL CHECK (amount > 0),
  proof_path TEXT,
  notes TEXT,
  emailed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_invoices_client ON public.invoices(client_id);
CREATE INDEX idx_invoices_status ON public.invoices(status);
CREATE INDEX idx_payments_invoice ON public.payments(invoice_id);
CREATE INDEX idx_invoice_items_invoice ON public.invoice_items(invoice_id);

-- updated_at trigger
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

CREATE TRIGGER trg_clients_updated BEFORE UPDATE ON public.clients FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_invoices_updated BEFORE UPDATE ON public.invoices FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_payments_updated BEFORE UPDATE ON public.payments FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_settings_updated BEFORE UPDATE ON public.agency_settings FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Auto invoice number
CREATE OR REPLACE FUNCTION public.generate_invoice_number()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE prefix TEXT; next_num INT;
BEGIN
  IF NEW.invoice_number IS NULL OR NEW.invoice_number = '' THEN
    prefix := 'INV-' || to_char(now(),'YYYYMM') || '-';
    SELECT COALESCE(MAX(NULLIF(regexp_replace(invoice_number, '^' || prefix, ''), '')::INT), 0) + 1
      INTO next_num FROM public.invoices WHERE invoice_number LIKE prefix || '%';
    NEW.invoice_number := prefix || lpad(next_num::TEXT, 4, '0');
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER trg_invoice_number BEFORE INSERT ON public.invoices FOR EACH ROW EXECUTE FUNCTION public.generate_invoice_number();

-- Auto receipt number
CREATE OR REPLACE FUNCTION public.generate_receipt_number()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE prefix TEXT; next_num INT;
BEGIN
  IF NEW.receipt_number IS NULL OR NEW.receipt_number = '' THEN
    prefix := 'RCP-' || to_char(now(),'YYYYMM') || '-';
    SELECT COALESCE(MAX(NULLIF(regexp_replace(receipt_number, '^' || prefix, ''), '')::INT), 0) + 1
      INTO next_num FROM public.payments WHERE receipt_number LIKE prefix || '%';
    NEW.receipt_number := prefix || lpad(next_num::TEXT, 4, '0');
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER trg_receipt_number BEFORE INSERT ON public.payments FOR EACH ROW EXECUTE FUNCTION public.generate_receipt_number();

-- Reconciliation: recompute invoice paid_amount + status from payments
CREATE OR REPLACE FUNCTION public.reconcile_invoice(p_invoice_id UUID)
RETURNS VOID LANGUAGE plpgsql AS $$
DECLARE v_total NUMERIC; v_paid NUMERIC; v_status public.invoice_status; v_current public.invoice_status;
BEGIN
  SELECT total, status INTO v_total, v_current FROM public.invoices WHERE id = p_invoice_id;
  IF NOT FOUND THEN RETURN; END IF;
  SELECT COALESCE(SUM(amount),0) INTO v_paid FROM public.payments WHERE invoice_id = p_invoice_id;

  IF v_paid <= 0 THEN
    v_status := CASE WHEN v_current IN ('draft','cancelled') THEN v_current ELSE 'sent' END;
  ELSIF v_paid >= v_total AND v_total > 0 THEN
    v_status := 'paid';
  ELSE
    v_status := 'partially_paid';
  END IF;

  UPDATE public.invoices SET paid_amount = v_paid, status = v_status, updated_at = now()
   WHERE id = p_invoice_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.payments_reconcile_trigger()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN PERFORM public.reconcile_invoice(OLD.invoice_id); RETURN OLD; END IF;
  PERFORM public.reconcile_invoice(NEW.invoice_id);
  IF TG_OP = 'UPDATE' AND OLD.invoice_id <> NEW.invoice_id THEN
    PERFORM public.reconcile_invoice(OLD.invoice_id);
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER trg_payments_reconcile AFTER INSERT OR UPDATE OR DELETE ON public.payments
FOR EACH ROW EXECUTE FUNCTION public.payments_reconcile_trigger();

-- Recompute invoice totals from items + tax
CREATE OR REPLACE FUNCTION public.recompute_invoice_totals(p_invoice_id UUID)
RETURNS VOID LANGUAGE plpgsql AS $$
DECLARE v_subtotal NUMERIC; v_tax_rate NUMERIC; v_tax NUMERIC; v_total NUMERIC;
BEGIN
  SELECT COALESCE(SUM(quantity * unit_price),0) INTO v_subtotal FROM public.invoice_items WHERE invoice_id = p_invoice_id;
  SELECT tax_rate INTO v_tax_rate FROM public.invoices WHERE id = p_invoice_id;
  v_tax := round(v_subtotal * COALESCE(v_tax_rate,0) / 100, 2);
  v_total := v_subtotal + v_tax;
  UPDATE public.invoices SET subtotal = v_subtotal, tax_amount = v_tax, total = v_total, updated_at = now()
   WHERE id = p_invoice_id;
  PERFORM public.reconcile_invoice(p_invoice_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.invoice_items_recompute_trigger()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
    NEW.amount := NEW.quantity * NEW.unit_price;
  END IF;
  IF TG_OP = 'DELETE' THEN PERFORM public.recompute_invoice_totals(OLD.invoice_id); RETURN OLD; END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER trg_invoice_items_amount BEFORE INSERT OR UPDATE ON public.invoice_items
FOR EACH ROW EXECUTE FUNCTION public.invoice_items_recompute_trigger();

CREATE OR REPLACE FUNCTION public.invoice_items_after_trigger()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN PERFORM public.recompute_invoice_totals(OLD.invoice_id); RETURN OLD; END IF;
  PERFORM public.recompute_invoice_totals(NEW.invoice_id);
  RETURN NEW;
END;
$$;
CREATE TRIGGER trg_invoice_items_after AFTER INSERT OR UPDATE OR DELETE ON public.invoice_items
FOR EACH ROW EXECUTE FUNCTION public.invoice_items_after_trigger();

-- Enable RLS (single-user mode: open policies; tighten later when auth added)
ALTER TABLE public.agency_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoice_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "open all" ON public.agency_settings FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "open all" ON public.clients FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "open all" ON public.invoices FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "open all" ON public.invoice_items FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "open all" ON public.payments FOR ALL USING (true) WITH CHECK (true);

-- Storage buckets
INSERT INTO storage.buckets (id, name, public) VALUES ('payment-proofs','payment-proofs', false)
  ON CONFLICT (id) DO NOTHING;
INSERT INTO storage.buckets (id, name, public) VALUES ('agency-assets','agency-assets', true)
  ON CONFLICT (id) DO NOTHING;

CREATE POLICY "proofs read" ON storage.objects FOR SELECT USING (bucket_id = 'payment-proofs');
CREATE POLICY "proofs write" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'payment-proofs');
CREATE POLICY "proofs update" ON storage.objects FOR UPDATE USING (bucket_id = 'payment-proofs');
CREATE POLICY "proofs delete" ON storage.objects FOR DELETE USING (bucket_id = 'payment-proofs');

CREATE POLICY "assets read" ON storage.objects FOR SELECT USING (bucket_id = 'agency-assets');
CREATE POLICY "assets write" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'agency-assets');
CREATE POLICY "assets update" ON storage.objects FOR UPDATE USING (bucket_id = 'agency-assets');
CREATE POLICY "assets delete" ON storage.objects FOR DELETE USING (bucket_id = 'agency-assets');
