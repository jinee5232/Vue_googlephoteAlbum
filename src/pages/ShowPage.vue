<template>
  <div class="show-page min-h-screen">
    <div class="show-page__inner">
      <div
        class="show-header flex flex-wrap items-center justify-between gap-3 mb-4 lg:w-4/5 lg:mx-auto"
      >
        <div class="flex items-center gap-3">
          <router-link to="/albums" class="show-back font-en">← Albums</router-link>
          <h1 class="show-title">{{ albumTitle || "相簿照片" }}</h1>
        </div>
        <div class="flex items-center gap-2">
        <button
          v-if="hasPhotos"
          @click="startSlideshow(0)"
          class="show-btn"
        >
          ▶ 幻燈片
        </button>
        <label
          v-if="isEditor"
          class="show-btn show-btn--dark cursor-pointer"
          :class="{ 'opacity-60': uploading }"
        >
          {{ uploading ? `上傳中 ${uploadDone} / ${uploadTotal}…` : "＋ 上傳照片／影片" }}
          <input
            type="file"
            accept="image/*,video/*,.heic,.heif,.mov"
            multiple
            class="hidden"
            :disabled="uploading"
            @change="handleUpload"
          />
        </label>
        </div>
      </div>

      <p v-if="errorMessage" class="text-center text-red-500">{{ errorMessage }}</p>

      <div v-else-if="mediaItems.length === 0 && !loading" class="text-center">
        <p>目前沒有照片。</p>
      </div>

      <!-- 瀑布流：照片依序放進最短的一欄，閱讀順序由左往右 -->
      <div v-else class="lg:w-4/5 lg:mx-auto masonry-container">
        <div
          v-for="(column, colIndex) in columns"
          :key="colIndex"
          class="masonry-column"
        >
        <div
          v-for="item in column"
          :key="item.id"
          class="relative group rounded-xl shadow hover:shadow-lg transition-shadow cursor-pointer masonry-item overflow-hidden bg-gray-200"
          :style="{ aspectRatio: `${item.width} / ${item.height}` }"
          :data-id="item.id"
          @click="openModal(item, $event)"
        >
          <button
            v-if="isEditor"
            @click.stop="handleRemove(item)"
            class="absolute z-10 top-2 right-2 w-8 h-8 rounded-full bg-black bg-opacity-60 text-white opacity-0 group-hover:opacity-100 hover:bg-red-600 transition"
            title="從相簿移除"
          >
            ✕
          </button>
          <span v-if="item.media === 'video'" class="video-badge" aria-label="影片">▶</span>
          <img
            :src="item.thumbUrl"
            :alt="item.title"
            loading="lazy"
            class="w-full h-full object-cover rounded-xl transition-transform duration-700 group-hover:scale-105"
          />
        </div>
        </div>
      </div>

      <!-- 只在此區域顯示 loading -->
      <div v-if="loading" class="text-center mt-4">
        <p>載入中...</p>
      </div>

      <!-- 捲到這裡就自動載入下一批 -->
      <div ref="sentinelRef" class="h-px"></div>

      <!-- 放大查看：照片從縮圖的位置放大到畫面中央（FLIP 動畫），可左右切換 -->
      <div
        v-if="current"
        class="fixed inset-0 z-50 flex items-center justify-center select-none"
        data-lenis-prevent
        @click="closeModal"
        @touchstart.passive="onTouchStart"
        @touchend="onTouchEnd"
      >
        <div ref="backdropRef" class="absolute inset-0 bg-black bg-opacity-90"></div>
        <div
          ref="modalImgRef"
          :style="modalSize"
          class="relative rounded-lg shadow-2xl overflow-hidden bg-black"
          @click.stop
        >
          <img :src="modalSrc" :alt="current.title" class="absolute inset-0 w-full h-full object-contain" />
          <!-- 影片：預覽圖先顯示（動畫用），拿到播放網址後疊上播放器 -->
          <video
            v-if="videoSrc"
            :src="videoSrc"
            :poster="current.largeUrl"
            class="absolute inset-0 w-full h-full bg-black"
            controls
            autoplay
            playsinline
            @touchstart.stop
            @touchend.stop
            @error="videoError = '無法播放這支影片，可能還在 Flickr 處理中，或 Flickr 不允許直接播放私密影片'"
          ></video>
          <div
            v-if="current.media === 'video' && (videoLoading || videoError)"
            class="absolute inset-0 flex items-center justify-center p-6 text-center text-white bg-black/50"
          >
            {{ videoError || "影片載入中…" }}
          </div>
        </div>

        <!-- 介面元素（一起淡入淡出） -->
        <div ref="chromeRef" class="absolute inset-0 pointer-events-none text-white">
          <p class="absolute top-5 left-5 text-sm text-white/70">
            {{ currentIndex + 1 }} / {{ mediaItems.length }}{{ hasMore ? "+" : "" }}
          </p>
          <div class="absolute top-4 right-4 flex gap-2 pointer-events-auto">
            <button v-if="hasPhotos" class="lb-btn" title="幻燈片" @click.stop="startSlideshow(currentIndex)">⧉</button>
            <button class="lb-btn" title="關閉（Esc）" @click.stop="closeModal">✕</button>
          </div>
          <button
            v-if="currentIndex > 0"
            class="lb-btn lb-nav left-2 md:left-6 pointer-events-auto"
            title="上一張（←）"
            @click.stop="go(-1)"
          >
            ‹
          </button>
          <button
            v-if="currentIndex < mediaItems.length - 1 || hasMore"
            class="lb-btn lb-nav right-2 md:right-6 pointer-events-auto"
            title="下一張（→）"
            @click.stop="go(1)"
          >
            ›
          </button>
          <div class="absolute bottom-4 left-0 right-0 text-center px-16">
            <p class="font-semibold truncate">{{ current.title }}</p>
            <p v-if="current.dateTaken" class="text-sm text-white/70">
              <span v-if="current.media === 'video'">影片 ・ </span>
              {{ formatDate(current.dateTaken) }}
            </p>
          </div>
        </div>
      </div>

      <SlideShow
        v-if="slideshowStart !== null"
        :photos="mediaItems"
        :start="slideshowStart"
        :has-more="hasMore"
        :load-more="loadMore"
        @close="onSlideshowClose"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount, watch, nextTick } from "vue";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useRoute } from "vue-router";
