// 벤치 전용 최소 설정: CSR(SPA), 모듈 없음, 텔레메트리/데브툴 끔
export default defineNuxtConfig({
  compatibilityDate: '2026-01-01',
  ssr: false,
  devtools: { enabled: false },
  telemetry: false,
})
