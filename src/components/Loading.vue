<template>
  <div
    v-if="isVisible"
    class="loading-container"
    :class="{ 'is-fading-out': isFadingOut }"
  >
    <!-- 背景獨立一層，角色放大淡出時背景同時淡掉 -->
    <div ref="bgRef" class="loading-bg"></div>

    <div ref="logoRef" class="logo-block">
      <!-- objectBoundingBox：路徑會自動縮放成跟 logo-block 一樣大 -->
      <svg width="0" height="0" class="absolute" aria-hidden="true">
        <clipPath id="logo-mask" clipPathUnits="objectBoundingBox">
          <path
            transform="scale(0.0098 0.0100)"
            d="M15.5646 20.831C22.9862 12.1409 34.3006 8.33902 39.0301 7.52432C42.9865 2.77193 47.0793 0.870977 51.1722 1.00676C55.265 1.14254 60.8585 2.90771 62.6321 7.52432C94.3924 15.3454 99.3311 44.6382 97.8304 58.307C98.7399 58.6238 100.641 59.8821 100.968 62.3805C101.296 64.8789 99.0128 65.8655 97.8304 66.0466C98.3306 69.7127 98.4307 77.1536 94.829 77.5881C91.2273 78.0226 88.5988 69.3506 87.7347 64.9603C87.5528 64.8698 86.8616 64.7431 85.5519 64.9603C84.1876 71.8852 77.0934 80.168 65.0878 83.0194C77.0934 88.9938 78.5941 97.2766 74.9106 98.0913C71.6363 98.743 66.0428 89.537 57.5843 84.3772H44.8965C40.6672 85.7351 27.1609 102.301 25.1145 97.2766C23.0681 92.2526 29.3438 86.6855 36.7108 83.0194C22.4132 79.5434 16.7469 68.898 15.701 64.0098C14.8824 63.9193 13.0816 63.9012 12.4267 64.553C9.28889 68.3549 9.56176 77.8597 4.92322 77.7239C0.284688 77.5881 0.557543 67.5402 2.33114 63.4667C0.421159 62.9236 0.421159 58.307 3.28611 57.0849C3.14968 47.1728 6.28752 31.6936 15.5646 20.831Z"
          />
        </clipPath>
      </svg>
      <!-- 角色輪廓（半透明），讓人看得出是什麼形狀 -->
      <span class="logo-silhouette"></span>
      <!-- 白色從底部往上填滿 -->
      <span ref="fillRef" class="logo-fill"></span>
    </div>

    <p ref="percentRef" class="loading-percent">{{ display }}%</p>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, onMounted, onBeforeUnmount } from "vue";
import gsap from "gsap";

const props = defineProps({
  progress: { type: Number, required: true },
  visible: { type: Boolean, required: true },
  // 載入畫面至少顯示多久（毫秒），太快的話填滿動畫會看不到
  minTime: { type: Number, default: 1200 },
  // 還沒載入完時，假進度最多跑到多少
  fakeProgress: { type: Number, default: 80 },
});
const emit = defineEmits<{ (e: "done"): void }>();

const isVisible = ref(props.visible);
const isFadingOut = ref(false);
const display = ref(0);
const bgRef = ref<HTMLElement>();
const logoRef = ref<HTMLElement>();
const fillRef = ref<HTMLElement>();
const percentRef = ref<HTMLElement>();

const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const state = { value: 0 }; // 目前顯示的進度 0~100
let progressTween: gsap.core.Tween | null = null;
let outro: gsap.core.Timeline | null = null;
let shownAt = 0;

// 進度 → 白色填滿高度（yPercent 100 = 完全在下面，0 = 填滿）
const render = () => {
  display.value = Math.round(state.value);
  if (fillRef.value) gsap.set(fillRef.value, { yPercent: 100 - state.value });
};

const goTo = (target: number, duration: number, ease = "power2.out") => {
  progressTween?.kill();
  progressTween = gsap.to(state, { value: target, duration, ease, onUpdate: render });
  return progressTween;
};

const start = () => {
  shownAt = Date.now();
  isFadingOut.value = false;
  state.value = 0;
  render();
  // 等待資料時先慢慢漲到 fakeProgress，畫面才不會停住
  goTo(Math.max(props.progress, props.fakeProgress), 2.5, "power1.out");
};

onMounted(() => {
  if (fillRef.value) gsap.set(fillRef.value, { yPercent: 100 });
  if (isVisible.value) start();
});

watch(
  () => props.progress,
  (p) => {
    if (!isFadingOut.value && p > state.value && p > props.fakeProgress) {
      goTo(p, 0.6);
    }
  }
);

watch(
  () => props.visible,
  (visible) => {
    if (visible) {
      outro?.kill();
      isVisible.value = true;
      requestAnimationFrame(start);
    } else {
      finish();
    }
  }
);

// 補滿 → 角色彈一下 → 適度放大淡出、背景淡掉 → 進入網站
const finish = () => {
  if (isFadingOut.value || !isVisible.value) return;
  isFadingOut.value = true;
  progressTween?.kill();

  const wait = Math.max(0, props.minTime - (Date.now() - shownAt)) / 1000;
  const fillDuration = reduceMotion ? 0 : 0.3 + ((100 - state.value) / 100) * 1.2;

  outro = gsap.timeline({
    delay: wait,
    onComplete: () => {
      isVisible.value = false;
      isFadingOut.value = false;
    },
  });
  outro.to(state, {
    value: 100,
    duration: fillDuration,
    ease: "power2.inOut",
    onUpdate: render,
  });

  if (reduceMotion) {
    outro.call(() => emit("done")).to(".loading-container", { opacity: 0, duration: 0.3 });
    return;
  }

  outro
    .to(percentRef.value!, { opacity: 0, y: 10, duration: 0.3 }, "+=0.15")
    .to(logoRef.value!, { scale: 1.1, duration: 0.25, ease: "power2.out" }, "<")
    // 適度放大並淡出，背景同時淡掉
    .to(logoRef.value!, { scale: 2.5, opacity: 0, duration: 0.8, ease: "power2.in" })
    .to(bgRef.value!, { opacity: 0, duration: 0.8, ease: "power1.inOut" }, "<0.1")
    // 淡出到一半就開始播首頁的進場動畫，兩段動畫銜接起來
    .call(() => emit("done"), [], "-=0.5");
};

onBeforeUnmount(() => {
  progressTween?.kill();
  outro?.kill();
});
</script>

<style scoped>
.loading-container {
  position: fixed;
  inset: 0;
  z-index: 1000;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}
.loading-container.is-fading-out {
  pointer-events: none;
}
.loading-bg {
  position: absolute;
  inset: 0;
  background: #40587c;
}
.logo-block {
  position: relative;
  width: 120px;
  height: 118px;
  overflow: hidden;
  clip-path: url("#logo-mask");
  -webkit-clip-path: url("#logo-mask");
  will-change: transform;
}
.logo-silhouette,
.logo-fill {
  position: absolute;
  inset: 0;
}
.logo-silhouette {
  background: rgba(255, 255, 255, 0.18);
}
/* 初始位置由 GSAP 設定（yPercent: 100）。
   不要在 CSS 寫 transform，GSAP 會把它當成額外位移，導致永遠填不滿 */
.logo-fill {
  background: #fff;
}
.loading-percent {
  position: relative;
  color: white;
  font-size: 16px;
  margin-top: 14px;
  font-weight: bold;
  font-variant-numeric: tabular-nums;
}
</style>