import SlideShow from "../components/SlideShow.vue";
import { lockScroll, unlockScroll } from "../animation/smoothScroll";
import {
  formatDate,
  getAlbumPhotos,
  getVideoUrl,
  uploadMany,
  removeFromAlbum,
  canEdit,
  type Photo,
} from "../services/flickr";

type MediaItem = Photo;

gsap.registerPlugin(ScrollTrigger);

const route = useRoute();
const albumId = route.params.albumId as string;
const mediaItems = ref<MediaItem[]>([]);
const loading = ref(false);
const hasMore = ref(false);
const albumTitle = ref("");
const isEditor = ref(false);
canEdit().then((v) => (isEditor.value = v));
const errorMessage = ref("");
let page = 0;

// ===================== GSAP 特效 =====================
const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const ctx = gsap.context(() => {});
onBeforeUnmount(() => ctx.revert());

// 標題進場
onMounted(() => {
  if (reduceMotion) return;
  ctx.add(() => {
    gsap.from(".show-header > *", {
      y: -20,
      opacity: 0,
      duration: 0.7,
      stagger: 0.1,
      ease: "power3.out",
    });
  });
});

// 新載入的照片：捲到時依序浮現（每張只播一次）
const revealNewPhotos = async () => {
  await nextTick();
  ctx.add(() => {
    const items = gsap.utils.toArray<HTMLElement>(".masonry-item:not([data-shown])");
    if (items.length === 0) return;
    items.forEach((el) => (el.dataset.shown = "1"));
    if (reduceMotion) return;

    gsap.set(items, { opacity: 0, y: 50, scale: 0.96 });
    ScrollTrigger.batch(items, {
      start: "top 95%",
      once: true,
      onEnter: (batch) =>
        gsap.to(batch, {
          opacity: 1,
          y: 0,
          scale: 1,
          duration: 0.8,
          stagger: 0.07,
          ease: "power3.out",
        }),
    });
    ScrollTrigger.refresh();
  });
};

// ---- 放大查看 ----
const currentIndex = ref(-1);
const current = computed(() => mediaItems.value[currentIndex.value] ?? null);
const modalSrc = ref("");
const backdropRef = ref<HTMLElement>();
const modalImgRef = ref<HTMLElement>();
const chromeRef = ref<HTMLElement>();
let sourceEl: HTMLElement | null = null; // 目前照片在格狀列表裡的元素
let closing = false;
let navigating = false;

const thumbEl = (id: string) =>
  document.querySelector<HTMLElement>(`.masonry-item[data-id="${id}"]`);

