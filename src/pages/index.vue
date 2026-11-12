<template>
  <div class="bg-gray-100 min-h-screen">
    <LoadingProgress
      :progress="loadingProgress"
      :visible="loading"
      @done="playIntro"
    />

    <!-- 封面：picture 負責捲動效果，img 負責進場效果，兩個動畫才不會互相干擾 -->
    <section ref="heroRef" class="relative h-screen z-0 overflow-hidden">
      <picture ref="heroBgRef" class="hero-bg">
        <source srcset="../assets/cover.png" media="(max-width: 767px)" />
        <img
          ref="heroImgRef"
          src="../assets/cover.png"
          alt="封面圖"
          class="hero-bg__img"
        />
      </picture>

      <div
        ref="heroTextRef"
        class="absolute top-20 right-6 md:right-20 text-white flex flex-col items-start"
      >
        <span
          v-for="(line, i) in heroLines"
          :key="i"
          class="hero-line text-4xl md:text-5xl font-bold drop-shadow-md"
          :aria-label="line"
        >
          <!-- 隱形的完整文字撐出固定寬度，打字時位置才不會一直移動 -->
          <span class="hero-line__ghost" aria-hidden="true">{{ line }}</span>
          <span class="hero-line__typed"
            ><span class="hero-line__text"></span
            ><span class="hero-line__cursor">|</span></span
          >
        </span>
      </div>

      <div
        ref="scrollHintRef"
        class="absolute bottom-10 left-1/2 -translate-x-1/2 text-white text-sm flex flex-col items-center gap-2 opacity-0"
      >
        <span>滑動以查看更多</span>
        <span class="scroll-hint__line"></span>
      </div>
    </section>

    <div
      ref="contentRef"
      class="p-6 pt-10 bg-gray-100 z-20 relative rounded-t-3xl shadow-[0_-20px_40px_rgba(0,0,0,0.25)]"
    >
      <div
        class="flex items-center justify-between mb-4 lg:w-3/4 lg:mx-auto"
      >
        <h1 ref="titleRef" class="text-2xl font-bold overflow-hidden">
          <span
            v-for="(char, i) in '我的相簿'"
            :key="i"
            class="title-char inline-block"
            >{{ char }}</span
          >
        </h1>
        <button
          v-if="isEditor"
          @click="openCreate"
          class="px-4 py-2 text-white bg-blue-500 rounded hover:bg-blue-600"
        >
          ＋ 新增相簿
        </button>
      </div>
      <div v-if="loading" class="text-center">
        <p>載入中...</p>
      </div>

      <div v-else>
        <div v-if="errorMessage" class="text-center text-red-500">
          <p>{{ errorMessage }}</p>
        </div>
        <div v-else-if="albums.length === 0" class="text-center">
          <p v-if="isEditor">目前沒有相簿，按右上角「新增相簿」開始上傳照片。</p>
          <p v-else>目前沒有相簿。</p>
        </div>

        <div
          v-else
          class="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 lg:w-3/4 lg:mx-auto gap-6"
        >
          <div
            v-for="album in albums"
            :key="album.id"
            class="album-card relative group bg-white rounded-lg shadow hover:shadow-xl transition-shadow overflow-hidden cursor-pointer"
            @click="goToAlbum(album.id)"
          >
            <div class="w-full aspect-square bg-gray-200 overflow-hidden">
              <img
                :src="album.coverUrl"
                :alt="album.title"
                class="album-card__img w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
              />
            </div>

            <div
              class="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <div class="absolute bottom-4 left-4 text-white">
                <h2 class="text-lg font-semibold">{{ album.title }}</h2>
                <button
                  @click.stop="goToAlbum(album.id)"
                  class="mt-2 px-4 py-2 text-sm bg-blue-500 rounded hover:bg-blue-600"
                >
                  查看相簿
                </button>
              </div>
            </div>

            <button
              v-if="isEditor"
              @click.stop="handleDeleteAlbum(album)"
              class="absolute top-3 right-3 w-8 h-8 rounded-full bg-black bg-opacity-60 text-white opacity-0 group-hover:opacity-100 hover:bg-red-600 transition"
              title="刪除相簿"
            >
              ✕
            </button>

            <p
              class="absolute top-4 left-4 text-sm text-white bg-black bg-opacity-60 px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity"
            >
              照片數量：{{ album.photoCount }}
            </p>
          </div>
        </div>
      </div>
    </div>

    <!-- 新增相簿 -->
    <div
      v-if="showCreate"
      class="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-60 p-4"
      @click.self="!creating && (showCreate = false)"
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
          <span class="text-sm text-gray-700">說明（選填）</span>
          <textarea
            v-model="newDescription"
            :disabled="creating"
            rows="2"
            class="mt-1 w-full border rounded px-3 py-2"
          />
        </label>
        <label class="block">
          <span class="text-sm text-gray-700">照片（第一張會當封面）</span>
          <input
            type="file"
            accept="image/*,.heic,.heif"
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
            @click="showCreate = false"
            class="px-4 py-2 rounded border disabled:opacity-50"
          >
            取消
          </button>
          <button
            type="submit"
            :disabled="creating"
            class="px-4 py-2 rounded text-white bg-blue-500 hover:bg-blue-600 disabled:opacity-50"
          >
            {{ creating ? "上傳中…" : "建立並上傳" }}
          </button>
        </div>
      </form>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, watch, nextTick } from "vue";
