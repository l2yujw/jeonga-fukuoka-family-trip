# Deployment Sequence

## Before code
- GitHub repo
- Supabase project
- production data TODO 확인

## After code exists
1. local `.env.local`
2. local dev
3. GitHub feature branch
4. Vercel project connect
5. Preview deploy
6. iPhone real-device test
7. main merge
8. Production deploy

## Production Env
- NEXT_PUBLIC_SUPABASE_URL
- NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
- server-only secret only if claim endpoint needs privileged operation
- invite token/server secret policy

## Rollback
- Vercel previous deployment promote/rollback
- DB migration은 destructive change 금지
- 행사 직전 schema 변경 금지
