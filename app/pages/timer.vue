<template>
  <div class="container py-4 text-center">
    <h1 class="mb-3">타이머</h1>
    <div class="card p-4 mb-3">
      <p class="display-3 fw-bold font-monospace mb-3 text-primary">{{ formattedTime }}</p>
      <div class="d-flex gap-2 justify-content-center mb-3">
        <AppButton @click="start" v-if="!running">시작</AppButton>
        <AppButton @click="pause" v-else>일시정지</AppButton>
        <button class="btn btn-outline-secondary btn-sm" @click="reset">초기화</button>
        <AppButton @click="addLap" v-if="running">랩</AppButton>
      </div>
      <div class="d-flex gap-2 justify-content-center">
        <button class="btn btn-outline-secondary btn-sm" @click="setPreset(60)">1분</button>
        <button class="btn btn-outline-secondary btn-sm" @click="setPreset(180)">3분</button>
        <button class="btn btn-outline-secondary btn-sm" @click="setPreset(300)">5분</button>
        <button class="btn btn-outline-secondary btn-sm" @click="setPreset(600)">10분</button>
      </div>
    </div>
    <div v-if="laps.length > 0" class="card overflow-hidden mb-3">
      <div class="px-3 py-2 bg-canvas-soft border-bottom">
        <strong class="small">랩 기록</strong>
      </div>
      <ul class="list-unstyled mb-0">
        <li v-for="(lap, index) in laps" :key="index" class="d-flex justify-content-between px-3 py-2 border-bottom small">
          <span class="text-faint">#{{ laps.length - index }}</span>
          <span>{{ formatSeconds(lap) }}</span>
        </li>
      </ul>
    </div>
    <router-link to="/" class="small">← Home</router-link>
  </div>
</template>

<script>
export default {
  title: '타이머',
  data() {
    return {
      seconds: 0,
      running: false,
      intervalId: null,
      mode: 'stopwatch',
      preset: 0,
      laps: [],
      lastLapTime: 0,
    }
  },
  computed: {
    formattedTime() {
      return this.formatSeconds(this.mode === 'countdown' ? this.preset - this.seconds : this.seconds)
    }
  },
  methods: {
    formatSeconds(s) {
      const abs = Math.abs(Math.floor(s))
      const m = String(Math.floor(abs / 60)).padStart(2, '0')
      const sec = String(abs % 60).padStart(2, '0')
      return m + ':' + sec
    },
    start() {
      this.running = true
      this.intervalId = setInterval(() => {
        this.seconds++
        if (this.mode === 'countdown' && this.seconds >= this.preset) {
          this.pause()
        }
      }, 1000)
    },
    pause() {
      this.running = false
      clearInterval(this.intervalId)
    },
    reset() {
      this.pause()
      this.seconds = 0
      this.laps = []
      this.lastLapTime = 0
      this.mode = 'stopwatch'
      this.preset = 0
    },
    setPreset(sec) {
      this.reset()
      this.mode = 'countdown'
      this.preset = sec
    },
    addLap() {
      this.laps.unshift(this.seconds - this.lastLapTime)
      this.lastLapTime = this.seconds
    }
  },
  beforeUnmount() {
    clearInterval(this.intervalId)
  }
}
</script>
