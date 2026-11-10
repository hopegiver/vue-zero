# 리뷰 보고서 — vue-zero 릴리스 게이트 (target_id: vue-zero-release-gate)

- 일자: 2026-11-11 / 등급: Sensitive (배포 — 공개 npm 자동 publish) / 최초 리뷰, 풀패널(4명, 발산형 1명 포함)
- 대상: `/Users/hopegiver/workspace/vue-zero/package` 커밋 5e17579..6b8f772 (`git diff 125195a..HEAD`, 94 files)
- 기준: 사용자 승인 설계 spec.md 단계 3 (위임 메시지 요약본 기준 대조)
- 실행한 것: 로컬 클론(scratchpad)에서 verify-static·verify-e2e·E2E 변이 테스트·반복 실행. **원격 동작/커밋/푸시/publish 없음. 저장소 파일 수정 없음(이 보고서 1개만 생성, 미커밋).**

## 종합 판정: 🟡 Amber

Critical 없음. 게이트의 기본 골격(needs 의존, 권한 분리, 스크립트 인젝션 회피, tarball 기준 E2E)은 맞고 실측으로 동작이 확인됐다. 다만 **"E2E로 검증한 바이트 = publish한 바이트"가 publish 이전에 보장되지 않고**(사후 검증만 있음), **게이트 정의 자체가 태그 커밋의 workflow 파일에 있어 쓰기 권한자가 게이트를 우회할 수 있으며**, **OIDC 권한 잡에서 고정되지 않은 코드를 실행**한다 — 1.3.1 첫 실가동 전에 Major 3건 조치를 권고한다.

## 페르소나 재사용 판정

| 페르소나 | 재사용/신규 | 사유 |
|---|---|---|
| P1 공급망·CI 보안 감사자 | 신규 | `docs/reviewer/personas/INDEX.md` 없음(최초 라운드) |
| P2 릴리스 엔지니어(재현성·실패 모드) | 신규 | 인덱스 없음(최초 라운드) |
| P3 테스트 검증력 감사자 | 신규 | 인덱스 없음(최초 라운드) |
| P4 🔵 제로베이스 릴리스 설계자(발산형) | 신규 | 인덱스 없음(최초 라운드) |

**산출물 게이트 이탈(정직 보고):** 위임 조건이 "리뷰 보고서 1개 작성만 허용"이라 `docs/reviewer/personas/persona-*.md` 4개와 `INDEX.md`는 만들지 않고, 페르소나 6대 요소를 아래 부록 A에 수록했다. PM이 허용하면 부록을 그대로 파일로 분리하면 된다.

## 실측 근거 (claimed ≠ verified)

| # | 확인 내용 | 방법 | 결과 |
|---|---|---|---|
| E1 | verify-static 정상/불일치 | 클론에서 `--tag v1.3.0` / `v1.3.1` / `v1.3.0-rc.1` | exit 0 / 1(버전 불일치) / 1(형식) — 실패 시 비0 종료 확인 |
| E2 | npm pack 목록 | verify-static 결과 | `LICENSE, README.md, dist/vue-zero.js, package.json` 4개뿐 — **test/·scripts/ 유출 없음** |
| E3 | 새 클론(stress 생성물 없음)에서 CI 모드 verify-e2e | `CI=1 node scripts/verify-e2e.mjs` | 80 pass + 1 skip, exit 0 |
| E4 | VUEZERO_DIST가 실제로 서빙 파일을 바꾸는가 | v1.2.0 dist(91ef704), v1.2.1 dist(125195a~1)로 교체 실행 | 각각 18건/15건 실패(지연 로딩·base64url 회귀 테스트가 정확히 실패). 존재하지 않는 경로 → webServer 기동 실패로 비0 |
| E5 | flaky | `CI=1 --repeat-each=5`(워커 3) | 400 pass / 5 skip / 0 fail |
| E6 | fixme(빠른 연속 이동) 재현 | `VZ_RUN_FIXME=1 --repeat-each=5` | 5/5 실패, 매번 4개 soft 단언 모두 실패 → 결정적 재현 |
| E7 | CHANGELOG 사실 | `git show` 125195a/406f99b/91ef704/cc1a056, src grep | 아래 P3 참조 — 불일치 없음 |

