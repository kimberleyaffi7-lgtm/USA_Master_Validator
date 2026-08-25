# USA Validator API v27

## GET /health
Public health endpoint.

## GET /api/config
Public, non-secret application configuration. It returns plan limits, paid feature names and Brain provider base URLs. It never returns API keys.

## GET /api/me
Requires `Authorization: Bearer <Supabase access token>`. Returns the authenticated plan, quota and server-authoritative feature flags.

## POST /api/usage/reserve
Requires a valid Supabase access token. Body: `{ "emails": 100 }`. Server/database enforce the email-credit quota.

## POST /api/features/authorize
Requires a valid Supabase access token. Body: `{ "feature": "phone_area_code" }`. Valid paid-only features are `phone_area_code`, `ssn_dl_format`, and `bank_routing_format`.

## GET /api/brain/status
Requires authentication. Returns Brain availability and provider names/base URLs only. Provider API keys are never returned.

## POST /api/brain/chat
Paid-only gateway for future Brain/RAG calls. The current safe build intentionally returns `501` until provider credentials and the RAG retrieval layer are activated. Never send raw SSN, DL, routing or bank-account values to this endpoint.

## Brain provider behavior
The Brain router uses the enabled provider rows in `brain_providers`, ordered by `priority`. It never returns provider API keys. It sends only sanitized context supplied by the client; raw sensitive identifiers should never be supplied.
