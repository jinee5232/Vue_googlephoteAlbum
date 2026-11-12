<template>
  <div class="albums-page">
    <section class="page-head">
      <p class="page-head__en font-en">All Albums</p>
      <h1 class="page-head__title">
        <span class="mask-line"><span>所有相簿</span></span>
      </h1>
      <div class="page-head__bar">
        <p class="page-head__count font-en">{{ albums.length }} Albums</p>
        <button v-if="isEditor" class="pill-btn" @click="openCreate">＋ 新增相簿</button>
      </div>
    </section>

    <section class="albums">
      <p v-if="loading" class="albums__status">載入中…</p>
      <p v-else-if="errorMessage" class="albums__status albums__status--error">{{ errorMessage }}</p>
      <p v-else-if="albums.length === 0" class="albums__status">
        {{ isEditor ? "目前沒有相簿，按右上角「新增相簿」開始上傳照片。" : "目前沒有相簿。" }}
      </p>

      <div v-else class="albums__grid">
        <article v-for="album in albums" :key="album.id" class="album-card">
          <router-link :to="{ name: 'ShowPage', params: { albumId: album.id } }" class="album-card__link">
            <div class="album-card__visual">
              <img :src="album.coverUrl" :alt="album.title" loading="lazy" />
            </div>
            <div class="album-card__body">
              <h2 class="album-card__title">{{ album.title }}</h2>
              <p class="album-card__meta font-en">
                {{ formatDot(album.createdAt) }} ・ {{ album.photoCount }} Photos
              </p>
            </div>
          </router-link>
          <button
            v-if="isEditor"
            class="album-card__delete"
            title="刪除相簿"
            @click="handleDeleteAlbum(album)"
          >
            ✕
          </button>
        </article>
      </div>
    </section>

    <SiteFooter />

    <!-- 新增相簿 -->
    <div
      v-if="showCreate"
      class="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-60 p-4"
      data-lenis-prevent
      @click.self="!creating && closeCreate()"
    >
      <form
        @submit.prevent="handleCreate"
        class="w-full max-w-md bg-white rounded-lg shadow-lg p-6 space-y-4"
      >
        <h2 class="text-xl font-bold">新增相簿</h2>
        <label class="block">
          <span class="text-sm text-gray-700">相簿名稱</span>
          <input
            v-model="newTitle"
            required
            :disabled="creating"
            class="mt-1 w-full border rounded px-3 py-2"
            placeholder="例如：2026 京都"
          />
        </label>
        <label class="block">
          <span class="text-sm text-gray-700">說明（選填，會顯示在首頁）</span>
          <textarea
            v-model="newDescription"
            :disabled="creating"
            rows="2"
            class="mt-1 w-full border rounded px-3 py-2"
          />
        </label>
        <label class="block">
          <span class="text-sm text-gray-700">照片或影片（第一個會當封面）</span>
          <input
            type="file"
            accept="image/*,video/*,.heic,.heif,.mov"
            multiple
            required
            :disabled="creating"
            @change="newFiles = Array.from(($event.target as HTMLInputElement).files || [])"
            class="mt-1 w-full text-sm"
          />
        </label>
        <p v-if="creating" class="text-sm text-gray-600">
          上傳中 {{ uploadDone }} / {{ newFiles.length }}，請不要關閉頁面…
        </p>
        <p v-if="createError" class="text-sm text-red-500">{{ createError }}</p>
        <div class="flex justify-end gap-2">
          <button
            type="button"
            :disabled="creating"
            @click="closeCreate"
            class="px-4 py-2 rounded border disabled:opacity-50"
          >
            取消
          </button>
          <button
            type="submit"
            :disabled="creating"
            class="px-4 py-2 rounded text-white bg-[var(--color-text)] hover:bg-[var(--color-primary)] disabled:opacity-50"
          >
            {{ creating ? "上傳中…" : "建立並上傳" }}
          </button>
        </div>
      </form>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, nextTick } from "vue";
import { useRouter } from "vue-router";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import SiteFooter from "../components/SiteFooter.vue";
import { lockScroll, unlockScroll } from "../animation/smoothScroll";
import {
  getAlbums,
  createAlbum,
  uploadMany,
  deleteAlbum,
  canEdit,
  type Album,
} from "../services/flickr";

gsap.registerPlugin(ScrollTrigger);

const router = useRouter();
const albums = ref<Album[]>([]);
const loading = ref(true);
const errorMessage = ref("");
const isEditor = ref(false);
canEdit().then((v) => (isEditor.value = v));

const formatDot = (ms: number) => {
  if (!ms) return "";
  const d = new Date(ms);
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")}`;
};

// ===================== 動畫 =====================
const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const ctx = gsap.context(() => {});
onBeforeUnmount(() => ctx.revert());

onMounted(async () => {
  if (!reduceMotion) {
    ctx.add(() => {
      gsap.fromTo(".page-head .mask-line > span", { yPercent: 110 }, { yPercent: 0, duration: 1.1, ease: "power4.out", delay: 0.1 });
      gsap.from(".page-head__en, .page-head__bar", { opacity: 0, y: 12, duration: 0.8, stagger: 0.1, delay: 0.3 });
    });
  }
  try {
    albums.value = await getAlbums();
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : "取得相簿失敗";
  } finally {
    loading.value = false;
  }
  await nextTick();
  animateCards();
});

