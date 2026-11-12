<template>
  <div
    ref="rootRef"
    class="slideshow fixed inset-0 z-[60] bg-black overflow-hidden select-none"
    data-lenis-prevent
    :class="{ 'cursor-none': !controlsVisible }"
    @mousemove="showControls"
    @click="togglePlay"
    @touchstart.passive="onTouchStart"
    @touchend="onTouchEnd"
  >
    <!-- 兩層輪流使用，做交叉淡入淡出 -->
    <div
      v-for="(layer, i) in layers"
      :key="i"
      :ref="(el) => (layerEls[i] = el as HTMLElement)"
      class="absolute inset-0 opacity-0"
    >
      <!-- 背景：同一張照片放大模糊，填滿畫面 -->
      <img
        v-if="layer.src"
        :src="layer.src"
        alt=""
        class="absolute inset-0 w-full h-full object-cover blur-2xl scale-110 brightness-[0.35]"
      />
      <!-- 前景：完整顯示，加上 Ken Burns 緩慢縮放平移 -->
      <img
        v-if="layer.src"
        :src="layer.src"
        :alt="layer.title"
        class="slide-main absolute inset-0 w-full h-full object-contain"
      />
    </div>

    <!-- 上方進度條：顯示距離下一張還有多久 -->
    <div class="absolute top-0 left-0 right-0 h-1 bg-white/10">
      <div ref="progressRef" class="h-full bg-white/70 origin-left scale-x-0"></div>
    </div>

    <!-- 控制列（滑鼠不動 2.5 秒後自動隱藏） -->
    <div
      ref="controlsRef"
      class="absolute bottom-0 left-0 right-0 p-4 md:p-6 bg-gradient-to-t from-black/70 to-transparent text-white flex items-end justify-between gap-4"
      @click.stop
    >
      <div class="min-w-0">
        <p class="font-semibold truncate">{{ current?.title }}</p>
        <p class="text-sm text-white/70">
          {{ current ? formatDate(current.dateTaken) : "" }}
          <span class="ml-2">{{ index + 1 }} / {{ photos.length }}{{ hasMore ? "+" : "" }}</span>
        </p>
      </div>
      <div class="flex items-center gap-2 shrink-0">
        <button class="ss-btn" title="上一張（←）" @click="go(-1)">‹</button>
        <button class="ss-btn" :title="playing ? '暫停（空白鍵）' : '播放（空白鍵）'" @click="togglePlay">
          {{ playing ? "❚❚" : "▶" }}
        </button>
        <button class="ss-btn" title="下一張（→）" @click="go(1)">›</button>
        <button class="ss-btn" title="關閉（Esc）" @click="close">✕</button>
      </div>
    </div>

    <!-- 暫停時中間顯示提示 -->
    <div
      v-if="!playing"
      class="absolute inset-0 flex items-center justify-center pointer-events-none"
    >
      <span class="text-white/80 text-6xl drop-shadow">❚❚</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted, onBeforeUnmount, nextTick } from "vue";
import gsap from "gsap";
import { formatDate, type Photo } from "../services/flickr";
import { lockScroll, unlockScroll } from "../animation/smoothScroll";

const props = defineProps<{
  photos: Photo[];
  start: number;
  hasMore: boolean;
  loadMore: () => Promise<void>;
}>();
const emit = defineEmits<{ (e: "close", index: number): void }>();

const SLIDE_SECONDS = 5; // 每張停留秒數
const FADE_SECONDS = 1.2; // 交叉淡入淡出秒數

const rootRef = ref<HTMLElement>();
const progressRef = ref<HTMLElement>();
const controlsRef = ref<HTMLElement>();
const layerEls: HTMLElement[] = [];
const layers = reactive([
  { src: "", title: "" },
  { src: "", title: "" },
]);
let active = 1; // 目前顯示的是哪一層
const index = ref(props.start);
const playing = ref(true);
const controlsVisible = ref(true);
const current = computed(() => props.photos[index.value]);
const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

let timer: gsap.core.Tween | null = null; // 倒數到下一張
let kenBurns: gsap.core.Tween | null = null;
let switching = false;

const preload = (url: string) =>
  new Promise<void>((resolve) => {
    const img = new Image();
    img.onload = img.onerror = () => resolve();
    img.src = url;
  });

// 隨機選一種緩慢縮放 + 平移，讓每張的動態不一樣
const randomKenBurns = () => {
  const zoomIn = Math.random() > 0.5;
  const dx = gsap.utils.random(-3, 3);
  const dy = gsap.utils.random(-2, 2);
  return {
    from: { scale: zoomIn ? 1 : 1.12, xPercent: zoomIn ? 0 : dx, yPercent: zoomIn ? 0 : dy },
    to: { scale: zoomIn ? 1.12 : 1, xPercent: zoomIn ? dx : 0, yPercent: zoomIn ? dy : 0 },
  };
};

const startTimer = () => {
  timer?.kill();
  if (!progressRef.value) return;
  gsap.set(progressRef.value, { scaleX: 0 });
  timer = gsap.to(progressRef.value, {
    scaleX: 1,
    duration: SLIDE_SECONDS,
    ease: "none",
    paused: !playing.value,
    onComplete: () => {
      go(1);
    },
  });
};