## 지적 사항

| ID | 심각도 | 위치 | 문제 | 수정 제안 | 확인방법 |
|---|---|---|---|---|---|
| RV-001 | 🟠 Major | `.github/workflows/publish.yml:107-111` | publish 잡이 `pnpm install` + `pnpm run build`로 **다시 빌드한 dist를 publish**한다. E2E는 커밋된 dist의 tarball(verify-e2e.mjs:17)을, verify-static은 다른 러너의 재빌드==커밋본을 검증했을 뿐, publish 러너의 재빌드 결과가 검증본과 같은지는 **publish 전에 아무도 확인하지 않는다**. 동일성은 post-publish(verify-published.mjs:56-59)에서 사후에만 확인되며, 그 시점엔 npm 게시가 비가역이다(unpublish 72h 제약). | (a) 최소안: build 직후 `git diff --exit-code -- dist/` 스텝 추가. (b) 권장: publish 잡에서 install/build를 제거하고 커밋된 dist를 그대로 게시. (c) 최선: RV-R1 — tarball 1회 생성 → 아티팩트 → E2E와 publish가 같은 tarball 사용(`npm publish ./x.tgz --provenance`) + sha256 대조. | workflow·scripts 정독, E1/E3 |
| RV-002 | 🟠 Major | `publish.yml:4-7, 84-90` (+ 저장소 설정, 코드 밖) | 게이트(`needs`)가 **태그가 가리키는 커밋의 workflow 파일**에 정의된다. 쓰기 권한자가 `needs`를 지운 publish.yml을 가진 커밋(어느 브랜치든)에 `v*` 태그를 push하면 검증 없이 provenance까지 붙어 게시된다. npm Trusted Publisher는 저장소+workflow 파일명만 묶고 내용은 묶지 않는다. 또한 태그 커밋이 main에 포함됐는지 확인하지 않는다(verify-static.mjs 전체에 해당 검사 없음). | ① GitHub Environment(`npm-publish`)를 publish 잡에 지정하고 required reviewer + 배포 태그 규칙(`v*`) 설정, npm Trusted Publisher를 그 environment에 바인딩 ② 태그 ruleset으로 `v*` 생성 권한 제한 ③ verify-static에 `git merge-base --is-ancestor HEAD origin/main` 검사(checkout `fetch-depth: 0` 필요). ①이 사람 승인 지점도 겸한다. | workflow 정독. 저장소 설정(ruleset/environment) 현황은 **원격 조회 금지로 미확인** |
| RV-003 | 🟠 Major | `publish.yml:104-107` | `id-token: write`를 가진 잡에서 `npm install -g npm@latest`(버전 무고정)와 `pnpm install`(devDeps 전체 + esbuild postinstall, `pnpm-workspace.yaml` allowBuilds)를 실행한다. 레지스트리의 npm 최신판이나 devDep 하나가 오염되면 OIDC 토큰으로 임의 게시가 가능하다. | npm 버전 고정(`npm@11.x.y`, Trusted Publishing 요구 최소 버전 이상으로 명시). RV-001 (b)/(c)를 택하면 publish 잡의 `pnpm install` 자체가 사라져 노출면이 함께 없어진다. | workflow 정독 |
| RV-004 | 🟡 Minor | `publish.yml:12-14` | concurrency 그룹이 `github.ref`별이라 v1.3.1·v1.3.2 태그가 동시에 돌 수 있다. 늦게 끝난 쪽이 `latest` dist-tag를 가져가 낮은 버전이 latest가 될 수 있다. | 그룹을 고정 문자열 `publish`로. | 정독 |
| RV-005 | 🟡 Minor | `publish.yml:111, 147` | 재실행 비멱등. publish 성공 후 "Re-run all jobs"를 하면 publish가 E403으로 실패해 post-publish·Release가 영원히 skip된다. Release 재실행 시 `gh release create`도 기존 릴리스와 충돌한다. | publish 앞에 `npm view name@ver` 확인 후 이미 있으면 skip(또는 post-publish 검증으로 대체), Release는 `gh release view \|\| create`. CLAUDE.md에 "실패 시 Re-run failed jobs만" 런북 추가. | 정독 |
| RV-006 | 🟡 Minor | `verify-static.mjs:34-40` | `v1.3.0` 태그도 verify-static·E2E를 통과한다(E1). "1.3.0 태그 금지"가 관례로만 강제되고, 실수로 push하면 publish 단계에서야 실패한다. | verify-static에 "레지스트리에 해당 버전 미게시" 검사(`npm view`, 네트워크 실패 시 FAIL) 추가. | E1 |
| RV-007 | 🟡 Minor | `publish.yml:26,28,32,61,77,92…` | 서드파티 액션이 SHA가 아니라 태그(`@v4`)로 고정됨. `pnpm/action-setup`은 OIDC 잡에서 실행된다. | 최소 publish 잡의 액션은 커밋 SHA로 고정 + Dependabot. | 정독 |
| RV-008 | 🟡 Minor | `verify-static.mjs:16`, `package.json:21` | 로컬 `release:check`는 tag 기본값이 `v<package.json 버전>`이라 "태그==버전" 검사가 항상 통과(동어반복)하고, `build.js:23-26`이 `../template/app/assets/js/vue-zero.js`를 덮어쓰는 부수효과가 있다(클론 실행 시 상위에 `template/` 생성 확인). | release:check에서 `git describe --exact-match`로 실제 태그를 읽거나 "로컬은 태그 검사 생략"이라고 출력. 빌드 복사는 `VUEZERO_NO_COPY=1` 같은 스위치로 끌 수 있게(build.js는 이번 범위 밖이므로 후속). | 클론 실행 E1 |
| RV-009 | 🟡 Minor | `test/e2e/basic/components.spec.js:10-11,52-53`, `stress.spec.js:20-21` | "요청 0건" 같은 부정 단언을 `settle(5프레임)` 직후 확인한다. 요청이 그보다 늦게 나가면 거짓 통과한다(현재 구현에서는 렌더 전에 preload가 끝나므로 실제 위험은 낮음). | 부정 단언 전에 `page.waitForLoadState('networkidle')` 또는 관련 요청의 부재를 확인할 앵커를 추가. | 정독 |
| RV-010 | 🟡 Minor | `test/playwright.config.js:16` | `forbidOnly`는 있지만 skip/fixme 개수 상한이 없다. 이후 누가 `test.skip`을 붙여도 게이트는 초록이다. | verify-e2e에서 JSON reporter의 skipped 수가 허용 목록(현재 fixme 1건)을 넘으면 실패. | 정독 |
| RV-011 | 🟡 Minor | `CLAUDE.md:33-49` | 프로젝트 구조 트리에 `test/`, `scripts/`, `CHANGELOG.md`, `.github/workflows/publish.yml`이 없다(테스트 섹션에만 test/ 트리가 있음). "작업 트리가 클린해야 통과"(배포 3단계)는 실제로는 `verify-static.mjs:51`의 8개 경로만 검사한다. | 트리 보강, 문구를 "src·dist·메타 파일이 클린해야"로 정정. | 정독 |
| RV-012 | ⚪ Nit | `publish.yml:26` 등 | `actions/checkout` 기본 `persist-credentials: true`. publish/post-publish 잡에서는 불필요. | `persist-credentials: false`. | 정독 |