// 依照片長寬比算出放大後的尺寸（先知道尺寸，動畫才能從縮圖精準放大）
const modalSize = computed(() => {
  const item = current.value;
  if (!item) return {};
  const maxW = window.innerWidth * 0.86;
  const maxH = window.innerHeight * 0.78;
  const scale = Math.min(maxW / item.width, maxH / item.height);
  return { width: `${item.width * scale}px`, height: `${item.height * scale}px` };
});

// 算出「從放大位置回到縮圖位置」需要的位移與縮放
const deltaTo = (from: DOMRect, to: DOMRect) => ({
  x: to.left + to.width / 2 - (from.left + from.width / 2),
  y: to.top + to.height / 2 - (from.top + from.height / 2),
  scaleX: to.width / from.width,
  scaleY: to.height / from.height,
});

// ---- 影片 ----
const videoSrc = ref("");
const videoError = ref("");
const videoLoading = ref(false);
const hasPhotos = computed(() => mediaItems.value.some((p) => p.media !== "video"));

const loadVideo = async (item: MediaItem) => {
  videoSrc.value = "";
  videoError.value = "";
  if (item.media !== "video") return;
  videoLoading.value = true;
  try {
    const video = await getVideoUrl(item.id);
    if (current.value?.id === item.id) videoSrc.value = video.url;
  } catch (error) {
    if (current.value?.id === item.id) {
      videoError.value = error instanceof Error ? error.message : "取得影片失敗";
    }
  } finally {
    videoLoading.value = false;
  }
};

// 先顯示已載入的縮圖，大圖在背景載入好再換上；影片另外取得播放網址
const showPhoto = (item: MediaItem) => {
  loadVideo(item);
  modalSrc.value = item.thumbUrl;
  const large = new Image();
  large.onload = () => {
    if (current.value?.id === item.id) modalSrc.value = item.largeUrl;
  };
  large.src = item.largeUrl;
  // 順便預先載入前後兩張
  for (const n of [mediaItems.value[currentIndex.value + 1], mediaItems.value[currentIndex.value - 1]]) {
    if (n) new Image().src = n.largeUrl;
  }
};

const openModal = async (item: MediaItem, event: MouseEvent) => {
  sourceEl = event.currentTarget as HTMLElement;
  closing = false;
  currentIndex.value = mediaItems.value.findIndex((p) => p.id === item.id);
  showPhoto(item);
  lockScroll();
  await nextTick();

  const img = modalImgRef.value!;
  if (reduceMotion) return;
  const from = deltaTo(img.getBoundingClientRect(), sourceEl.getBoundingClientRect());
  gsap.set(sourceEl, { opacity: 0 });
  gsap.fromTo(
    img,
    { ...from, borderRadius: 12 },
    { x: 0, y: 0, scaleX: 1, scaleY: 1, borderRadius: 8, duration: 0.6, ease: "power3.inOut" }
  );
  gsap.fromTo(backdropRef.value!, { opacity: 0 }, { opacity: 1, duration: 0.5 });
  gsap.fromTo(chromeRef.value!, { opacity: 0 }, { opacity: 1, delay: 0.4, duration: 0.3 });
};

// 切換上一張 / 下一張：目前的往一邊滑出，新的從另一邊滑入
const go = async (dir: number) => {
  if (navigating || closing || !current.value) return;
  let target = currentIndex.value + dir;
  if (target >= mediaItems.value.length && hasMore.value) await loadMore();
  if (target < 0 || target >= mediaItems.value.length) return;
  navigating = true;

  const img = modalImgRef.value!;
  const swap = async () => {
    if (sourceEl) gsap.set(sourceEl, { opacity: 1 });
    currentIndex.value = target;
    showPhoto(mediaItems.value[target]);
    await nextTick();
    sourceEl = thumbEl(mediaItems.value[target].id);
    if (sourceEl) gsap.set(sourceEl, { opacity: 0 });
  };

  if (reduceMotion) {
    await swap();
    navigating = false;
    return;
  }
  gsap.to(img, {
    x: -dir * 80,
    opacity: 0,
    duration: 0.2,
    ease: "power2.in",
    onComplete: () => {
      swap().then(() => {
        gsap.fromTo(
          img,
          { x: dir * 80, opacity: 0 },
          {
            x: 0,
            opacity: 1,
            duration: 0.35,
            ease: "power3.out",
            onComplete: () => {
              navigating = false;
            },
          }
        );
      });
    },
  });
};

