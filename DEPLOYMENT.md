# Render Deployment — v27

## 1. Supabase
1. Create/open the Supabase project.
2. Run `supabase-schema.sql` in SQL Editor.
3. Enable Authentication → Email (Magic Link).
4. In Authentication → URL Configuration, set the Render URL as Site URL.
5. Add `http://localhost:3000/**` and `https://YOUR-APP.onrender.com/**` to Redirect URLs.
6. Copy Project URL and anon/public key.
7. Copy the service-role key only into Render server environment variables. Never put it in GitHub or any `VITE_*` variable.

## 2. GitHub
Upload the project files. Do not upload `.env`.

## 3. Render
Root Directory: blank.
Build: `npm install && npm run build`
Start: `npm start`

Environment variables:
`SUPABASE_URL`
`SUPABASE_ANON_KEY`
`SUPABASE_SERVICE_ROLE_KEY`
`VITE_SUPABASE_URL`
`VITE_SUPABASE_ANON_KEY`
`VITE_APP_URL=https://YOUR-APP.onrender.com`
`BRAIN_CREDENTIAL_KEY`
`MAX_FILE_MB=25`

## 4. Paid plan assignment
Never let the frontend select Supreme/Premier. Your payment webhook should update `public.profiles.plan` to `supreme` or `premier`.

## 5. Brain providers
The provider catalog is preloaded from API MASTERLIST.xlsx. Before enabling live Brain calls, store each provider API key in Supabase `brain_providers.api_key_ciphertext` using a server-side encryption workflow. Do not put provider keys in `VITE_*` variables.

## 6. First tests
- Anonymous: confirm 50/72h quota.
- Magic Link: confirm authentication and 200/24h quota.
- Free: confirm phone area-code, SSN/DL and bank/routing controls are disabled.
- Supreme/Premier: confirm those controls unlock.
- As a Free user, request `/api/premium-engine` with your access token and confirm it returns HTTP 403.
- As a paid user, confirm the endpoint returns the premium engine and validation runs.
- Confirm `/api/me` reports the server-side plan.
- Confirm `/api/brain/status` is 403/disabled for Free and enabled for paid accounts.
