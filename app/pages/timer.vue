<template>
  <div class="page-timer">
    <h1>타이머</h1>
    <div class="timer-display">{{ formattedTime }}</div>
    <div class="timer-buttons">
      <AppButton @click="start" v-if="!running">시작</AppButton>
      <AppButton @click="pause" v-else>일시정지</AppButton>
      <AppButton @click="reset">초기화</AppButton>
      <AppButton @click="addLap" v-if="running">랩</AppButton>
    </div>
    <div class="presets">
      <span @click="setPreset(60)">1분</span>
      <span @click="setPreset(180)">3분</span>
      <span @click="setPreset(300)">5분</span>
      <span @click="setPreset(600)">10분</span>
    </div>
    <div v-if="laps.length > 0" class="laps">
      <h2>랩 기록</h2>
      <ul>
        <li v-for="(lap, index) in laps" :key="index">
          <span class="lap-num">#{{ laps.length - index }}</span>
          <span>{{ formatSeconds(lap) }}</span>
        </li>
      </ul>
    </div>
    <router-link to="/">← Home</router-link>
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

<style>
.page-timer { padding: 2rem; text-align: center; }
.page-timer h1 { color: #35495e; }
.timer-display { font-size: 4rem; font-weight: bold; color: #42b883; font-family: monospace; margin: 1rem 0; }
.timer-buttons { display: flex; gap: 0.5rem; justify-content: center; margin-bottom: 1rem; }
.presets { display: flex; gap: 0.5rem; justify-content: center; margin-bottom: 1.5rem; }
.presets span { cursor: pointer; padding: 0.25rem 0.75rem; border: 1px solid #ddd; border-radius: 4px; color: #888; }
.presets span:hover { border-color: #42b883; color: #42b883; }
.laps { text-align: left; max-width: 300px; margin: 0 auto 1rem; }
.laps h2 { font-size: 1rem; color: #35495e; }
.laps ul { padding: 0; }
.laps li { list-style: none; display: flex; justify-content: space-between; padding: 0.3rem 0; border-bottom: 1px solid #eee; }
.lap-num { color: #888; }
.page-timer a { color: #42b883; }
</style>
