# First deploy (M2): Vercel + Neon + Google sign-in

**For:** the owner. These steps need your accounts, so Claude can't do them. Expect about 45 minutes.

**What you end up with:** one URL where both athletes sign in with Google. Anyone else is refused.

**Never paste secrets into chat.** Put them straight into `.env.local`, `.env.prod.local` (both git-ignored) or Vercel's settings.

**Gate:** production deploys only after Next.js is bumped to the patched 16.4.x release (announced for 14 Oct 2026). Claude does that bump, runs all checks and commits it before step 5.

---

## 1. GitHub (private repo)

1. github.com → **New repository** → name it `yoddha-prep`, set it to **Private**, and don't add a README, .gitignore or licence.
2. Send Claude the repo URL. Claude pushes `main` and `m2-backend`.

## 2. Google sign-in (Google Cloud Console)

1. console.cloud.google.com → create a project named **Yoddha Prep**.
2. **OAuth consent screen** (Google Auth Platform → Branding / Audience):
   - User type **External**. App name "Yoddha Prep", plus your email as the support and developer contact.
   - Publishing status: leave it in **Testing**.
   - **Test users:** add both athletes' Google emails. Only these accounts can get past Google, which adds a second gate on top of `ALLOWED_EMAILS`.
3. **Clients → Create client → Web application**, named "Yoddha Prep".
   - **Authorized JavaScript origins:** `http://localhost:3000`. Add the Vercel URL after step 4.
   - **Authorized redirect URIs:** `http://localhost:3000/api/auth/callback/google`. Add the Vercel one after step 4.
4. Copy the **Client ID** and **Client secret**.

**Optional local test before deploying.** In `.env.local`, fill in:
- `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`.
- `BETTER_AUTH_SECRET`, generated with:
  ```
  node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
  ```
- `ALLOWED_EMAILS=<your gmail>,<Aryan's gmail>`.

Then run `npm run db:up` and `npm run dev`, and open http://localhost:3000. Signing in should show "Signed in as …, no athlete profile yet". Signing in with any other Google account should show "This Google account isn't on the Yoddha Prep list".

## 3. Database (Neon, Free plan)

1. neon.com → sign up → **New project**:
   - Name: `yoddha-prep`.
   - **Postgres 18**.
   - Region: **AWS Asia Pacific (Singapore)**, i.e. `aws-ap-southeast-1`.
2. **Connect** gives you two connection strings. Copy both.
   - **Pooled** (the host contains `-pooler`) → becomes `DATABASE_URL` in Vercel.
   - **Direct** (connection pooling switched off) → goes in your laptop's `.env.prod.local`, for migrations and backups:
     ```
     DATABASE_URL_DIRECT=postgresql://…
     ```
3. Create the tables. This takes a backup first, then migrates:
   ```
   npm run db:migrate:prod -- --yes
   ```

## 4. App hosting (Vercel, Hobby plan)

1. vercel.com → **Add New → Project** → import the `yoddha-prep` GitHub repo (framework: Next.js).
   - The production branch is `main`.
   - Functions run in **Singapore (`sin1`)** because of `vercel.json`. Node is 24.x.
2. **Settings → Environment Variables.** Scope every variable to **Production only**:

   | Name | Value |
   |---|---|
   | `DATABASE_URL` | Neon **pooled** connection string |
   | `BETTER_AUTH_SECRET` | a **new** random value, not the local one (same command as above) |
   | `BETTER_AUTH_URL` | `https://<your-project>.vercel.app` |
   | `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | from step 2 |
   | `ALLOWED_EMAILS` | `<your gmail>,<Aryan's gmail>` |

   `DATABASE_URL_DIRECT` does **not** go in Vercel: migrations and backups run from your laptop.
3. Back in Google Cloud (step 2.3), add `https://<your-project>.vercel.app` as an origin and `https://<your-project>.vercel.app/api/auth/callback/google` as a redirect URI.
4. **Preview deployments** can't reach the production database or sign-in, since the variables are Production-only, so they show errors. That's expected. Leave **Deployment Protection** on.

## 5. Go live

1. At the M2 review, Claude merges `m2-backend` into `main`, and Vercel deploys it.
2. Check:
   - [ ] The URL opens the sign-in page.
   - [ ] You can sign in.
   - [ ] Aryan can sign in.
   - [ ] A third Google account is refused with the "isn't on the list" message.
   - [ ] Signing out returns you to the sign-in page.
3. First backup, which proves the procedure on the real database:
   ```
   npm run db:backup
   npm run db:restore-check -- backups/<the new file>.dump
   ```

## Later changes

- **Schema changes:** generate with `npm run db:generate`, review the SQL, then `npm run db:migrate:prod -- --yes` **before** merging to `main`.
- **Allowlist changes:** edit `ALLOWED_EMAILS` in Vercel and **redeploy**, because env vars are read when the server starts.
