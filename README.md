# VFW Post 7570 Serving Network

This is the VFW Post 7570 Serving Network app. It is set up as a standalone Vercel app with a React frontend, Node API routes, and Supabase Postgres as the CRM/data store.

The VFW version does not require an outside CRM. Pledges, volunteers, event sign-ups, admin users, categories, reports, and recipient/contact details are stored in Supabase.

## Local Setup

```bash
npm install
cp .env.example .env
npm run dev
```

Set the values in `.env` before running against a real database:

- `DATABASE_URL`: VFW Supabase Postgres connection string.
- `SESSION_SECRET`: long random secret for sessions and signed links.
- `CRON_SECRET`: long random secret for Vercel cron endpoints.
- `HOST_URL`: production Vercel URL, preferably `https://apps.vfwharrisonoh.org`.
- `PUBLIC_URL`: Wix page URL that embeds the app, likely `https://vfwharrisonoh.org/serving-network/`.
- `DEFAULT_FROM_EMAIL`: sender address, default `communications@vfwharrisonoh.org`.
- `CONTACT_EMAIL`: inbox for contact/admin messages.
- `MAILERSEND_API_TOKEN`: transactional email API token.
- `INITIAL_ADMIN_EMAIL` and `INITIAL_ADMIN_PASSWORD`: first-run only; remove after admin account is created.

Optional:

- `MAILERLITE_API_KEY` and `MAILERLITE_SUPPORTERS_GROUP_ID` if VFW wants email-list sync.
- `ANTHROPIC_API_KEY` if VFW wants the admin ask/do assistant enabled.

## Supabase

1. Create/open the VFW Supabase project.
2. Copy the pooled Postgres connection string into `DATABASE_URL`.
3. Run `supabase/init.sql` in the Supabase SQL editor.
4. Run `supabase/calendar-schema.sql` if the calendar pages will be used.
5. Run `npm run db:push` from this project when schema changes are ready.

Do not import legacy calendar export files unless VFW intentionally wants sample data.

## Vercel

Vercel should use:

- Build command: `npm run vercel-build`
- Output directory: `dist/public`
- Node API entrypoint: `api/[...route].ts`

Add production environment variables in Vercel:

```bash
vercel env add DATABASE_URL
vercel env add SESSION_SECRET
vercel env add CRON_SECRET
vercel env add HOST_URL
vercel env add PUBLIC_URL
vercel env add DEFAULT_FROM_EMAIL
vercel env add CONTACT_EMAIL
vercel env add MAILERSEND_API_TOKEN
```

Add optional variables only if the Post is using those services:

```bash
vercel env add MAILERLITE_API_KEY
vercel env add MAILERLITE_SUPPORTERS_GROUP_ID
vercel env add ANTHROPIC_API_KEY
```

## GitHub

Use the VFW GitHub repository as the remote for this folder, then push `main`. Vercel can import that repo or stay linked through the Vercel CLI.

```bash
git init
git add .
git commit -m "Initial VFW serving network"
git remote add origin <vfw-github-repo-url>
git branch -M main
git push -u origin main
```

## Wix Embed

After the Vercel production URL is live, add it to the Wix page with an iframe:

```html
<iframe
  src="https://apps.vfwharrisonoh.org/"
  title="VFW Post 7570 Serving Network"
  style="width:100%;border:0;min-height:900px;"
  loading="lazy"
></iframe>
```

If Wix blocks automatic resizing, set the iframe height manually on desktop and mobile. Keep `PUBLIC_URL` pointed at the Wix page so shared links and emails send people back to the public site instead of only the raw app URL.