const finishClose = () => {
  if (sourceEl) gsap.set(sourceEl, { opacity: 1 });
  currentIndex.value = -1;
  unlockScroll();
  closing = false;
  navigating = false;
};

const closeModal = () => {
  if (!current.value || closing) return;
  closing = true;
  const img = modalImgRef.value;
  // 縮圖可能已經捲出畫面，那就直接淡出
  const target = sourceEl?.getBoundingClientRect();
  const visible = target && target.bottom > 0 && target.top < window.innerHeight;
  if (reduceMotion || !img || !visible) {
    gsap.to([img, backdropRef.value, chromeRef.value], {
      opacity: 0,
      duration: reduceMotion ? 0 : 0.3,
      onComplete: finishClose,
    });
    return;
  }
  gsap.to(chromeRef.value!, { opacity: 0, duration: 0.15 });
  gsap.to(backdropRef.value!, { opacity: 0, duration: 0.45 });
  gsap.to(img, {
    ...deltaTo(img.getBoundingClientRect(), target!),
    opacity: 1,
    duration: 0.5,
    ease: "power3.inOut",
    onComplete: finishClose,
  });
};

// 手機左右滑動切換
let touchX = 0;
const onTouchStart = (e: TouchEvent) => (touchX = e.touches[0].clientX);
const onTouchEnd = (e: TouchEvent) => {
  const dx = e.changedTouches[0].clientX - touchX;
  if (Math.abs(dx) > 50) {
    e.preventDefault(); // 避免滑動後又觸發點擊關閉
    go(dx < 0 ? 1 : -1);
  }
};

// 鍵盤：Esc 關閉、← → 切換
const onKey = (e: KeyboardEvent) => {
  if (!current.value) return;
  if (e.key === "Escape") closeModal();
  else if (e.key === "ArrowRight") go(1);
  else if (e.key === "ArrowLeft") go(-1);
};
onMounted(() => window.addEventListener("keydown", onKey));
onBeforeUnmount(() => {
  window.removeEventListener("keydown", onKey);
  unlockScroll();
});

// ---- 幻燈片 ----
const slideshowStart = ref<number | null>(null);
const startSlideshow = (index: number) => {
  slideshowStart.value = Math.max(0, index);
};
// 關閉幻燈片時，如果大圖模式開著，就停在幻燈片最後看到的那張
const onSlideshowClose = async (index: number) => {
  slideshowStart.value = null;
  await nextTick(); // 等幻燈片元件卸載（它會解除捲動鎖定）
  if (current.value) lockScroll();
  if (current.value && index !== currentIndex.value) {
    if (sourceEl) gsap.set(sourceEl, { opacity: 1 });
    currentIndex.value = index;
    showPhoto(mediaItems.value[index]);
    await nextTick();
    sourceEl = thumbEl(mediaItems.value[index].id);
    if (sourceEl) gsap.set(sourceEl, { opacity: 0 });
  }
};

// ---- 捲到底自動載入 ----
const sentinelRef = ref<HTMLElement>();
let observer: IntersectionObserver | null = null;
onMounted(() => {
  observer = new IntersectionObserver(
    (entries) => {
      if (entries[0].isIntersecting && hasMore.value && !loading.value) loadMore();
    },
    { rootMargin: "600px" } // 還差 600px 到底就先載入
  );
  if (sentinelRef.value) observer.observe(sentinelRef.value);
});
onBeforeUnmount(() => observer?.disconnect());

let loadingPromise: Promise<void> | null = null;
const loadMore = () => (loadingPromise ??= doLoadMore().finally(() => (loadingPromise = null)));
const doLoadMore = async () => {
  loading.value = true;
  try {
    const result = await getAlbumPhotos(albumId, page + 1);
    page++;
    albumTitle.value = result.title;

    // 將新照片附加到現有照片列表（Flickr 已排除影片）
    mediaItems.value.push(...result.photos);

    // 判斷是否還有更多照片
    hasMore.value = result.hasMore;

    // 載入後如果底部還在畫面內（照片太少填不滿），繼續載入
    await nextTick();
    const rect = sentinelRef.value?.getBoundingClientRect();
    if (hasMore.value && rect && rect.top < window.innerHeight + 600) {
      setTimeout(loadMore, 0);
    }
  } catch (error) {
    console.error("獲取照片失敗:", error);
    errorMessage.value = error instanceof Error ? error.message : "獲取照片失敗";
  } finally {
    loading.value = false;
  }
};

