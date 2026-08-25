# Brain Provider Catalog

Source: user-supplied `API MASTERLIST.xlsx` (Sheet1).

| Priority | Provider | Base URL |
|---:|---|---|
| 1 | LimitDeck | https://limitdeckai.ru/v1 |
| 2 | NEXUS API | https://api.nexus-hub.ru/v1 |
| 3 | Router Cheap | https://router.cheap/v1 |

The server-side Brain router tries enabled providers in priority order and falls back to the next provider when a request fails.

API keys are encrypted before being stored in Supabase `brain_providers.api_key_ciphertext`. They are decrypted only in the Render server process. Never place them in `VITE_*` variables.

To configure a provider locally/server-side:

```bash
SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... BRAIN_CREDENTIAL_KEY=... node scripts/set-brain-provider-key.mjs "LimitDeck" "YOUR_API_KEY" "YOUR_MODEL"
```

Use the exact model identifier supported by that provider. The base URLs above are source-derived from the uploaded master list; model names and credentials were not present in that file.
