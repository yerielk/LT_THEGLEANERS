# 배포 가이드 (서버 1대)

EC2 또는 Lightsail 한 대에 `docker-compose.prod.yml`로 웹, MCP 서버, PostgreSQL, Caddy(HTTPS)를 함께 올린다.

```
인터넷 → Caddy :443 (인증서 자동 발급)
          ├─ /mcp*  → mcp:3333   (MCP 서버)
          └─ 그 외  → web:3000   (Next.js)
                       └─ postgres:5432 (외부에 열지 않음)
```

## 1. 서버 준비

- 인스턴스: Ubuntu 24.04, 메모리 2GB 이상(t4g.small 이상). 이미지 빌드에 메모리가 들어서 1GB면 스왑을 2GB 잡는다.
- 보안 그룹: 80, 443은 전체 허용. 22는 내 IP만.
- 탄력적 IP를 붙이고, 도메인의 A 레코드를 그 IP로 연결한다.
- Docker 설치: `curl -fsSL https://get.docker.com | sh`, 이후 `sudo usermod -aG docker $USER`로 권한을 주고 다시 로그인한다.

## 2. 카카오 설정

Kakao Developers → 내 애플리케이션에서 다음을 설정한다.

- 플랫폼 → Web: 사이트 도메인 `https://<도메인>`
- 카카오 로그인: 활성화, Redirect URI `https://<도메인>/api/auth/callback/kakao`
- 동의항목: 닉네임, 프로필 사진

## 3. `.env.production`

레포 루트에 만든다. `.env.*`는 git에 올라가지 않는다.

| 변수 | 값 |
| --- | --- |
| `DOMAIN` | `lecta.example.com` (스킴 없이) |
| `POSTGRES_PASSWORD` | `openssl rand -hex 24` |
| `BETTER_AUTH_URL` | `https://lecta.example.com` |
| `BETTER_AUTH_SECRET` | `openssl rand -hex 32` |
| `KAKAO_CLIENT_ID` | REST API 키 |
| `KAKAO_CLIENT_SECRET` | Client Secret을 켰을 때만 |
| `LECTA_ADMIN_USER_IDS` | Agent lab을 볼 사용자 id, 쉼표로 구분 (5단계) |

`DEMO_MODE`는 넣지 않는다. `BETTER_AUTH_URL`이 localhost가 아니면 웹 서버가 시작을 거부한다.

## 4. 실행

```bash
git clone https://github.com/yerielk/LT_THEGLEANERS.git && cd LT_THEGLEANERS
git checkout feat/auth-postgres
dc() { docker compose -f docker-compose.prod.yml --env-file .env.production "$@"; }

dc up -d --build                 # 빌드 후 실행
dc run --rm mcp npm run db:setup # 마이그레이션 + 카탈로그 seed (여러 번 실행해도 안전)
curl https://<도메인>/api/health # {"status":"ok", ...}
```

## 5. 관리자 지정

카카오로 한 번 로그인한 뒤 id를 확인해 `LECTA_ADMIN_USER_IDS`에 넣고 웹만 다시 띄운다.

```bash
dc exec postgres psql -U lecta -d lecta -c "select id, name, created_at from users order by created_at desc limit 5"
dc up -d web
```

## 6. 업데이트와 백업

```bash
git pull && dc up -d --build && dc run --rm mcp npm run db:setup
```

매일 백업(crontab 예시, 7일 보관):

```bash
0 4 * * * cd ~/LT_THEGLEANERS && docker compose -f docker-compose.prod.yml --env-file .env.production exec -T postgres pg_dump -U lecta lecta | gzip > ~/backups/lecta-$(date +\%F).sql.gz && find ~/backups -name 'lecta-*.sql.gz' -mtime +7 -delete
```

## 알아둘 점

- 요청 한도(rate limit)는 프로세스 메모리에 있다. 서버를 여러 대로 늘리면 Redis 같은 공유 저장소로 옮겨야 한다.
- 작품 이미지는 Wikimedia의 비자유 이미지를 직접 링크한다. 공개 서비스로 운영하기 전에 사용 근거를 확인한다.
- AI 앱은 `https://<도메인>/mcp`에 개인 MCP 키(`Authorization: Bearer`)로 연결한다. claude.ai 웹의 커스텀 커넥터는 OAuth를 요구할 수 있어 별도 확인이 필요하다.
