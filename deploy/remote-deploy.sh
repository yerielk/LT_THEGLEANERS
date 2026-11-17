set -euo pipefail
cd ~/LT_THEGLEANERS
git checkout main
git pull --ff-only                      # 서버 코드가 갈라져 있으면 멈춤 (덮어쓰지 않음)
dc() { docker compose -f docker-compose.prod.yml --env-file .env.production "$@"; }
dc up -d --build
dc run --rm mcp npm run db:setup        # 여러 번 실행해도 안전
# 추천과 표지 색에 쓰는 보조 데이터. 실패해도 배포는 계속한다 (다음 배포에서 이어서 채움)
dc run --rm mcp npm run tags:backfill || echo "tags:backfill skipped"
dc run --rm mcp npm run palettes:extract -- 400 || echo "palettes:extract skipped"
docker image prune -f                   # 빌드마다 쌓이는 이전 이미지 정리 (디스크 보호)