## 페르소나별 관점

### P1 공급망·CI 보안 감사자
- 스크립트 인젝션: `${{ }}`를 `run:`에 직접 넣은 곳이 없다. 태그명은 전부 `"$GITHUB_REF_NAME"` / `"${GITHUB_REF_NAME#v}"`로 따옴표 친 환경변수로 전달된다(publish.yml:40,126,142,147) — **안전**. `${{ env.* }}`·`hashFiles`만 표현식으로 쓴다.
- 권한: 워크플로 기본값 `contents: read`, `id-token: write`는 publish에만, `contents: write`는 github-release에만 있다 — **최소화 양호**.
- 지적: RV-002, RV-003, RV-007, RV-012.

### P2 릴리스 엔지니어
- 검증 사슬: E2E 대상 = 커밋된 dist(tarball) ← verify-static이 "재빌드 == 커밋본"을 증명 → publish는 **재빌드본**을 게시 → post-publish가 "게시본 == 커밋본"을 사후 확인. 사슬의 마지막 고리만 사후다(RV-001). esbuild·lockfile·Node 22가 고정이라 실제 불일치 확률은 낮지만, Sensitive 게이트가 "아마 같다"에 기대서는 안 된다.
- 부분 실패: publish 이후 post-publish가 실패하면 패키지는 이미 공개 상태이고 Release만 없다. 이 경우의 대응(deprecate/새 패치)에 대한 런북이 없다 → RV-005에 묶음.
- 지적: RV-001, RV-004, RV-005, RV-006, RV-008.

