set -euo pipefail
cd ~/LT_THEGLEANERS
git checkout main
git pull --ff-only                      # 서버 코드가 갈라져 있으면 멈춤 (덮어쓰지 않음)
dc() { docker compose -f docker-compose.prod.yml --env-file .env.production "$@"; }
# 이 스크립트는 ssh 'bash -s' 의 표준입력으로 들어온다. docker compose run 이 표준입력을 읽으면
# 남은 스크립트를 먹어 버려서 그 뒤 줄이 실행되지 않는다. -T 와 </dev/null 로 표준입력을 막는다.
task() { dc run --rm -T mcp npm run "$@" </dev/null; }
dc up -d --build </dev/null
task db:setup                           # 여러 번 실행해도 안전
# 추천과 표지 색에 쓰는 보조 데이터. 실패해도 배포는 계속한다 (다음 배포에서 이어서 채움)
task tags:backfill || echo "tags:backfill skipped"
task palettes:extract -- 400 || echo "palettes:extract skipped"
docker image prune -f                   # 빌드마다 쌓이는 이전 이미지 정리 (디스크 보호)
