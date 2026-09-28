# 51Talk Target Pulse

Responsive shared countdown on GitHub Pages with a Supabase PostgreSQL backend. Browsers refresh every two seconds, avoid overlapping reads, and retry interrupted cloud writes with the same request ID to avoid counting twice.

## Backend setup

Run `supabase/schema.sql` in a free Supabase project's SQL editor. Put its URL and **publishable** key in `public/config.js`. Never publish a database password or secret/service-role key. Enable GitHub Pages with GitHub Actions as the source, then push to main.

The counter starts at 165. Every visitor can record a contract: this is a public collaborative counter, not an authenticated sales ledger. Public clients cannot reset the total, write tables directly, or access event records. Atomic database updates serialize simultaneous clicks and deduplicate request IDs. An administrator can reset the counter in Supabase for a new campaign. The clock counts to the viewer's local midnight; it does not reset the shared total.

Supabase free projects have usage limits and may pause after inactivity. Two-second refresh is a polling target, subject to network availability and browser throttling.

## Local development

Run `npm ci` then `npm start` and open http://localhost:3000. With cloud configuration empty, localhost uses the Express API and serialized JSON-file writes. This single-process fallback is for local use. Supabase provides production persistence.

Deployment files are in `public/` and `.github/workflows/pages.yml`.