onMounted(() => {
  loadMore(); // 頁面加載時獲取第一批照片
});

// 重新載入（上傳後）
const reload = async () => {
  mediaItems.value = [];
  page = 0;
  await loadMore();
};

// ---- 上傳照片 ----
const uploading = ref(false);
const uploadDone = ref(0);
const uploadTotal = ref(0);

const handleUpload = async (event: Event) => {
  const input = event.target as HTMLInputElement;
  const files = Array.from(input.files || []);
  input.value = ""; // 讓同一批檔案可以再選一次
  if (files.length === 0) return;

  uploading.value = true;
  uploadDone.value = 0;
  uploadTotal.value = files.length;
  try {
    const failed = await uploadMany(albumId, files, (n) => {
      uploadDone.value = n;
    });
    if (failed.length) alert(`以下照片上傳失敗：\n${failed.join("\n")}`);
    await reload();
  } finally {
    uploading.value = false;
  }
};

// ---- 從相簿移除 ----
const handleRemove = async (item: MediaItem) => {
  if (!confirm(`確定要把「${item.title}」從這個相簿移除嗎？\n（照片仍會保留在 Flickr）`)) {
    return;
  }
  try {
    await removeFromAlbum(albumId, item.id);
    mediaItems.value = mediaItems.value.filter((p) => p.id !== item.id);
  } catch (error) {
    alert(error instanceof Error ? error.message : "移除失敗");
  }
};

// ---- 瀑布流排列 ----
// 依螢幕寬度決定欄數
const getColumnCount = () =>
  window.innerWidth < 640 ? 2 : window.innerWidth < 1024 ? 3 : 5;
const columnCount = ref(getColumnCount());
const onResize = () => (columnCount.value = getColumnCount());
onMounted(() => window.addEventListener("resize", onResize));
onBeforeUnmount(() => window.removeEventListener("resize", onResize));

// 每張照片放進目前最短的一欄（一樣短就放左邊），所以順序是由左往右
const columns = computed(() => {
  const cols = Array.from({ length: columnCount.value }, () => ({
    items: [] as MediaItem[],
    height: 0,
  }));
  for (const item of mediaItems.value) {
    const shortest = cols.reduce((min, col) => (col.height < min.height ? col : min));
    shortest.items.push(item);
    shortest.height += item.height / item.width; // 欄寬相同，用長寬比估算高度
  }
  return cols.map((col) => col.items);
});
watch(columns, revealNewPhotos);

</script>

<style scoped>
.show-page__inner {
  padding: calc(var(--header-height) + clamp(32px, 5vw, 64px)) clamp(16px, 4vw, 48px) 80px;
}
.show-back {
  font-size: 0.75rem;
  color: var(--color-primary);
}
.show-title {
  font-size: clamp(1.5rem, 3vw, 2.5rem);
  font-weight: 500;
}
.show-btn {
  padding: 10px 22px;
  border-radius: 999px;
  border: 1px solid #d6d6d2;
  background: #fff;
  font-size: 0.875rem;
  transition: background 0.3s, color 0.3s, border-color 0.3s;
}
.show-btn:hover {
  border-color: var(--color-text);
}
.show-btn--dark {
  background: var(--color-text);
  border-color: var(--color-text);
  color: #fff;
}
.show-btn--dark:hover {
  background: var(--color-primary);
  border-color: var(--color-primary);
}
.masonry-container {
  display: flex;
  align-items: flex-start;
  gap: 15px;
}
.masonry-column {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 15px;
}
.masonry-item {
  width: 100%;
}
.lb-btn {
  width: 2.75rem;
  height: 2.75rem;
  border-radius: 9999px;
  background: rgba(255, 255, 255, 0.12);
  color: white;
  font-size: 1.25rem;
  line-height: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.2s;
}
.lb-btn:hover {
  background: rgba(255, 255, 255, 0.3);
}
.lb-nav {
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  font-size: 2rem;
}
.video-badge {
  position: absolute;
  z-index: 5;
  left: 10px;
  bottom: 10px;
  width: 34px;
  height: 34px;
  border-radius: 50%;
  background: rgba(0, 0, 0, 0.55);
  color: #fff;
  font-size: 0.8rem;
  display: flex;
  align-items: center;
  justify-content: center;
  padding-left: 2px;
  pointer-events: none;
}
.masonry-item img {
  display: block;
  width: 100%;
}
</style>
