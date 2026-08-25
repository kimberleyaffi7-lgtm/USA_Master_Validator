# Security Notes

## Data handling

Uploaded files are processed in the browser. They are not sent to the Render server as file uploads.

This is especially important because the original dashboard supports columns that may contain sensitive identifiers such as SSN, driver's license, routing and bank-account values. fileciteturn0file0L82-L93

## Authentication

Google login is provided through Supabase Auth.

The frontend uses only the Supabase URL and anon key.

Never expose:
- Supabase service_role key
- Stripe secret key
- OAuth client secret
- database password

## Authorization

Paid plans must be assigned on the server/database.

Never trust:
- frontend plan values
- localStorage plan values
- query-string plan values
- hidden HTML controls

## Anonymous quota

Anonymous quota is intentionally a convenience anti-abuse limit, not a security boundary.

## Browser processing

Client-side processing reduces server-side exposure but does not make the user's own browser a trusted environment. Do not claim that the app provides regulatory compliance merely because files are processed locally.

## Production hardening

Before commercial launch:
- Add a custom domain.
- Configure strict Content Security Policy.
- Add rate limiting.
- Add abuse detection.
- Add billing webhook signature verification.
- Add audit logs without raw sensitive values.
- Add automated tests.
- Add dependency scanning.
- Review data-retention and privacy requirements.
