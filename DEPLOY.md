# Deploy Brand Guide App (go live)

You can’t “push localhost” from here—you need to deploy to a host. Easiest path: **Vercel** (free tier, made for Next.js).

## 1. Push your code to GitHub

If you haven’t already:

```bash
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO.git
git push -u origin main
```

(Replace `YOUR_USERNAME` and `YOUR_REPO` with your repo.)

## 2. Deploy on Vercel

1. Go to [vercel.com](https://vercel.com) and sign in (GitHub is fine).
2. Click **Add New…** → **Project**.
3. Import your GitHub repo (the one you pushed above).
4. Leave **Framework Preset** as Next.js and **Build Command** as `npm run build` (or leave default).
5. Under **Environment Variables**, add:
   - **Name:** `ANTHROPIC_API_KEY`  
   - **Value:** your real API key (same as in `.env.local`).  
   Do **not** commit this key; only set it in Vercel.
6. Click **Deploy**.

Vercel will build and give you a URL like `https://your-project.vercel.app`. That’s your app live.

## 3. Optional env vars (same as local)

If you use them locally, you can add them in Vercel → Project → Settings → Environment Variables:

- `ANTHROPIC_EXTRACTION_MODEL` (optional)
- `ANTHROPIC_BRANDGUIDE_MODEL` (optional)
- `ANTHROPIC_WEB_FETCH_TIMEOUT_MS` (optional)

## Notes

- **API key:** Never put `ANTHROPIC_API_KEY` in the repo. Only in `.env.local` (local) and Vercel env vars (production).
- **Build:** The project’s `build` script runs `next build`, so Vercel’s default `npm run build` is correct.
- **Custom domain:** In Vercel → Project → Settings → Domains you can add your own domain.