import { useRouter } from "vue-router";
import gsap from "gsap"; // 导入 gsap
import { TextPlugin } from "gsap/TextPlugin";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import LoadingProgress from "../components/Loading.vue"; // 引入 LoadingProgress 組件
import {
  getAlbums,
  createAlbum,
  uploadMany,
  deleteAlbum,
  canEdit,
  type Album,
} from "../services/flickr";

gsap.registerPlugin(TextPlugin, ScrollTrigger);
const loadingProgress = ref(0); // Progress state
const loading = ref(true);
const albums = ref<Album[]>([]);
const errorMessage = ref("");
const isEditor = ref(false);
canEdit().then((v) => (isEditor.value = v));
const router = useRouter();

// ===================== GSAP 特效 =====================
const heroLines = ["一緒に", "旅行を", "楽しみましょう"];
const heroRef = ref<HTMLElement>();
const heroBgRef = ref<HTMLElement>();
const heroImgRef = ref<HTMLElement>();
const heroTextRef = ref<HTMLElement>();
const scrollHintRef = ref<HTMLElement>();
const contentRef = ref<HTMLElement>();
const titleRef = ref<HTMLElement>();

// 有開「減少動態效果」的使用者，只顯示結果不播動畫
const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

// 所有動畫都放進 context，離開頁面時一次清掉（包含 ScrollTrigger）
let ctx: gsap.Context;
let introPlayed = false;

onMounted(() => {
  ctx = gsap.context(() => {
    // 進場前的初始狀態（避免畫面先閃一下）
    gsap.set(heroImgRef.value!, { scale: 1.35, filter: "brightness(0.3)" });
    gsap.set(".title-char", { yPercent: 110 });
    if (reduceMotion) return;

    // 捲動：封面慢慢放大變暗，文字往上飄走
    const scrub = {
      trigger: heroRef.value!,
      start: "top top",
      end: "bottom top",
      scrub: true,
    };
    gsap.to(heroBgRef.value!, {
      scale: 1.12, // 只輕微放大，不調暗（封面本身偏暗，調暗會變一片黑）
      ease: "none",
      scrollTrigger: scrub,
    });
    gsap.to(heroTextRef.value!, {
      yPercent: -60,
      opacity: 0,
      ease: "none",
      scrollTrigger: { ...scrub, end: "60% top" },
    });
    gsap.to(scrollHintRef.value!, {
      y: 40,
      autoAlpha: 0,
      ease: "none",
      scrollTrigger: { ...scrub, end: "20% top" },
    });

    // 標題逐字從下方浮出
    gsap.to(".title-char", {
      yPercent: 0,
      stagger: 0.06,
      duration: 0.8,
      ease: "power4.out",
      scrollTrigger: { trigger: titleRef.value!, start: "top 85%" },
    });
  });
});

onBeforeUnmount(() => ctx?.revert());

// 載入畫面結束後播放：封面拉近、逐行打字、捲動提示
const playIntro = () => {
  if (introPlayed || !ctx) return;
  introPlayed = true;

  ctx.add(() => {
    const lines = gsap.utils.toArray<HTMLElement>(".hero-line");
    const texts = lines.map((l) => l.querySelector(".hero-line__text")!);
    const cursors = lines.map((l) => l.querySelector(".hero-line__cursor")!);

    if (reduceMotion) {
      gsap.set(heroImgRef.value!, { scale: 1, filter: "brightness(1)" });
      texts.forEach((t, i) => (t.textContent = heroLines[i]));
      gsap.set(cursors, { opacity: 0 });
      gsap.set(scrollHintRef.value!, { opacity: 1 });
      gsap.set(".title-char", { yPercent: 0 });
      return;
    }

    const tl = gsap.timeline();
    tl.to(heroImgRef.value!, {
      scale: 1,
      filter: "brightness(1)",
      duration: 2.2,
      ease: "power3.out",
    });

    // 逐行打字，游標跟著目前那一行
    texts.forEach((text, i) => {
      tl.set(cursors[i], { opacity: 1 }, i === 0 ? "-=1.2" : undefined)
        .to(text, {
          text: heroLines[i],
          duration: heroLines[i].length * 0.13,
          ease: "none",
        })
        .set(cursors[i], { opacity: i === texts.length - 1 ? 1 : 0 }, "+=0.15");
    });

    // 最後一行的游標持續閃爍
    tl.to(cursors[cursors.length - 1], {
      opacity: 0,
      duration: 0.5,
      repeat: -1,
      yoyo: true,
      ease: "steps(1)",
    });

    tl.fromTo(
      scrollHintRef.value!,
      { opacity: 0, y: -10 },
      { opacity: 1, y: 0, duration: 0.8, ease: "power2.out" },
      "<"
    );
    // 捲動提示的線條上下流動
    tl.fromTo(
      ".scroll-hint__line",
      { scaleY: 0, transformOrigin: "top" },
      { scaleY: 1, duration: 1, repeat: -1, ease: "power2.inOut", yoyo: true },
      "<"
    );
  });
};

