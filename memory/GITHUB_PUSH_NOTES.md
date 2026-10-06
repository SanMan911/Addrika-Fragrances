# GitHub push protection — why pushes were blocked, and the standing rules

**Investigated 2026-06-06.** The repo would not push to GitHub because **GitHub Secret Scanning
push protection** matched real provider credentials inside the commit history. Push protection
scans *every commit being pushed*, not just the latest tree — so deleting a file does NOT unblock
the push.

## What was actually found

Full audit: 3,280 blobs across all 384 commits were scanned for provider key patterns
(`sbp_`, `sb_secret_`, `sk-`, `sk_live_`, `rzp_live_`, `re_…`, `ghp_`, `AIza`, `xox*`, `SG.`).

| Secret | File (historic) | Risk | Status |
|---|---|---|---|
| `sb_secret_…` Supabase **secret key** | `memory/test_credentials.md` | **HIGH — full DB/admin access** | in history (commit `e40d4d4`); scrubbed from the working tree |
| `***REMOVED***` Google Maps key | `frontend-next/components/RetailerMap.js` | LOW — Google's own public demo key, and the file no longer uses it | history only |
| `***REMOVED***` Firebase web key | `frontend/public/firebase-messaging-sw.js` | LOW — Firebase web keys are client-side by design | history only |
| `sess_…` admin session token | `memory/.admin_token` | MEDIUM — live admin session | untracked + gitignored 2026-06-06 |
| Supabase refresh token | `memory/.qa_refresh_token` | MEDIUM — live QA session | untracked + gitignored 2026-06-06 |
| `frontend/.env.production` | removed long ago | — | already untracked |

**Application source code is clean** — no hardcoded credentials in any `.py` / `.js` / `.ts` /
`.json` / `.yml`. Everything reads from `os.environ` / `process.env`. The matches that look
alarming in a naive grep (`re_festival_code_exists`, `sk-round-bottom-outline`, …) are Python test
function names and CSS icon classes — false positives.

## What was fixed in the working tree (so all FUTURE commits are clean)
1. `git rm --cached memory/.admin_token memory/.qa_refresh_token` + added to `.gitignore`.
2. Every real provider secret in `memory/*.md` replaced with a pointer such as
   `<read it from backend/.env -> SUPABASE_SERVICE_KEY (gitignored)>`.
3. Verified: `git ls-files | xargs grep` finds **zero** real secrets in tracked files.

## What only the USER can finish (history cannot be fixed from here)
History was deliberately NOT rewritten: on Emergent, commits back the platform's
checkpoint/rollback system, so `filter-repo` / `filter-branch` / force-push would risk destroying
the user's ability to roll back. Therefore:

1. **Rotate the Supabase secret key** (Dashboard → Project Settings → API keys → revoke the
   leaked `sb_secret_…`, create a new one) and paste the new value so it can be written to
   `backend/.env`. The leaked string stays in history forever; rotating is what actually makes it
   harmless.
2. **Unblock the push.** When "Save to Github" fails, GitHub's error contains an "allow secret"
   URL per detection. The two `AIza` Google keys are client-side-by-design and safe to allow. Only
   allow the Supabase one *after* rotating it.

## Standing rules for every future session
- **NEVER** put a live key, token, PAT or password literal into any file under `memory/` (or any
  tracked file). Write `<read from backend/.env -> KEY_NAME>` instead. `backend/.env`,
  `frontend-next/.env.local` and `mobile/.env` are gitignored and are the only homes for real values.
- Before finishing a task that touched credentials, run:
  `git ls-files -z | xargs -0 grep -lIE "sbp_|sb_secret_|sk-proj-|sk_live_|rzp_live_|ghp_|AIza[0-9A-Za-z_-]{35}"`
  It must print nothing.
- Dumping a token to a scratch file for QA is fine, but put it in `/tmp`, never `memory/`.
