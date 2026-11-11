# vue-zero vs Nuxt 4 (CSR) 벤치마크

vue-zero(런타임 SFC 컴파일, 제로빌드)와 Nuxt 4(`ssr:false` 정적 산출물)를 **같은 .vue 소스**로 비교한다.
결과 해석은 [RESULTS.md](./RESULTS.md), 원시 데이터는 `results/`.

## 구성

| 경로 | 역할 |
|---|---|
| `gen/gen-apps.mjs` | 시드 고정 생성기. 규모 S(10페이지/10컴포넌트) · M(50/100) · L(150/300) 의 vue-zero 앱과 Nuxt 소스를 같은 .vue 로 `apps/<규모>/{vz,nuxt}` 에 생성 |
| `nuxt-app/` | Nuxt 4 프로젝트(package.json/nuxt.config.ts, pnpm 독립 워크스페이스). `node_modules` 는 커밋 안 함 |
| `scripts/build-nuxt.mjs` | 생성된 Nuxt 소스 복사 → `nuxt generate` → `build/nuxt-<규모>` |
| `server.mjs` | 정적 서버(Cloudflare Workers 정적 자산 모사: ETag·must-revalidate, `/_nuxt/*` immutable, brotli/gzip, 기본 HTTP/2) |
| `run.mjs` | Playwright(Chromium) 러너. 변형×규모×프로필×반복, 변형 순서 회전(인터리브) |
| `summarize.mjs` | raw jsonl → `*.summary.json`(중앙값/p90/min/max) + `*.tables.md`(승패표) |
| `toolchain.mjs` | 설치·generate·dev 서버 기동·산출물 크기·파일 수 |
| `budget.mjs` / `budget.json` | 예산 게이트(`pnpm bench:budget`) |
| `scripts/make-cert.sh`, `scripts/wait-quiet.sh` | 자체서명 인증서 생성 / 한가해질 때까지 대기 |

## 실행

```bash
# 0) 의존성: 라이브러리 루트에서 pnpm install (vue, vue-router, playwright) 후 pnpm build(dist/vue-zero.js)
cd bench/nuxt-app && pnpm install && cd ../..         # Nuxt 4 설치 (pnpm 전용)
node bench/gen/gen-apps.mjs                           # S/M/L 생성
node bench/scripts/build-nuxt.mjs                     # Nuxt 산출물 생성
./bench/scripts/wait-quiet.sh 2 30                    # (선택) load average 가 내려갈 때까지 대기
node bench/run.mjs --out results/raw-main.jsonl       # 본 측정 (기본: 3변형×3규모×3프로필×7회)
node bench/summarize.mjs results/raw-main.jsonl       # 요약/승패표
node bench/toolchain.mjs                              # 툴체인 비용
pnpm bench:budget                                     # 예산 게이트 (Phase 2)
```

러너 옵션: `--sizes S,M --profiles 1,3 --reps 3 --variants vz,nuxt --h1`(HTTP/1.1 평문) `--port`.

## 프로필 / 변형

- 프로필 P1=제한 없음, P2=브로드밴드(RTT 40ms, 10Mbps), P3=느린 4G + 중저사양 모바일(RTT 150ms, 1.6Mbps, CPU 4x).
- 변형 `vz`(해시 없음 → ETag/304 재검증), `vz-immutable`(**상한 시뮬레이션**: 모든 정적 파일 immutable — scan 이 파일 해시를 URL 에 넣었을 때의 이득 상한 추정, 실제 구현 아님), `nuxt`.
- 세션 1회 = 새 컨텍스트(콜드) → 콜드 로드 → SPA 이동(첫/재방문/20연속) → 메모리(GC 후) → 같은 컨텍스트 새 탭에서 웜 로드.

## CI 연결 제안 (워크플로는 수정하지 않았다)

`.github/workflows/ci.yml` 에 잡을 추가하는 안: `pnpm install` → `pnpm build` → `pnpm exec playwright install chromium` → `pnpm bench:budget`.
하드 게이트는 요청 수·바이트·중복 여부 같은 결정적 지표이므로 러너 성능과 무관하게 안정적이다. 시간 지표는 경고만 출력한다.
