<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import TerminalWorkspace from './components/TerminalWorkspace.vue'

const appIcon = new URL('../../../resources/icon.png', import.meta.url).href
const defaultPrimaryColor = '#63e2b7'
const primaryColor = ref(defaultPrimaryColor)
const showSplash = ref(true)
let splashTimer: ReturnType<typeof setTimeout> | undefined

watch(
  primaryColor,
  (color) => {
    document.documentElement.style.setProperty('--terminal-active-color', color)
    document.documentElement.style.setProperty('--terminal-active-color-hover', color)
  },
  { immediate: true }
)

async function updatePrimaryColor(color: string): Promise<void> {
  primaryColor.value = color
  primaryColor.value = (await window.api.settings.setTheme({ primaryColor: color })).primaryColor
}

onMounted(async () => {
  splashTimer = setTimeout(() => {
    showSplash.value = false
  }, 1400)

  primaryColor.value = (await window.api.settings.getTheme()).primaryColor
})

onBeforeUnmount(() => clearTimeout(splashTimer))
</script>

<template>
  <div
    class="app-shell"
    :style="{
      '--terminal-active-color': primaryColor,
      '--terminal-active-color-hover': primaryColor
    }"
  >
    <TerminalWorkspace :primary-color="primaryColor" @update-primary-color="updatePrimaryColor" />

    <Transition name="splash">
      <div v-if="showSplash" class="splash-screen" aria-label="Terminus 正在启动">
        <div class="splash-glow" aria-hidden="true"></div>
        <div class="splash-icon-wrap">
          <div class="splash-orbit" aria-hidden="true"></div>
          <img class="splash-icon" :src="appIcon" alt="Terminus" />
        </div>
        <div class="splash-title">TERMINUS</div>
        <div class="splash-status">
          <span>INITIALIZING</span>
          <span class="splash-dots" aria-hidden="true"><i></i><i></i><i></i></span>
        </div>
        <div class="splash-progress" aria-hidden="true"><span></span></div>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.app-shell {
  position: relative;
  width: 100%;
  height: 100%;
}

.splash-screen {
  position: fixed;
  inset: 0;
  z-index: 10000;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  background: radial-gradient(circle at 50% 44%, rgba(99, 226, 183, 0.1), transparent 26%), #050706;
  color: rgba(255, 255, 255, 0.92);
}

.splash-screen::before {
  position: absolute;
  inset: 0;
  background-image:
    linear-gradient(rgba(99, 226, 183, 0.025) 1px, transparent 1px),
    linear-gradient(90deg, rgba(99, 226, 183, 0.025) 1px, transparent 1px);
  background-size: 36px 36px;
  content: '';
  mask-image: radial-gradient(circle at center, black, transparent 70%);
}

.splash-glow {
  position: absolute;
  width: 280px;
  height: 280px;
  border-radius: 50%;
  background: rgba(99, 226, 183, 0.12);
  filter: blur(70px);
  animation: splash-pulse 1.6s ease-in-out infinite;
}

.splash-icon-wrap {
  position: relative;
  display: grid;
  width: 132px;
  height: 132px;
  place-items: center;
  animation: splash-rise 600ms cubic-bezier(0.16, 1, 0.3, 1) both;
}

.splash-orbit {
  position: absolute;
  inset: 0;
  border: 1px solid rgba(99, 226, 183, 0.25);
  border-top-color: var(--terminal-active-color, #63e2b7);
  border-radius: 50%;
  animation: splash-spin 1.8s linear infinite;
}

.splash-orbit::after {
  position: absolute;
  top: 8px;
  right: 17px;
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: var(--terminal-active-color, #63e2b7);
  box-shadow: 0 0 12px var(--terminal-active-color, #63e2b7);
  content: '';
}

.splash-icon {
  width: 92px;
  height: 92px;
  object-fit: contain;
  filter: drop-shadow(0 12px 32px rgba(0, 0, 0, 0.5));
}

.splash-title {
  z-index: 1;
  margin-top: 25px;
  font-size: 18px;
  font-weight: 600;
  letter-spacing: 0.42em;
  text-indent: 0.42em;
  animation: splash-rise 600ms 120ms cubic-bezier(0.16, 1, 0.3, 1) both;
}

.splash-status {
  z-index: 1;
  display: flex;
  align-items: center;
  height: 20px;
  margin-top: 8px;
  color: rgba(255, 255, 255, 0.38);
  font-family: ui-monospace, SFMono-Regular, Consolas, monospace;
  font-size: 9px;
  letter-spacing: 0.18em;
  animation: splash-rise 600ms 200ms cubic-bezier(0.16, 1, 0.3, 1) both;
}

.splash-dots {
  display: inline-flex;
  gap: 3px;
  margin-left: 7px;
}

.splash-dots i {
  width: 2px;
  height: 2px;
  border-radius: 50%;
  background: var(--terminal-active-color, #63e2b7);
  animation: splash-dot 900ms ease-in-out infinite;
}

.splash-dots i:nth-child(2) {
  animation-delay: 150ms;
}

.splash-dots i:nth-child(3) {
  animation-delay: 300ms;
}

.splash-progress {
  z-index: 1;
  width: 136px;
  height: 1px;
  margin-top: 14px;
  overflow: hidden;
  background: rgba(255, 255, 255, 0.08);
  animation: splash-rise 600ms 260ms cubic-bezier(0.16, 1, 0.3, 1) both;
}

.splash-progress span {
  display: block;
  width: 100%;
  height: 100%;
  background: var(--terminal-active-color, #63e2b7);
  box-shadow: 0 0 8px var(--terminal-active-color, #63e2b7);
  transform-origin: left;
  animation: splash-load 1.25s 180ms cubic-bezier(0.65, 0, 0.35, 1) both;
}

.splash-leave-active {
  transition:
    opacity 360ms ease,
    filter 360ms ease;
}

.splash-leave-to {
  opacity: 0;
  filter: blur(6px);
}

@keyframes splash-rise {
  from {
    opacity: 0;
    transform: translateY(14px) scale(0.96);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

@keyframes splash-spin {
  to {
    transform: rotate(360deg);
  }
}

@keyframes splash-pulse {
  50% {
    opacity: 0.55;
    transform: scale(1.12);
  }
}

@keyframes splash-dot {
  50% {
    opacity: 0.25;
    transform: translateY(-2px);
  }
}

@keyframes splash-load {
  from {
    transform: scaleX(0);
  }
  to {
    transform: scaleX(1);
  }
}

@media (prefers-reduced-motion: reduce) {
  .splash-glow,
  .splash-icon-wrap,
  .splash-orbit,
  .splash-title,
  .splash-status,
  .splash-dots i,
  .splash-progress,
  .splash-progress span {
    animation: none;
  }
}
</style>
