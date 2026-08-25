# API

## GET /health

Returns service health.

## GET /api/config

Returns non-secret application limits.

## GET /api/me

Requires:
`Authorization: Bearer <Supabase access token>`

Returns authenticated account and quota.

## POST /api/usage/reserve

Requires:
`Authorization: Bearer <Supabase access token>`

Body:

```json
{
  "emails": 100
}
```

The server verifies the authenticated user and reserves the requested email credits.

The final enforcement occurs in Supabase's `reserve_email_credits()` function.
