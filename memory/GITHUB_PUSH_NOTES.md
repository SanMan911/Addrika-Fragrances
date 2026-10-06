# Secrets, git history and the GitHub push — RESOLVED 2026-06-06

## Status: history is CLEAN. The push is unblocked.
All provider secrets were purged from **every one of the 385 commits** with
`git filter-repo --replace-text`, plus the two live-token files were removed from history
entirely. Verified afterwards by scanning all **3,309 blobs** across all refs: zero matches for
any secret pattern, and zero matches for the ten known literal values.

> On the next **Save to Github**, choose **Force Push**. The remote still holds the old
> (secret-bearing) commits, so a normal push will be rejected as a non-fast-forward.

## What was found, and where

Audit method: enumerate every blob in `git rev-list --objects --all`, stream each through a
provider-pattern grep (`sbp_`, `sb_secret_`, `sk-`, `sk_live_`, `rzp_live_`, `re_…`, `ghp_`,
`github_pat_`, `AIza`, `ya29.`, `xox*`, `SG.`, `AKIA`, `sess_<32hex>`, raw JWTs).

| Secret | Lived in | Occurrences | Risk |
|---|---|---|---|
| Supabase **secret key** `sb_secret_…` | `memory/test_credentials.md` | 1 blob | **HIGH** — full DB/admin access |
| IDSPay API key (UUID form) | `memory/test_credentials.md` | 2 blobs | **HIGH** — paid KYB API |
| Admin session token `sess_2854…` | `test_reports/iteration_33.json` | 50 blobs | MEDIUM |
| Admin session token `sess_bd22…` | `memory/.admin_token` | 1 blob | MEDIUM |
| Supabase QA refresh token | `memory/.qa_refresh_token` | 1 blob | MEDIUM |
| Google Maps key `AIzaSyBFw0***` | `frontend-next/components/RetailerMap.js` (old versions only) | 3 blobs | LOW — Google's public demo key |
| Firebase web key `AIzaSyBO-S***` | `frontend/public/firebase-messaging-sw.js` (old versions only) | 2 blobs | LOW — client-side by design |

### The headline: application source code was NEVER the problem
Not one hardcoded credential exists in any `.py` / `.js` / `.jsx` / `.ts` / `.tsx` / `.json` /
`.yml` of the actual app. Every integration reads `os.environ` / `process.env`. `backend/.env`,
`frontend-next/.env.local` and `mobile/.env` are gitignored and were never committed.
**Every leak came from the agent's own notes and test-report files under `memory/` and
`test_reports/`.**

Naive greps throw false positives that look alarming but are not secrets: `re_festival_code_exists`
and `re_pickup_hybrid_verification` are Python test function names; `sk-round-bottom-outline` is a
CSS icon class. Patterns must be anchored with realistic length/charset bounds.

## What was done
1. `memory/.admin_token`, `memory/.qa_refresh_token` → `git rm --cached` + added to `.gitignore`.
2. All secret literals scrubbed from the working tree (`memory/*.md`), replaced with pointers like
   `<read it from backend/.env -> SUPABASE_SERVICE_KEY (gitignored)>`.
3. Full-history purge: `git filter-repo --replace-text <literals> --invert-paths
   --path memory/.admin_token --path memory/.qa_refresh_token --force`.
   All 385 commits preserved (messages, order, authorship); only the secret bytes changed, and
   leaked values now read `***REMOVED***`.
4. **Safety net kept**: a full pre-rewrite bundle of every ref lives at
   `/root/git-backup/aarohmm-history-<timestamp>.bundle` (49 MB), with the literal list at
   `/root/git-backup/replacements.txt`. Restore with
   `git clone /root/git-backup/aarohmm-history-*.bundle restored-repo`.
5. Verified after the rewrite: history clean, `backend/.env` untouched (filter-repo never touches
   untracked files), all services running, IDSPay still live, test suites 22/22 + 25/25.

### Note on commit SHAs
Rewriting history necessarily changes every commit SHA from the first affected commit onward.
Emergent's rollback checkpoints are tied to commits, so **older rollback points may no longer
resolve**. This was done at the user's explicit, repeated request; the bundle above is the escape
hatch. Emergent support has no documented guidance on this, so prefer prevention (below) over
ever repeating it.

## Standing rules — how to never need this again
- **NEVER** write a live key, token, PAT, password or session value into ANY tracked file. That
  includes everything under `memory/` and `test_reports/`, which feel like scratch space but are
  committed. Write `<read from backend/.env -> KEY_NAME>` instead.
- Scratch credentials belong in `/tmp` (ephemeral) or `/root` (persistent, untracked) — never `/app`.
- Pass secrets to commands inline (`export EXPO_TOKEN=... && cmd`), never by saving them to a file.
- Before finishing any task that touched credentials, this must print nothing:

```bash
cd /app && git ls-files -z | xargs -0 grep -nIaoE \
 "sbp_[A-Za-z0-9]{30,}|sb_secret_[A-Za-z0-9_-]{15,}|sk-proj-[A-Za-z0-9_-]{20,}|sk_(live|test)_[A-Za-z0-9]{20,}|rzp_(live|test)_[A-Za-z0-9]{10,}|ghp_[A-Za-z0-9]{36}|github_pat_[A-Za-z0-9_]{50,}|AIza[0-9A-Za-z_-]{35}|xox[baprs]-[A-Za-z0-9-]{20,}|AKIA[0-9A-Z]{16}|sess_[a-f0-9]{32}"
```

- `sb_publishable_…` / Supabase anon keys are **deliberately public** (they ship inside the mobile
  bundle and `mobile/app.json`). They are not secrets, must not be removed, and are not what blocks
  a push. Do not "fix" them.
