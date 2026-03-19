ALTER TABLE bill_extractions
  ADD COLUMN IF NOT EXISTS peak_kwh      numeric,
  ADD COLUMN IF NOT EXISTS off_peak_kwh  numeric,
  ADD COLUMN IF NOT EXISTS shoulder_kwh  numeric,
  ADD COLUMN IF NOT EXISTS gst_amount    numeric,
  ADD COLUMN IF NOT EXISTS peak_rate     numeric,
  ADD COLUMN IF NOT EXISTS off_peak_rate numeric;