// 相簿卡片：捲到時圖片由下往上揭開，文字浮現
const animateCards = () => {
  if (reduceMotion) return;
  ctx.add(() => {
    const cards = gsap.utils.toArray<HTMLElement>(".album-card");
    gsap.set(cards.map((c) => c.querySelector(".album-card__visual")), { clipPath: "inset(100% 0% 0% 0%)" });
    gsap.set(cards.map((c) => c.querySelector(".album-card__body")), { opacity: 0, y: 16 });
    ScrollTrigger.batch(cards, {
      start: "top 92%",
      once: true,
      onEnter: (batch) => {
        const visuals = batch.map((c) => c.querySelector(".album-card__visual"));
        gsap.to(visuals, { clipPath: "inset(0% 0% 0% 0%)", duration: 1.1, stagger: 0.1, ease: "power3.out" });
        gsap.fromTo(
          visuals.map((v) => v!.querySelector("img")),
          { scale: 1.3 },
          { scale: 1, duration: 1.5, stagger: 0.1, ease: "power3.out", clearProps: "transform" }
        );
        gsap.to(batch.map((c) => c.querySelector(".album-card__body")), {
          opacity: 1,
          y: 0,
          duration: 0.8,
          stagger: 0.1,
          delay: 0.3,
          ease: "power3.out",
        });
      },
    });
    ScrollTrigger.refresh();
  });
};

// ===================== 新增相簿 =====================
const showCreate = ref(false);
const creating = ref(false);
const newTitle = ref("");
const newDescription = ref("");
const newFiles = ref<File[]>([]);
const uploadDone = ref(0);
const createError = ref("");

const openCreate = () => {
  newTitle.value = "";
  newDescription.value = "";
  newFiles.value = [];
  uploadDone.value = 0;
  createError.value = "";
  showCreate.value = true;
  lockScroll();
};
const closeCreate = () => {
  showCreate.value = false;
  unlockScroll();
};

const handleCreate = async () => {
  if (newFiles.value.length === 0) return;
  creating.value = true;
  createError.value = "";
  try {
    const [first, ...rest] = newFiles.value;
    const albumId = await createAlbum(newTitle.value.trim(), newDescription.value.trim(), first);
    uploadDone.value = 1;
    const failed = await uploadMany(albumId, rest, (n) => {
      uploadDone.value = n + 1;
    });
    if (failed.length) alert(`以下照片上傳失敗：\n${failed.join("\n")}`);
    closeCreate();
    router.push({ name: "ShowPage", params: { albumId } });
  } catch (error) {
    createError.value = error instanceof Error ? error.message : "建立失敗";
  } finally {
    creating.value = false;
  }
};

// ===================== 刪除相簿 =====================
const handleDeleteAlbum = async (album: Album) => {
  if (!confirm(`確定要刪除相簿「${album.title}」嗎？\n（照片仍會保留在 Flickr）`)) return;
  try {
    await deleteAlbum(album.id);
    albums.value = albums.value.filter((a) => a.id !== album.id);
    await nextTick();
    ScrollTrigger.refresh();
  } catch (error) {
    alert(error instanceof Error ? error.message : "刪除失敗");
  }
};
</script>

<style scoped>
.page-head {
  padding: calc(var(--header-height) + clamp(32px, 5vw, 64px)) clamp(20px, 6vw, 96px) clamp(24px, 3vw, 40px);
}
.page-head__en {
  font-size: 0.75rem;
  color: var(--color-primary);
}
.page-head__title {
  margin-top: 8px;
  font-size: clamp(2rem, 4.4vw, 3.75rem);
  font-weight: 500;
}
.page-head__bar {
  margin-top: clamp(24px, 3vw, 40px);
  padding-top: 20px;
  border-top: 1px solid #e3e3e0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}
.page-head__count {
  font-size: 0.75rem;
  color: var(--color-muted);
}
.mask-line {
  display: block;
  overflow: hidden;
  padding-bottom: 0.08em;
}
.mask-line > span {
  display: inline-block;
}
.pill-btn {
  padding: 12px 28px;
  border-radius: 999px;
  background: var(--color-text);
  color: #fff;
  font-size: 0.875rem;
  transition: background 0.3s;
}
.pill-btn:hover {
  background: var(--color-primary);
}

.albums {
  padding: 0 clamp(20px, 6vw, 96px) clamp(64px, 8vw, 100px);
}
.albums__status {
  padding: 64px 0;
  text-align: center;
  color: var(--color-muted);
}
.albums__status--error {
  color: #c0392b;
}
.albums__grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: clamp(32px, 4vw, 56px) clamp(16px, 2.4vw, 32px);
}
@media (min-width: 768px) {
  .albums__grid {
    grid-template-columns: repeat(3, 1fr);
  }
}
@media (min-width: 1200px) {
  .albums__grid {
    grid-template-columns: repeat(4, 1fr);
  }
}
.album-card {
  position: relative;
}
.album-card__visual {
  aspect-ratio: 4 / 5;
  overflow: hidden;
  background: var(--color-bg-soft);
}
.album-card__visual img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  transition: transform 0.9s cubic-bezier(0.2, 0.8, 0.2, 1);
}
.album-card__link:hover .album-card__visual img {
  transform: scale(1.06);
}
.album-card__body {
  padding-top: 14px;
}
.album-card__title {
  font-size: clamp(0.9375rem, 1.3vw, 1.125rem);
  font-weight: 500;
  transition: color 0.3s;
}
.album-card__link:hover .album-card__title {
  color: var(--color-primary);
}
.album-card__meta {
  margin-top: 4px;
  font-size: 0.6875rem;
  color: var(--color-muted);
}
.album-card__delete {
  position: absolute;
  top: 10px;
  right: 10px;
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: rgba(0, 0, 0, 0.55);
  color: #fff;
  opacity: 0;
  transition: opacity 0.3s, background 0.3s;
}
.album-card:hover .album-card__delete,
.album-card__delete:focus-visible {
  opacity: 1;
}
.album-card__delete:hover {
  background: #c0392b;
}
@media (hover: none) {
  .album-card__delete {
    opacity: 1;
  }
}
</style>
