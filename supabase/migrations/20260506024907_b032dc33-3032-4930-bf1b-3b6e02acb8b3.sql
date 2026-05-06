
ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS is_recurring boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS recurring_day integer,
  ADD COLUMN IF NOT EXISTS recurring_active boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS next_run_date date,
  ADD COLUMN IF NOT EXISTS recurring_parent_id uuid REFERENCES public.invoices(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_invoices_recurring_due
  ON public.invoices (next_run_date)
  WHERE is_recurring = true AND recurring_active = true;

-- Compute next run date (next occurrence of recurring_day on or after p_from)
CREATE OR REPLACE FUNCTION public.compute_next_run_date(p_from date, p_day integer)
RETURNS date
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  y int := EXTRACT(YEAR FROM p_from)::int;
  m int := EXTRACT(MONTH FROM p_from)::int;
  d int := LEAST(GREATEST(p_day, 1), 28); -- clamp to 28 to avoid invalid dates; we then bump to month-end if needed
  candidate date;
  last_day int;
BEGIN
  -- Try this month first
  last_day := EXTRACT(DAY FROM (date_trunc('month', make_date(y, m, 1)) + INTERVAL '1 month - 1 day'))::int;
  candidate := make_date(y, m, LEAST(p_day, last_day));
  IF candidate < p_from THEN
    -- next month
    IF m = 12 THEN y := y + 1; m := 1; ELSE m := m + 1; END IF;
    last_day := EXTRACT(DAY FROM (date_trunc('month', make_date(y, m, 1)) + INTERVAL '1 month - 1 day'))::int;
    candidate := make_date(y, m, LEAST(p_day, last_day));
  END IF;
  RETURN candidate;
END;
$$;

-- Auto set next_run_date when recurring config changes
CREATE OR REPLACE FUNCTION public.invoices_set_next_run()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.is_recurring AND NEW.recurring_active AND NEW.recurring_day IS NOT NULL THEN
    IF NEW.next_run_date IS NULL
       OR (TG_OP = 'UPDATE' AND (
            COALESCE(OLD.recurring_day, -1) <> NEW.recurring_day
         OR COALESCE(OLD.is_recurring, false) <> NEW.is_recurring
         OR COALESCE(OLD.recurring_active, false) <> NEW.recurring_active
       )) THEN
      NEW.next_run_date := public.compute_next_run_date(CURRENT_DATE, NEW.recurring_day);
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_invoices_set_next_run ON public.invoices;
CREATE TRIGGER trg_invoices_set_next_run
BEFORE INSERT OR UPDATE ON public.invoices
FOR EACH ROW EXECUTE FUNCTION public.invoices_set_next_run();

-- Generator: clone due recurring invoices into new invoices + items
CREATE OR REPLACE FUNCTION public.generate_recurring_invoices()
RETURNS integer
LANGUAGE plpgsql
AS $$
DECLARE
  r record;
  new_id uuid;
  created_count int := 0;
BEGIN
  FOR r IN
    SELECT * FROM public.invoices
    WHERE is_recurring = true
      AND recurring_active = true
      AND recurring_day IS NOT NULL
      AND next_run_date IS NOT NULL
      AND next_run_date <= CURRENT_DATE
  LOOP
    INSERT INTO public.invoices (
      invoice_number, client_id, issue_date, due_date,
      tax_rate, notes, status,
      is_recurring, recurring_active, recurring_parent_id
    ) VALUES (
      '', r.client_id, CURRENT_DATE,
      CURRENT_DATE + GREATEST(1, (r.due_date - r.issue_date)),
      r.tax_rate, r.notes, 'sent',
      false, false, r.id
    ) RETURNING id INTO new_id;

    INSERT INTO public.invoice_items (invoice_id, description, quantity, unit_price, position)
    SELECT new_id, description, quantity, unit_price, position
    FROM public.invoice_items
    WHERE invoice_id = r.id
    ORDER BY position;

    UPDATE public.invoices
       SET next_run_date = public.compute_next_run_date(CURRENT_DATE + 1, r.recurring_day)
     WHERE id = r.id;

    created_count := created_count + 1;
  END LOOP;
  RETURN created_count;
END;
$$;