const show = async (i: number, direction = 1) => {
  const photo = props.photos[i];
  if (!photo) return;
  switching = true;
  index.value = i;
  await preload(photo.largeUrl);
  if (index.value !== i) {
    switching = false; // 等待期間又切換了
    return;
  }

  const next = 1 - active;
  layers[next].src = photo.largeUrl;
  layers[next].title = photo.title;
  await nextTick();
  const inEl = layerEls[next];
  const outEl = layerEls[active];
  const main = inEl.querySelector(".slide-main") as HTMLElement;

  kenBurns?.kill();
  gsap.killTweensOf([inEl, outEl]);
  if (reduceMotion) {
    gsap.set(inEl, { opacity: 1, zIndex: 2 });
    gsap.set(outEl, { opacity: 0, zIndex: 1 });
  } else {
    const kb = randomKenBurns();
    gsap.set(inEl, { zIndex: 2, opacity: 0, x: direction * 30 });
    gsap.set(outEl, { zIndex: 1 });
    gsap.to(inEl, { opacity: 1, x: 0, duration: FADE_SECONDS, ease: "power2.out" });
    gsap.to(outEl, { opacity: 0, duration: FADE_SECONDS, ease: "power2.in" });
    kenBurns = gsap.fromTo(main, kb.from, {
      ...kb.to,
      duration: SLIDE_SECONDS + FADE_SECONDS,
      ease: "none",
      paused: !playing.value,
    });
  }
  active = next;
  switching = false;
  startTimer();

  // 預先載入下一張
  const upcoming = props.photos[i + 1];
  if (upcoming) preload(upcoming.largeUrl);
};

// 幻燈片只播照片，遇到影片就跳過
const isPhoto = (i: number) => props.photos[i] && props.photos[i].media !== "video";

const go = async (dir: number) => {
  if (switching) return;
  let target = index.value;
  for (let tries = 0; tries <= props.photos.length; tries++) {
    target += dir;
    if (target >= props.photos.length) {
      if (props.hasMore) await props.loadMore();
      if (target >= props.photos.length) target = 0; // 播完從頭開始
    }
    if (target < 0) target = props.photos.length - 1;
    if (isPhoto(target)) return show(target, dir);
  }
};

const togglePlay = () => {
  playing.value = !playing.value;
  if (playing.value) {
    timer?.resume();
    kenBurns?.resume();
  } else {
    timer?.pause();
    kenBurns?.pause();
  }
  showControls();
};

// 控制列：滑鼠移動就顯示，2.5 秒沒動就隱藏
let hideCall: gsap.core.Tween | null = null;
const showControls = () => {
  controlsVisible.value = true;
  gsap.to(controlsRef.value!, { autoAlpha: 1, duration: 0.3 });
  hideCall?.kill();
  hideCall = gsap.delayedCall(2.5, () => {
    if (!playing.value) return;
    controlsVisible.value = false;
    gsap.to(controlsRef.value!, { autoAlpha: 0, duration: 0.6 });
  });
};

const close = () => {
  if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
  gsap.to(rootRef.value!, {
    opacity: 0,
    duration: reduceMotion ? 0 : 0.4,
    onComplete: () => emit("close", index.value),
  });
};

const onKey = (e: KeyboardEvent) => {
  if (e.key === "Escape") close();
  else if (e.key === "ArrowRight") go(1);
  else if (e.key === "ArrowLeft") go(-1);
  else if (e.key === " ") {
    e.preventDefault();
    togglePlay();
  } else return;
  e.stopImmediatePropagation();
};

// 手機左右滑動切換
let touchX = 0;
const onTouchStart = (e: TouchEvent) => (touchX = e.touches[0].clientX);
const onTouchEnd = (e: TouchEvent) => {
  const dx = e.changedTouches[0].clientX - touchX;
  if (Math.abs(dx) > 50) {
    e.preventDefault(); // 避免同時觸發點擊暫停
    go(dx < 0 ? 1 : -1);
  }
};

// 全螢幕結束（例如使用者按 F11 / Esc）時不做事，保持幻燈片開著
onMounted(() => {
  window.addEventListener("keydown", onKey, true);
  lockScroll();
  rootRef.value?.requestFullscreen?.().catch(() => {});
  if (!reduceMotion) gsap.from(rootRef.value!, { opacity: 0, duration: 0.5 });
  showControls();
  // 起點是影片的話，往後找第一張照片
  let start = props.start;
  for (let i = 0; i < props.photos.length && !isPhoto(start); i++) {
    start = (start + 1) % props.photos.length;
  }
  show(start);
});

onBeforeUnmount(() => {
  window.removeEventListener("keydown", onKey, true);
  unlockScroll();
  timer?.kill();
  kenBurns?.kill();
  hideCall?.kill();
});
</script>

<style scoped>
.ss-btn {
  width: 2.75rem;
  height: 2.75rem;
  border-radius: 9999px;
  background: rgba(255, 255, 255, 0.12);
  font-size: 1.25rem;
  line-height: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.2s;
}
.ss-btn:hover {
  background: rgba(255, 255, 255, 0.3);
}
.slide-main {
  will-change: transform;
}
</style>
