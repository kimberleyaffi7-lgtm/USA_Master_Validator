# Render Deployment — Non-Technical Checklist

## A. Supabase

- [ ] Create a Supabase project.
- [ ] Copy Project URL.
- [ ] Copy anon/public key.
- [ ] Run `supabase-schema.sql`.
- [ ] Enable Google provider.
- [ ] Configure Google OAuth credentials.
- [ ] Add Render URL to Supabase redirect URLs.

## B. GitHub

- [ ] Create a new GitHub repository.
- [ ] Upload all project files.
- [ ] Do not upload `.env`.
- [ ] Confirm `.env` is ignored.

## C. Render

Create a Web Service.

Build:
`npm ci && npm run build`

Start:
`npm start`

Environment:
`SUPABASE_URL`
`SUPABASE_ANON_KEY`
`VITE_SUPABASE_URL`
`VITE_SUPABASE_ANON_KEY`

Optional:
`MAX_FILE_MB=25`

## D. First test

1. Open the Render URL.
2. Upload a tiny CSV with 5–10 rows.
3. Confirm mapping.
4. Run validation.
5. Confirm charts.
6. Export Excel.
7. Sign in with Google.
8. Confirm plan changes to Free.
9. Confirm remaining credits show 200.
10. Test a small authenticated upload.

## E. Paid plan activation

Do not manually expose a plan selector to customers.

Your billing webhook should update:

`public.profiles.plan`

Allowed values:
- `free`
- `supreme`
- `premier`

The database function enforces the paid monthly limits.
