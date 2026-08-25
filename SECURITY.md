# Security Notes — USA Validator v27

## Sensitive data
Uploaded files remain in the browser. Do not send raw SSN, driver's-license, routing or bank-account values to the Brain/RAG layer. Use sanitized derived validation facts instead.

## Paid-only validation
Phone area-code consistency, SSN/DL format checks, and bank/routing format checks are paid-only. The UI disables them for Anonymous/Free accounts. The premium validation engine is not included in the Vite frontend bundle; Render serves it only through `/api/premium-engine` after a server-side Supabase plan check. The runtime therefore fails closed for non-paid accounts.

## Authentication
Supabase Magic Link authentication is used. Frontend uses only the URL and anon key. The Supabase service-role key is server-only.

## Brain providers
The API MASTERLIST supplied for this build contains: LimitDeck (`https://limitdeckai.ru/v1`), NEXUS API (`https://api.nexus-hub.ru/v1`), and Router Cheap (`https://router.cheap/v1`). These are configured as server-side Brain provider catalog entries. Provider API keys are not in source code or VITE variables; store them in Supabase's `brain_providers.api_key_ciphertext` after server-side encryption.

## Authorization
Never trust plan values from the browser. Paid plan assignment must be made by your billing/webhook process in `public.profiles.plan`.

## Anonymous quota
Anonymous 50/72h usage is a convenience anti-abuse boundary only because there is no trusted identity.

## Brain/RAG safety
The current Brain endpoint is deliberately disabled for actual provider calls until credentials and retrieval are configured. This prevents accidental API-key leakage or sending sensitive source rows to external models.

## Provider key setup
Use `scripts/set-brain-provider-key.mjs` from a trusted server/admin environment. The key is encrypted with `BRAIN_CREDENTIAL_KEY` before it is written to Supabase. Keep `BRAIN_CREDENTIAL_KEY` and `SUPABASE_SERVICE_ROLE_KEY` only in Render/server secrets.
