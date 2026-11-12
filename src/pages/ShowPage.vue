<template>
  <div class="bg-gray-100 min-h-screen">
    <div class="p-6">
      <div
        class="show-header flex flex-wrap items-center justify-between gap-3 mb-4 lg:w-4/5 lg:mx-auto"
      >
        <div class="flex items-center gap-3">
          <router-link to="/home" class="text-blue-500 hover:underline">
            ← 所有相簿
          </router-link>
          <h1 class="text-2xl font-bold">{{ albumTitle || "相簿照片" }}</h1>
        </div>
        <label
          v-if="isEditor"
          class="px-4 py-2 text-white rounded cursor-pointer"
          :class="uploading ? 'bg-gray-400' : 'bg-blue-500 hover:bg-blue-600'"
        >
          {{ uploading ? `上傳中 ${uploadDone} / ${uploadTotal}…` : "＋ 上傳照片" }}
          <input
            type="file"
            accept="image/*,.heic,.heif"
            multiple
            class="hidden"
            :disabled="uploading"
            @change="handleUpload"
          />
        </label>
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

      <div v-if="hasMore && !loading" class="text-center mt-4">
        <button
          @click="loadMore"
          class="px-6 py-3 text-white bg-blue-500 rounded hover:bg-blue-600"
        >
          查看更多
        </button>
      </div>

      <!-- 放大查看：照片從縮圖的位置放大到畫面中央（FLIP 動畫） -->
      <div
        v-if="selectedItem"
        class="fixed inset-0 z-50 flex items-center justify-center"
        @click="closeModal"
      >
        <div ref="backdropRef" class="absolute inset-0 bg-black bg-opacity-90"></div>
        <img
          ref="modalImgRef"
          :src="modalSrc"
          :alt="selectedItem.title"
          :style="modalSize"
          class="relative rounded-lg shadow-2xl object-contain"
          @click.stop
        />
        <button
          ref="closeBtnRef"
          class="absolute top-4 right-4 text-white text-2xl w-10 h-10 rounded-full bg-white bg-opacity-10 hover:bg-opacity-30 flex items-center justify-center"
          @click.stop="closeModal"
        >
          ✕
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount, watch, nextTick } from "vue";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useRoute } from "vue-router";
import {
  getAlbumPhotos,
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
const selectedItem = ref<MediaItem | null>(null);
const modalSrc = ref("");
const backdropRef = ref<HTMLElement>();
const modalImgRef = ref<HTMLElement>();
const closeBtnRef = ref<HTMLElement>();
let sourceEl: HTMLElement | null = null;
let closing = false;

// 依照片長寬比算出放大後的尺寸（先知道尺寸，動畫才能從縮圖精準放大）
const modalSize = computed(() => {
  const item = selectedItem.value;
  if (!item) return {};
  const maxW = window.innerWidth * 0.92;
  const maxH = window.innerHeight * 0.88;
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

const openModal = async (item: MediaItem, event: MouseEvent) => {
  sourceEl = event.currentTarget as HTMLElement;
  closing = false;
  modalSrc.value = item.thumbUrl; // 先用已載入的縮圖，動畫不用等大圖
  selectedItem.value = item;
  document.body.style.overflow = "hidden";
  await nextTick();

  // 大圖在背景載入，好了再換上
  const large = new Image();
  large.onload = () => {
    if (selectedItem.value?.id === item.id) modalSrc.value = item.largeUrl;
  };
  large.src = item.largeUrl;

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
  gsap.fromTo(closeBtnRef.value!, { opacity: 0, scale: 0.5 }, { opacity: 1, scale: 1, delay: 0.4, duration: 0.3 });
};

const finishClose = () => {
  if (sourceEl) gsap.set(sourceEl, { opacity: 1 });
  selectedItem.value = null;
  document.body.style.overflow = "";
  closing = false;
};

const closeModal = () => {
  if (!selectedItem.value || closing) return;
  closing = true;
  const img = modalImgRef.value;
  // 縮圖可能已經捲出畫面，那就直接淡出
  const target = sourceEl?.getBoundingClientRect();
  const visible = target && target.bottom > 0 && target.top < window.innerHeight;
  if (reduceMotion || !img || !visible) {
    gsap.to([img, backdropRef.value, closeBtnRef.value], {
      opacity: 0,
      duration: reduceMotion ? 0 : 0.3,
      onComplete: finishClose,
    });
    return;
  }
  gsap.to(closeBtnRef.value!, { opacity: 0, duration: 0.15 });
  gsap.to(backdropRef.value!, { opacity: 0, duration: 0.45 });
  gsap.to(img, {
    ...deltaTo(img.getBoundingClientRect(), target!),
    duration: 0.5,
    ease: "power3.inOut",
    onComplete: finishClose,
  });
};

// Esc 關閉
const onKey = (e: KeyboardEvent) => e.key === "Escape" && closeModal();
onMounted(() => window.addEventListener("keydown", onKey));
onBeforeUnmount(() => {
  window.removeEventListener("keydown", onKey);
  document.body.style.overflow = "";
});

const loadMore = async () => {
  loading.value = true;
  try {
    const result = await getAlbumPhotos(albumId, page + 1);
    page++;
    albumTitle.value = result.title;

    // 將新照片附加到現有照片列表（Flickr 已排除影片）
    mediaItems.value.push(...result.photos);

    // 判斷是否還有更多照片
    hasMore.value = result.hasMore;

    // 讓新加的照片出現在頁面底部
    const loadMoreButton = document.getElementById("load-more-button");
    if (loadMoreButton) {
      loadMoreButton.scrollIntoView({ behavior: "smooth" });
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
.masonry-item img {
  display: block;
  width: 100%;
}
</style>
