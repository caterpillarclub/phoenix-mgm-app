# Phoenix MGM Job Invoice App

## Install / update on Vercel

1. Upload all extracted files to GitHub.
2. In Supabase, open SQL Editor and run `supabase/schema.sql`.
3. In Supabase, go to Project Settings > API and copy:
   - Project URL
   - anon public key
4. In Vercel > Project > Settings > Environment Variables, add:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
5. Redeploy Vercel.

## Invoice numbering

The database function `create_invoice(payload jsonb)` creates progressive invoice numbers:

`INV-2026-0001`, `INV-2026-0002`, etc.

Once an invoice is created, its number is saved and cannot be reused.

## Prototype security note

The SQL file includes demo open policies to make the prototype work quickly. For real production, enable Supabase Auth and replace policies with user-specific rules.
