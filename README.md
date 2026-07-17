# Stageability Lights and Sounds Inventory System

Standalone Cloudflare Workers application using JavaScript/TypeScript and D1 SQL.
It does not depend on `chatgpt.site` or Sign in with ChatGPT.

## Cloudflare deployment

Requirements: Node.js 22+, npm, and a free Cloudflare account.

1. Install and authenticate:

   ```bash
   npm ci
   npx wrangler login
   ```

2. Create the production SQL database:

   ```bash
   npm run db:create
   ```

   Copy the returned `database_id` into `wrangler.jsonc`, replacing the all-zero
   placeholder ID.

3. Apply the SQL migrations:

   ```bash
   npm run db:migrate:remote
   ```

4. Store a private bootstrap code. Do not put it in source control:

   ```bash
   npm run secret:bootstrap
   ```

5. Test and deploy:

   ```bash
   npm test
   npm run deploy
   ```

Wrangler prints the public `workers.dev` URL after deployment. Activate the
Super Admin from the login screen with the private bootstrap code, username,
and six-digit PIN.

## Security

- Passwords and PINs are stored as PBKDF2-SHA256 hashes.
- Sessions are server-side and expire automatically.
- Role checks are enforced by the API, not only by the interface.
- Keep `BOOTSTRAP_CODE` in Cloudflare Secrets only.
- Never commit `.env` files, database exports, or Cloudflare credentials.

## Main commands

- `npm run dev` - local Worker development server
- `npm test` - production build and rendered output checks
- `npm run db:migrate:local` - apply D1 migrations locally
- `npm run db:migrate:remote` - apply migrations to production D1
- `npm run deploy` - production deployment to Cloudflare Workers
