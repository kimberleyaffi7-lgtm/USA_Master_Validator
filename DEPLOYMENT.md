# Deployment — Email Magic Link

## 1. Supabase

### Authentication

Go to:

Authentication → Sign In / Providers → Email

Enable email/passwordless authentication.

This app uses Magic Links.

### URL Configuration

Go to:

Authentication → URL Configuration

Set:

Site URL:
`https://YOUR-RENDER-APP.onrender.com`

Add:

`https://YOUR-RENDER-APP.onrender.com/**`

Replace the hostname with your actual Render hostname.

### Database

Open SQL Editor and run:

`supabase-schema.sql`

## 2. Email delivery

For initial testing, Supabase's default email service may work only for authorized/team addresses and is heavily rate limited.

For a public app, configure a custom SMTP provider:

Authentication → Emails → SMTP Settings

You will need:
- SMTP host
- SMTP port
- SMTP username
- SMTP password
- sender email
- sender name

These settings are stored in Supabase Auth, not in your frontend source code.

## 3. Render

Root Directory:
leave blank

Build Command:
`npm install && npm run build`

Start Command:
`npm start`

Environment Variables:

`SUPABASE_URL`
`SUPABASE_ANON_KEY`
`VITE_SUPABASE_URL`
`VITE_SUPABASE_ANON_KEY`

Use your Supabase Project URL and public Publishable/anon-compatible key.

Do NOT add:
`SUPABASE_SERVICE_ROLE_KEY`
unless a future backend feature explicitly requires it.

Do NOT put any secret in a `VITE_*` variable.

## 4. Test

After deployment:

1. Open the Render URL.
2. Confirm Anonymous appears.
3. Enter your email.
4. Click "Email me a sign-in link".
5. Open the email.
6. Click the Magic Link.
7. Confirm the dashboard returns authenticated.
8. Confirm Plan = free.
9. Confirm Email credits = 200.
10. Upload a small test CSV.
11. Validate it.
12. Sign out.
13. Confirm Anonymous returns with 50 credits.

## 5. Common errors

### "Email address not authorized"

You are using Supabase's default SMTP service. Configure custom SMTP for public addresses.

### "Redirect URL not allowed"

Add the exact Render URL under:

Authentication → URL Configuration → Redirect URLs

### Magic link arrives but dashboard does not authenticate

Make sure the Render URL is the same origin being passed as `emailRedirectTo`.

### User authenticates but quota is wrong

Run `supabase-schema.sql` again and confirm the `profiles` trigger and RLS policies exist.