### P3 테스트 검증력 감사자
- 빈 깡통 여부: 변이 실행(E4)에서 과거 dist를 넣으면 지연 로딩 10건, base64url 3건, stress 5건이 정확히 실패한다 — **회귀 테스트가 실제로 물고 있다**. PROGRESS.md의 변이 주장과 일치한다.
- VUEZERO_DIST: `server.mjs:14,16`이 요청마다 해당 경로를 읽고, playwright webServer `env`로 전달된다(config:32). E4로 실효를 확인했다.
- flaky: 고정 sleep이 없다(`gate()`/`settle()`/`expect.poll`). 5회 반복에서 400/400 통과(E5).
- stress 300: 시간 기준 없이 요청 이름 집합과 횟수로만 판정하므로 결정적이다(stress.spec.js:6-55). 단 "300개 전부" 케이스는 v1.2.0(즉시 로딩) dist에서도 통과한다 — 이 케이스는 지연 로딩 회귀가 아니라 중복 없음·전부 렌더만 지킨다는 점을 알고 쓸 것(결함 아님).
- fixme 근거 타당: `src/vue-zero.ts:234-258`의 `beforeEach`는 `await loadSfc`/`await loadLayoutComponent` 이후 이동이 이미 대체됐는지 확인하지 않고 `currentLayout`·`switchPage`·`document.title`을 갱신한다. 테스트는 `gate()`로 A의 응답을 B 완료 뒤까지 결정적으로 붙잡고(routing.spec.js:137-142), 5/5 재현된다(E6). 주석의 원인 서술과 코드가 일치한다.
- CHANGELOG 사실 대조(E7): 1.3.0 — defineAsyncComponent(ComponentLoader.ts:43), 실패 메시지 문구(ComponentLoader.ts:97), 404/error 병렬(vue-zero.ts:86 Promise.all), 이전 시작 시 누락 로그(125195a 이전 ComponentLoader.ts:37) 모두 일치. 1.2.1 — 406f99b 메시지·TextDecoder(AuthGuard.ts:14) 일치. 1.2.0 — `isReady().catch`(vue-zero.ts:315), `script eval failed` throw로 변경(91ef704 diff: `return {}` 제거), 패키지명 변경이 91ef704에서 일어남(91ef704~1은 `vue-ai-first@1.1.3`) 일치. **게시일(UTC)과 "vue-ai-first는 1.1.3까지 게시"는 레지스트리 조회가 필요해 미확인**(커밋일과는 일치).
- 지적: RV-009, RV-010.

