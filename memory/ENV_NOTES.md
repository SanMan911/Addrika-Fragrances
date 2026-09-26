# Environment gotchas

## Frontend is a PRODUCTION Next build (no hot reload)
- `/app/frontend` is a symlink to `/app/frontend-next`.
- Supervisor runs `yarn start` = `next start` (production build), NOT `next dev`.
- Therefore ANY frontend code change requires:
  `cd /app/frontend && yarn build && sudo supervisorctl restart frontend`
- Symptom if forgotten: code looks correct but preview shows old behaviour
  (this caused a false "OOS UI broken" bug report in iteration 102).