// 相簿卡片：捲到時依序浮現，封面從放大縮回
const animateCards = async () => {
  await nextTick();
  if (!ctx) return;
  ctx.add(() => {
    const cards = gsap.utils.toArray<HTMLElement>(".album-card:not([data-shown])");
    if (cards.length === 0) return;
    cards.forEach((c) => (c.dataset.shown = "1"));
    if (reduceMotion) return;

    gsap.set(cards, { opacity: 0, y: 60, scale: 0.94 });
    ScrollTrigger.batch(cards, {
      start: "top 92%",
      once: true,
      onEnter: (batch) => {
        gsap.to(batch, {
          opacity: 1,
          y: 0,
          scale: 1,
          duration: 0.9,
          stagger: 0.1,
          ease: "power3.out",
        });
        gsap.fromTo(
          batch.map((c) => c.querySelector(".album-card__img")),
          { scale: 1.3 },
          { scale: 1, duration: 1.4, stagger: 0.1, ease: "power3.out", clearProps: "transform" }
        );
      },
    });
    ScrollTrigger.refresh();
  });
};
watch(albums, animateCards);

// 初始化：從 Flickr 取得相簿
const loadAlbums = async () => {
  errorMessage.value = "";
  albums.value = await getAlbums();
};

onMounted(async () => {
  loading.value = true;
  loadingProgress.value = 30;
  try {
    await loadAlbums();
  } catch (error) {
    console.error("取得相簿失敗:", error);
    errorMessage.value =
      error instanceof Error ? error.message : "取得相簿失敗";
  } finally {
    loadingProgress.value = 100;
    loading.value = false;
  }
});

// ---- 新增相簿 ----
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
};

const handleCreate = async () => {
  if (newFiles.value.length === 0) return;
  creating.value = true;
  createError.value = "";
  try {
    const [first, ...rest] = newFiles.value;
    const albumId = await createAlbum(
      newTitle.value.trim(),
      newDescription.value.trim(),
      first
    );
    uploadDone.value = 1;
    const failed = await uploadMany(albumId, rest, (n) => {
      uploadDone.value = n + 1;
    });
    if (failed.length) alert(`以下照片上傳失敗：\n${failed.join("\n")}`);
    showCreate.value = false;
    goToAlbum(albumId);
  } catch (error) {
    createError.value = error instanceof Error ? error.message : "建立失敗";
  } finally {
    creating.value = false;
  }
};

// ---- 刪除相簿 ----
const handleDeleteAlbum = async (album: Album) => {
  if (!confirm(`確定要刪除相簿「${album.title}」嗎？\n（照片仍會保留在 Flickr）`)) {
    return;
  }
  try {
    await deleteAlbum(album.id);
    albums.value = albums.value.filter((a) => a.id !== album.id);
  } catch (error) {
    alert(error instanceof Error ? error.message : "刪除失敗");
  }
};

// 跳转到相簿详细页
const goToAlbum = (albumId: string) => {
  router.push({ name: "ShowPage", params: { albumId } });
};
</script>

<style scoped>
/* 封面固定在背景，內容區塊捲上來蓋過去 */
.hero-bg {
  position: fixed;
  inset: 0;
  will-change: transform;
}
.hero-bg__img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  will-change: transform, filter;
}
.hero-line {
  position: relative;
  display: block;
  line-height: 2;
  white-space: nowrap;
}
.hero-line__ghost {
  visibility: hidden;
}
.hero-line__typed {
  position: absolute;
  top: 0;
  left: 0;
}
.hero-line__cursor {
  opacity: 0;
  margin-left: 2px;
  font-weight: 300;
}
.scroll-hint__line {
  display: block;
  width: 1px;
  height: 48px;
  background: currentColor;
}
</style>