### P4 🔵 제로베이스 릴리스 설계자(발산형)
- **RV-R1 🔵 Rethink — "한 번 만들고, 그것을 승격한다" 구조로 재편.** 지금은 산출물이 세 번 만들어진다(verify-static 재빌드, verify-e2e pack, publish 재빌드). 대안:
  ```
  pack (1회): pnpm build → git diff --exit-code dist → npm pack → upload-artifact(tgz + sha256)
    ├─ verify-static (pack 결과 tgz 목록/버전/CHANGELOG)
    └─ verify-e2e    (같은 tgz를 풀어 E2E)
  publish [environment: npm-publish, 승인자 지정]: download-artifact → sha256 대조 → npm publish ./x.tgz --provenance   (install/build 없음)
  post-publish: 레지스트리 integrity == pack 단계 sha
  ```
  얻는 것: RV-001·RV-003이 구조적으로 사라지고, OIDC 잡에서 실행하는 코드가 npm CLI뿐이 된다. 잃는 것: 잡 1개와 아티팩트 업로드 시간(수 초 수준).
- 질문: 태그 push 한 번으로 사람 확인 없이 공개 레지스트리까지 가는 것이 이 패키지(CDN `unpkg.com/vue-zero-ai` 무버전 참조 사용자 존재 — README)의 위험에 맞는가? 무버전 CDN 사용자는 게시 즉시 영향을 받는다. RV-002 ①의 environment 승인은 보안과 이 질문을 함께 해결한다.

## 트레이드오프
- 완전 자동(현행) vs environment 승인(RV-002①): 승인 대기 1회가 늘지만, 1인 메인테이너 저장소에서 계정 탈취 시 피해 반경을 크게 줄인다. 권고는 승인 쪽이다. 단 spec이 "자동 publish"를 승인 설계로 명시했다면 사람 결정 사항이다.
- RV-001 최소안(a) vs 재편(c): (a)는 1줄 추가로 즉시 막을 수 있고, (c)는 구조 변경이다. 1.3.1 전에는 (a)+(RV-003 npm 고정), 이후 (c)로 가는 단계안을 권한다.

## 잘 된 점
- `needs: [verify-static, verify-e2e]` → publish → post-publish → release의 직선 의존. 어느 검증이 실패해도 publish는 실행되지 않는다(`if: always()` 같은 우회 조건 없음).
- verify-static이 모든 검사를 끝까지 실행하고 실패 건수를 모아 비0으로 종료한다. 빌드 전에 `git show HEAD:dist`로 커밋본을 확보해 비교 대상 오염을 막았다(verify-static.mjs:48-54).
- E2E가 저장소 파일이 아니라 **npm pack tarball 안의 dist**를 대상으로 한다(spec 요구 충족, E4로 실효 확인).
- 셸 인젝션 방지(환경변수 + 따옴표)와 잡별 권한 분리가 교과서적이다.
- 테스트가 고정 sleep 없이 게이트/폴링으로 작성됐고, 회귀 테스트가 커밋 해시를 근거로 달았으며 변이로 검증력이 확인된다.
- CHANGELOG가 git·src와 사실상 일치하고, 1.3.0 provenance 부재와 태그 미생성 사유를 상단에 정직하게 적었다.
- npm tarball이 정확히 4개 파일 — test/·scripts/·CHANGELOG 유출 없음(`files` 화이트리스트 + 게이트 검사로 이중 방어).

## 기각된 지적
- "stress.spec.js:7이 모듈 로드 시 `components.json`을 읽으므로, 새 체크아웃(생성물이 gitignore됨)에서는 webServer의 gen-stress보다 먼저 로드되어 ENOENT가 난다" → **기각.** 새 클론에서 `CI=1 verify-e2e`가 80 pass로 통과했다(E3). Playwright는 webServer를 기동한 뒤 워커에서 spec을 로드한다.
- "fixme 테스트가 타이밍 의존이라 재현 근거가 약하다" → **기각.** `gate()`로 응답을 수동으로 붙잡고, 5/5 결정적으로 실패하며, src 코드 경로와 일치한다(E6, P3).
- "verify-published의 integrity split('-')이 base64의 '-'에서 깨진다" → **기각.** SRI는 표준 base64(+,/)를 쓰므로 '-'가 나오지 않는다.

