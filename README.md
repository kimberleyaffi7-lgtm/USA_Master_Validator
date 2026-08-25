# USA Validator — Render v27

A simple Render-ready USA data validation dashboard with Supabase Magic Link authentication, plan-based quotas, paid-only premium validation, and a server-side Brain/RAG gateway foundation.

## Plans
- Anonymous: 50 emails / rolling 72 hours
- Free authenticated: 200 emails / rolling 24 hours
- Supreme: 25,000 email credits / month
- Premier: 50,000 email credits / month

## Paid-only features
Only Supreme and Premier can use:
- Phone area-code consistency checks
- SSN / driver's-license format checks
- Bank / routing (ABA) format checks

Free users can still use the core email, ZIP/geographic and disposable-email validation features.

## Brain modules
The supplied API MASTERLIST.xlsx specifies these Brain provider endpoints:
1. LimitDeck — https://limitdeckai.ru/v1
2. NEXUS API — https://api.nexus-hub.ru/v1
3. Router Cheap — https://router.cheap/v1

Provider URLs are server-side catalog metadata. API keys must be stored in Supabase, never in frontend code. The v27 gateway is intentionally safe until provider credentials are configured. The uploaded API master list contains provider names/base URLs but no model names, so configure a supported model per provider before live Brain calls.

## Deploy to Render
Root Directory: leave blank.
Build Command: `npm install && npm run build`
Start Command: `npm start`

Required Render variables:
- SUPABASE_URL
- SUPABASE_ANON_KEY
- SUPABASE_SERVICE_ROLE_KEY
- VITE_SUPABASE_URL
- VITE_SUPABASE_ANON_KEY
- VITE_APP_URL
- BRAIN_CREDENTIAL_KEY
- MAX_FILE_MB=25

Run `supabase-schema.sql` once in Supabase SQL Editor. Enable Supabase Email/OTP authentication and add both local and Render redirect URLs.

## Important data design
CSV/XLS/XLSX files are processed locally in the browser. The server receives only authentication/quota requests. Do not change this architecture casually because the validator can handle sensitive fields.
