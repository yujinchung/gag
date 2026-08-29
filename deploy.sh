#!/usr/bin/env bash
# CLEAN ROOM 배포 — .env.local 채운 뒤 `bash deploy.sh` 한 번이면 끝납니다.
set -e

if [ ! -f .env.local ]; then
  echo "✗ .env.local 이 없습니다. cp .env.example .env.local 후 값 3개를 채우세요."
  exit 1
fi

for K in NEXT_PUBLIC_SUPABASE_URL NEXT_PUBLIC_SUPABASE_ANON_KEY ANTHROPIC_API_KEY; do
  grep -q "^$K=.\+" .env.local || { echo "✗ $K 가 비어 있습니다."; exit 1; }
done

command -v vercel >/dev/null || npm i -g vercel

echo "▸ 로그인 (브라우저가 열립니다)"
vercel whoami >/dev/null 2>&1 || vercel login

echo "▸ 프로젝트 연결"
vercel link --yes

echo "▸ 환경변수 등록"
while IFS='=' read -r K V; do
  case "$K" in
    NEXT_PUBLIC_SUPABASE_URL|NEXT_PUBLIC_SUPABASE_ANON_KEY|ANTHROPIC_API_KEY)
      for ENVN in production preview development; do
        printf '%s' "$V" | vercel env add "$K" "$ENVN" --force >/dev/null 2>&1 || true
      done
      echo "  ✓ $K"
      ;;
  esac
done < .env.local

echo "▸ 프로덕션 배포"
vercel --prod

echo ""
echo "완료. 지금 바로 확인하세요:"
echo "  1) 폰으로 배포 URL 열기 — 붉은 '설정 필요' 배너가 없어야 합니다"
echo "  2) /host 를 노트북에서 열어 빔 화면 확인"
echo "  3) 기기 2대로 같은 팟 코드 입장 → 대기실에 둘 다 보이면 실시간 성공"