## 생략/미확인
- GitHub 저장소 설정(태그 ruleset, environment, branch protection)과 npm Trusted Publisher 바인딩 대상: 원격 조회 금지로 **미확인**. RV-002의 실제 위험도는 이 설정에 따라 내려갈 수 있다.
- 실제 GitHub Actions 러너 실행: 미실행(로컬 macOS + pnpm 12.3.4로 대체, CI는 pnpm 10.26.0/ubuntu). Playwright `--with-deps` 설치와 캐시 적중 동작은 미검증.
- spec.md 원문은 열지 않고 위임 메시지의 단계 3 요약을 기준으로 대조했다.
- 화면 리뷰: 대상이 아니다(UI 산출물 없음).

## PM 권고
1. 1.3.1 태그 전에 반드시: RV-001(a) `git diff --exit-code -- dist/` 추가 또는 publish 잡 재빌드 제거, RV-003 npm 버전 고정.
2. RV-002: environment 승인 + 태그 ruleset 적용 여부를 사람에게 확인(`AskUserQuestion`) — 설계 원안("자동")을 바꾸는 결정이다.
3. Minor는 한 묶음으로 qa-engineer/devops에 위임 가능. RV-R1 재편은 1.3.1 이후 별도 작업으로 둔다.
4. 수정 후 동일 target_id로 재검토 시 재검토 3요소(target_id·이 보고서 경로·리스크 범주 "배포")를 명시해 달라.

---

## 부록 A — 페르소나 정의 (6대 요소)

**P1 공급망·CI 보안 감사자** — 정체성: OIDC/Trusted Publishing 게시 파이프라인을 감사하는 보안 엔지니어. 관심사: 게이트 우회, 권한 과다, 인젝션, 고정되지 않은 의존. 평가기준: 검증 실패 시 publish 불가, 쓰기 권한자 단독 우회 불가, 권한 잡에서 실행되는 코드 최소화. 방법론: workflow 잡별 권한·트리거·표현식 정독, `${{ }}` 셸 삽입 grep, 신뢰 경계 표시. 참고파일: publish.yml, scripts/*.mjs, pnpm-workspace.yaml. 출력: RV 표(심각도·파일:라인·수정안).

**P2 릴리스 엔지니어(재현성·실패 모드)** — 정체성: npm 라이브러리 릴리스 운영 담당. 관심사: 검증본=게시본, 재실행·부분 실패, dist-tag, 로컬/CI 동등성. 평가기준: 비가역 단계 이전에 동일성 보장, 재실행 시 상태 수렴. 방법론: 잡 사슬별 "무엇을 무엇과 비교하는가" 표 작성, 클론에서 스크립트 실행. 참고파일: publish.yml, verify-*.mjs, build.js, package.json, CLAUDE.md. 출력: RV 표 + 실패 시나리오.

**P3 테스트 검증력 감사자** — 정체성: E2E 스위트의 실효를 의심하는 QA 리드. 관심사: 빈 깡통 단언, 주입 경로 실효, flaky, 문서 사실성. 평가기준: 과거 결함 dist에서 실패해야 함, 반복 실행 무결, 문서 주장 = git/src. 방법론: VUEZERO_DIST 변이 실행, `--repeat-each`, fixme 재현 반복, `git show` 대조. 참고파일: test/**, CHANGELOG.md, src/**. 출력: 실측표(E#) + RV 표.

**P4 제로베이스 릴리스 설계자(발산형)** — 정체성: 현 구조를 전제로 두지 않고 처음부터 설계하는 아키텍트. 관심사: 구조가 애초에 옳은가(산출물 생성 횟수, 사람 승인 지점). 평가기준: 대안 구조가 지적 다수를 구조적으로 없애는가. 방법론: 산출물 흐름도 재작성, 득실 비교. 참고파일: publish.yml, README(CDN 사용 형태). 출력: 🔵 Rethink + 대안 구조 + 트레이드오프.
