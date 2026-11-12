<template>
  <div ref="rootRef" class="home">
    <LoadingProgress
      :progress="loadingProgress"
      :visible="loading"
      @done="playIntro"
    />

    <!-- ===================== 封面：照片拼貼 ===================== -->
    <section class="hero">
      <div class="hero__stage">
        <!-- 照片：用最新相簿的封面 -->
        <figure
          v-for="(slot, i) in heroSlots"
          :key="i"
          class="hero__item hero__photo"
          :class="{ 'hero__item--pc': slot.pcOnly }"
          :style="slotStyle(slot)"
          :data-speed="slot.speed"
        >
          <router-link v-if="slot.album" :to="albumLink(slot.album.id)" :aria-label="slot.album.title">
            <img :src="slot.src" alt="" />
          </router-link>
          <img v-else-if="slot.src" :src="slot.src" alt="" />
        </figure>

        <!-- 裝飾圖形（淺綠 + 顆粒質感） -->
        <div class="hero__item hero__shape hero__shape--ring" :style="slotStyle(shapes.ring)" data-speed="-30" aria-hidden="true">
          <svg viewBox="0 0 100 100"><circle cx="50" cy="50" r="40" fill="none" stroke="currentColor" stroke-width="16" /></svg>
        </div>
        <div class="hero__item hero__shape hero__shape--square" :style="slotStyle(shapes.square)" data-speed="20" aria-hidden="true"></div>
        <div class="hero__item hero__shape hero__shape--hill" :style="slotStyle(shapes.hill)" data-speed="10" aria-hidden="true">
          <svg viewBox="0 0 100 50" preserveAspectRatio="none"><path d="M0 50 C 20 5, 80 5, 100 50 Z" fill="currentColor" /></svg>
        </div>
      </div>

      <div class="hero__body">
        <h1 class="hero__catch">
          <span v-for="(line, i) in heroLines" :key="i" class="hero-line" :aria-label="line">
            <!-- 隱形的完整文字撐出固定寬度，打字時位置才不會移動 -->
            <span class="hero-line__ghost" aria-hidden="true">{{ line }}</span>
            <span class="hero-line__typed"
              ><span class="hero-line__text"></span
              ><span class="hero-line__cursor">|</span></span
            >
          </span>
        </h1>
      </div>

      <router-link v-if="latest" :to="albumLink(latest.id)" class="hero__news">
        <span class="hero__news-date font-en">
          <span class="hero__news-dot"></span>{{ formatDot(latest.createdAt) }}
        </span>
        <span class="hero__news-title">最新相簿「{{ latest.title }}」</span>
      </router-link>
    </section>

    <!-- ===================== 照片跑馬燈 ===================== -->
    <section v-if="marqueeItems.length" class="marquee" aria-hidden="true">
      <div class="marquee__track">
        <figure
          v-for="(item, i) in marqueeLoop"
          :key="i"
          class="marquee__item"
          :style="{ aspectRatio: item.ratio }"
        >
          <img :src="item.src" alt="" loading="lazy" />
        </figure>
      </div>
    </section>

    <!-- ===================== 文字區 + 數字統計 ===================== -->
    <section class="about">
      <span class="bg-word font-en" aria-hidden="true">MEMORIES</span>
      <div class="about__grid">
        <div class="about__copy">
          <p class="label font-en">About</p>
          <h2 class="about__title">
            <span v-for="(line, i) in aboutTitle" :key="i" class="mask-line"><span>{{ line }}</span></span>
          </h2>
          <p class="about__text">
            <span v-for="(line, i) in aboutText" :key="i" class="mask-line"><span>{{ line }}</span></span>
          </p>
          <p v-if="errorMessage" class="about__error">{{ errorMessage }}</p>
        </div>

        <dl v-if="albums.length" class="stats">
          <div v-for="stat in stats" :key="stat.label" class="stats__item">
            <dt class="stats__label">{{ stat.label }}</dt>
            <dd class="stats__value">
              <span class="stats__num font-en" :data-count="stat.count ?? ''">{{ stat.value }}</span>
              <span class="stats__unit font-en">{{ stat.unit }}</span>
            </dd>
          </div>
        </dl>
      </div>
    </section>

    <!-- ===================== 最新相簿（圖文交錯） ===================== -->
    <section v-if="featured.length" class="feature">
      <span class="bg-word font-en" aria-hidden="true">ALBUMS</span>
      <header class="section-head">
        <h2 class="section-head__title">
          <span class="mask-line"><span>最新相簿</span></span>
        </h2>
        <p class="section-head__en font-en">Latest Albums</p>
      </header>

      <article
        v-for="(album, i) in featured"
        :key="album.id"
        class="feature__item"
        :class="{ 'feature__item--reverse': i % 2 === 1 }"
      >
        <router-link :to="albumLink(album.id)" class="feature__visual reveal-img">
          <img :src="album.coverLargeUrl" :alt="album.title" />
        </router-link>
        <div class="feature__text">
          <p class="feature__num font-en">{{ String(i + 1).padStart(2, "0") }}</p>
          <h3 class="feature__title">{{ album.title }}</h3>
          <p class="feature__meta font-en">
            {{ formatDot(album.createdAt) }} ・ {{ album.photoCount }} Photos
          </p>
          <p v-if="album.description" class="feature__desc">{{ album.description }}</p>
          <router-link :to="albumLink(album.id)" class="arrow-link">
            查看相簿 <span aria-hidden="true">→</span>
          </router-link>
        </div>
      </article>

      <div class="feature__more">
        <router-link to="/albums" class="pill-btn">
          所有相簿 <span class="font-en">View All</span>
        </router-link>
      </div>
    </section>

    <!-- ===================== 照片牆 ===================== -->
    <section v-if="gallery.length && latest" class="gallery">
      <span class="bg-word font-en" aria-hidden="true">GALLERY</span>
      <header class="section-head">
        <h2 class="section-head__title">
          <span class="mask-line"><span>照片牆</span></span>
        </h2>
        <p class="section-head__en font-en">Gallery — {{ latest.title }}</p>
      </header>
      <div class="gallery__grid">
        <router-link
          v-for="(photo, i) in gallery"
          :key="photo.id"
          :to="albumLink(latest.id)"
          class="gallery__item reveal-img"
          :class="{ 'gallery__item--wide': i % 4 === 0 }"
        >
          <img :src="photo.thumbUrl" :alt="photo.title" loading="lazy" />
        </router-link>
      </div>
    </section>

    <SiteFooter />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount, nextTick } from "vue";
import gsap from "gsap";
import { TextPlugin } from "gsap/TextPlugin";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import LoadingProgress from "../components/Loading.vue";
import SiteFooter from "../components/SiteFooter.vue";
import coverImage from "../assets/cover.png";
import { getAlbums, getAlbumPhotos, type Album, type Photo } from "../services/flickr";

gsap.registerPlugin(TextPlugin, ScrollTrigger);

// ===================== 文字（可以自由修改） =====================
const heroLines = ["一緒に", "旅行を", "楽しみましょう"];
const aboutTitle = ["旅の記憶を、", "ひとつずつ。"];
const aboutText = [
  "出会った風景と笑顔を、心のアルバムに。",
  "ここは、わたしたちの旅を残しておく場所です。",
];

// ===================== 資料 =====================
const loading = ref(true);
const loadingProgress = ref(0);
const albums = ref<Album[]>([]);
const gallery = ref<Photo[]>([]);
const errorMessage = ref("");
const latest = computed(() => albums.value[0] ?? null);
const featured = computed(() => albums.value.slice(0, 3));

// 數字統計（從相簿資料計算）
const stats = computed(() => {
  const list = albums.value;
  const photos = list.reduce((sum, a) => sum + a.photoCount, 0);
  const years = list.map((a) => new Date(a.createdAt).getFullYear()).filter((y) => y > 2000);
  const first = Math.min(...years);
  const last = Math.max(...years);
  return [
    { label: "相簿", value: list.length, count: list.length, unit: "Albums" },
    { label: "照片與影片", value: photos, count: photos, unit: "Items" },
    ...(years.length
      ? [{ label: "記錄期間", value: first === last ? `${first}` : `${first}–${last}`, count: undefined, unit: "Years" }]
      : []),
  ];
});

// 跑馬燈：相簿封面 + 照片牆的照片，數量不夠就重複，再整串複製一次做無縫循環
const marqueeItems = computed(() => {
  const items = [
    ...albums.value.map((a) => ({ src: a.coverUrl, ratio: `${a.coverWidth} / ${a.coverHeight}` })),
    ...gallery.value.map((p) => ({ src: p.thumbUrl, ratio: `${p.width} / ${p.height}` })),
  ].filter((i) => i.src);
  if (items.length === 0) return [];
  const filled = [...items];
  while (filled.length < 10) filled.push(...items);
  return filled;
});
const marqueeLoop = computed(() => [...marqueeItems.value, ...marqueeItems.value]);

const albumLink = (id: string) => ({ name: "ShowPage", params: { albumId: id } });
const formatDot = (ms: number) => {
  if (!ms) return "";
  const d = new Date(ms);
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")}`;
};

// ===================== 封面拼貼的位置 =====================
// x / y / w 是在舞台中的百分比，ratio 是寬高比；s 開頭的是手機版
interface Slot {
  x: number; y: number; w: number; ratio: string;
  sx: number; sy: number; sw: number;
  speed?: number; pcOnly?: boolean;
}
const layout: Slot[] = [
  { x: 62, y: 9, w: 25, ratio: "3 / 4", sx: 44, sy: 3, sw: 50, speed: -12 },
  { x: 14, y: 7, w: 18, ratio: "1 / 1", sx: 5, sy: 47, sw: 36, speed: 8 },
  { x: 40.5, y: 5, w: 15, ratio: "4 / 3", sx: 52, sy: 51, sw: 42, speed: -20 },
  { x: 49, y: 40, w: 10, ratio: "3 / 4", sx: 7, sy: 25, sw: 24, speed: 18 },
  { x: 2.5, y: 9, w: 8, ratio: "3 / 4", sx: 6, sy: 3, sw: 26, speed: -6 },
  { x: 35, y: 35, w: 8.5, ratio: "1 / 1", sx: 0, sy: 0, sw: 0, speed: 25, pcOnly: true },
];
const shapes: Record<string, Slot> = {
  ring: { x: 88.5, y: 4, w: 9, ratio: "1 / 1", sx: 80, sy: 44, sw: 15 },
  square: { x: 22, y: 40, w: 11, ratio: "9 / 10", sx: 33, sy: 37, sw: 20 },
  hill: { x: 4, y: 34, w: 9, ratio: "2 / 1", sx: 62, sy: 70, sw: 24 },
};

const heroSlots = computed(() =>
  layout.map((slot, i) => {
    const album = albums.value[i];
    // 沒有相簿時，第一格用預設封面，其他格留空（顯示淺色底）
    const src = album ? album.coverLargeUrl : i === 0 ? coverImage : "";
    return { ...slot, album, src };
  })
);

const slotStyle = (s: Slot) => ({
  "--x": `${s.x}%`, "--y": `${s.y}%`, "--w": `${s.w}%`, "--ratio": s.ratio,
  "--sx": `${s.sx}%`, "--sy": `${s.sy}%`, "--sw": `${s.sw}%`,
});

// ===================== 載入 =====================
const preload = (urls: string[], timeout = 4000) =>
  Promise.race([
    Promise.all(
      urls.map(
        (u) =>
          new Promise<void>((r) => {
            const img = new Image();
            img.onload = img.onerror = () => r();
            img.src = u;
          })
      )
    ),
    new Promise((r) => setTimeout(r, timeout)),
  ]);

onMounted(async () => {
  try {
    albums.value = await getAlbums();
    loadingProgress.value = 85;
    // 封面照片先載入好再開場，動畫才不會出現空白
    await preload(heroSlots.value.map((s) => s.src).filter(Boolean));
  } catch (error) {
    console.error("取得相簿失敗:", error);
    errorMessage.value = error instanceof Error ? error.message : "取得相簿失敗";
  } finally {
    loadingProgress.value = 100;
    loading.value = false;
  }
  await nextTick();
  setupScrollEffects();

  // 照片牆在背景載入
  if (latest.value) {
    try {
      gallery.value = (await getAlbumPhotos(latest.value.id)).photos.slice(0, 9);
      await nextTick();
      setupGallery();
    } catch (error) {
      console.error("取得照片牆失敗:", error);
    }
  }
});

// ===================== GSAP 特效 =====================
const rootRef = ref<HTMLElement>();
const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const ctx = gsap.context(() => {});
onBeforeUnmount(() => ctx.revert());
let introPlayed = false;

// 進場前先藏起來（載入畫面蓋著，所以不會閃）
onMounted(() => {
  if (reduceMotion) return;
  ctx.add(() => {
    gsap.set(".hero__photo", { clipPath: "inset(100% 0% 0% 0%)" });
    gsap.set(".hero__shape", { opacity: 0 });
    gsap.set(".hero__news", { opacity: 0, y: 12 });
  });
});

// 載入畫面結束後：圖形浮現 → 照片由下往上揭開 → 標語打字
const playIntro = () => {
  if (introPlayed) return;
  introPlayed = true;
  ctx.add(() => {
    const texts = gsap.utils.toArray<HTMLElement>(".hero-line__text");
    const cursors = gsap.utils.toArray<HTMLElement>(".hero-line__cursor");

    if (reduceMotion) {
      texts.forEach((t, i) => (t.textContent = heroLines[i]));
      return;
    }

    const tl = gsap.timeline();
    tl.fromTo(
      ".hero__shape",
      { opacity: 0, scale: 0.6, rotate: -20 },
      { opacity: 1, scale: 1, rotate: 0, duration: 1.4, stagger: 0.15, ease: "expo.out" }
    );
    tl.to(
      ".hero__photo",
      { clipPath: "inset(0% 0% 0% 0%)", duration: 1.3, stagger: { each: 0.12, from: "random" }, ease: "power3.out" },
      0.1
    );
    tl.fromTo(
      ".hero__photo img",
      { scale: 1.35 },
      { scale: 1, duration: 1.8, stagger: { each: 0.12, from: "random" }, ease: "power3.out" },
      0.1
    );

    // 逐行打字，游標跟著目前那一行
    texts.forEach((text, i) => {
      tl.set(cursors[i], { opacity: 1 }, i === 0 ? 0.9 : undefined)
        .to(text, { text: heroLines[i], duration: heroLines[i].length * 0.12, ease: "none" })
        .set(cursors[i], { opacity: i === texts.length - 1 ? 1 : 0 }, "+=0.12");
    });
    tl.to(cursors[cursors.length - 1], { opacity: 0, duration: 0.5, repeat: -1, yoyo: true, ease: "steps(1)" });
    tl.to(".hero__news", { opacity: 1, y: 0, duration: 0.8, ease: "power2.out" }, "<");
  });
};

// 捲動效果：封面視差、文字逐行浮出、圖片揭開
const setupScrollEffects = () => {
  if (reduceMotion) return;
  ctx.add(() => {
    // 封面：每個元素用不同速度移動，做出前後層次
    gsap.utils.toArray<HTMLElement>(".hero__item").forEach((el) => {
      const speed = Number(el.dataset.speed || 0);
      gsap.to(el, {
        yPercent: speed,
        ease: "none",
        scrollTrigger: { trigger: ".hero", start: "top top", end: "bottom top", scrub: true },
      });
    });
    gsap.to(".hero__shape--ring svg", {
      rotate: 120,
      ease: "none",
      scrollTrigger: { trigger: ".hero", start: "top top", end: "bottom top", scrub: true },
    });

    // 跑馬燈：持續往左移動；捲動時跟著加速，往上捲時反向
    const track = document.querySelector<HTMLElement>(".marquee__track");
    if (track) {
      let x = 0;
      let direction = 1;
      let boost = 1;
      const wrap = gsap.utils.wrap(-50, 0); // 內容複製了兩份，移動一半就回到起點
      const tick = (_time: number, deltaMs: number) => {
        x = wrap(x - 0.0022 * deltaMs * direction * boost);
        gsap.set(track, { xPercent: x });
        boost += (1 - boost) * 0.05; // 慢慢回到正常速度
      };
      gsap.ticker.add(tick);
      ScrollTrigger.create({
        start: 0,
        end: "max",
        onUpdate: (self) => {
          direction = self.direction;
          boost = Math.min(1 + Math.abs(self.getVelocity()) / 300, 8);
        },
      });
      // ctx.revert() 時一起停掉
      ctx.add(() => () => gsap.ticker.remove(tick));
    }

    // 大字英文：捲動時微微橫移
    gsap.utils.toArray<HTMLElement>(".bg-word").forEach((word, i) => {
      gsap.fromTo(
        word,
        { xPercent: i % 2 ? 8 : -8 },
        {
          xPercent: i % 2 ? -8 : 8,
          ease: "none",
          scrollTrigger: { trigger: word.parentElement!, start: "top bottom", end: "bottom top", scrub: true },
        }
      );
    });

    // 數字從 0 往上跳
    gsap.utils.toArray<HTMLElement>(".stats__num[data-count]").forEach((el) => {
      const target = Number(el.dataset.count);
      if (!target) return;
      const counter = { value: 0 };
      el.textContent = "0";
      gsap.to(counter, {
        value: target,
        duration: 1.8,
        ease: "power3.out",
        scrollTrigger: { trigger: ".stats", start: "top 85%" },
        onUpdate: () => {
          el.textContent = Math.round(counter.value).toLocaleString();
        },
      });
    });
    gsap.from(".stats__item", {
      opacity: 0,
      y: 24,
      duration: 0.9,
      stagger: 0.12,
      ease: "power3.out",
      scrollTrigger: { trigger: ".stats", start: "top 85%" },
    });

    // 文字逐行從遮罩下方浮出
    gsap.utils.toArray<HTMLElement>(".about, .feature .section-head").forEach((block) => {
      gsap.fromTo(
        block.querySelectorAll(".mask-line > span"),
        { yPercent: 110 },
        {
          yPercent: 0,
          duration: 1.1,
          stagger: 0.1,
          ease: "power4.out",
          scrollTrigger: { trigger: block, start: "top 80%" },
        }
      );
    });

    // 最新相簿：圖片由下往上揭開＋縮回，文字依序浮現，捲動時圖片有視差
    gsap.utils.toArray<HTMLElement>(".feature__item").forEach((item) => {
      const visual = item.querySelector(".feature__visual")!;
      const img = visual.querySelector("img")!;
      const st = { trigger: item, start: "top 80%" };
      gsap.fromTo(visual, { clipPath: "inset(100% 0% 0% 0%)" }, { clipPath: "inset(0% 0% 0% 0%)", duration: 1.3, ease: "power3.out", scrollTrigger: st });
      gsap.fromTo(img, { scale: 1.35 }, { scale: 1.15, duration: 1.8, ease: "power3.out", scrollTrigger: st });
      gsap.fromTo(img, { yPercent: -6 }, {
        yPercent: 6,
        ease: "none",
        scrollTrigger: { trigger: item, start: "top bottom", end: "bottom top", scrub: true },
      });
      gsap.from(item.querySelectorAll(".feature__text > *"), {
        opacity: 0,
        y: 30,
        duration: 0.9,
        stagger: 0.08,
        ease: "power3.out",
        scrollTrigger: { trigger: item, start: "top 70%" },
      });
    });
    ScrollTrigger.refresh();
  });
};

// 照片牆：捲到時一張張揭開
const setupGallery = () => {
  if (reduceMotion) return;
  ctx.add(() => {
    gsap.fromTo(
      ".gallery .mask-line > span",
      { yPercent: 110 },
      { yPercent: 0, duration: 1.1, ease: "power4.out", scrollTrigger: { trigger: ".gallery", start: "top 80%" } }
    );
    const items = gsap.utils.toArray<HTMLElement>(".gallery__item");
    gsap.set(items, { clipPath: "inset(100% 0% 0% 0%)" });
    ScrollTrigger.batch(items, {
      start: "top 90%",
      once: true,
      onEnter: (batch) => {
        gsap.to(batch, { clipPath: "inset(0% 0% 0% 0%)", duration: 1.1, stagger: 0.1, ease: "power3.out" });
        gsap.fromTo(
          batch.map((el) => el.querySelector("img")),
          { scale: 1.3 },
          { scale: 1, duration: 1.5, stagger: 0.1, ease: "power3.out", clearProps: "transform" }
        );
      },
    });
    ScrollTrigger.refresh();
  });
};
</script>

<style scoped>
/* ===================== 封面 ===================== */
.hero {
  position: relative;
  padding-top: var(--header-height);
  min-height: 100svh;
  overflow: hidden;
}
.hero__stage {
  position: relative;
  width: min(100%, max((100svh - var(--header-height)) * 1440 / 780, 960px));
  aspect-ratio: 1440 / 780;
  margin-inline: auto;
}
.hero__item {
  position: absolute;
  left: var(--x);
  top: var(--y);
  width: var(--w);
  aspect-ratio: var(--ratio);
}
.hero__photo {
  z-index: 2;
  margin: 0;
  overflow: hidden;
  background: var(--color-bg-soft);
}
.hero__photo a,
.hero__photo img {
  display: block;
  width: 100%;
  height: 100%;
}
.hero__photo img {
  object-fit: cover;
  transition: filter 0.6s;
}
.hero__photo a:hover img {
  filter: brightness(1.08);
}
.hero__shape {
  z-index: 1;
  color: var(--color-accent);
}
.hero__shape svg {
  width: 100%;
  height: 100%;
  overflow: visible;
}
.hero__shape--square {
  background-color: var(--color-accent);
  background-image: var(--noise);
  background-blend-mode: multiply;
}
.hero__body {
  position: absolute;
  left: max(4.5%, 16px);
  bottom: 9%;
  z-index: 3;
}
.hero__catch {
  font-size: clamp(2rem, 4vw, 3.5rem);
  font-weight: 500;
  line-height: 1.45;
  letter-spacing: 0.04em;
}
.hero-line {
  position: relative;
  display: block;
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
  color: var(--color-primary);
}
.hero__news {
  position: absolute;
  right: max(4.5%, 16px);
  bottom: 10%;
  z-index: 3;
  display: none;
  flex-direction: column;
  gap: 8px;
  max-width: 320px;
  padding-left: 16px;
  border-left: 1px solid var(--color-text);
}
.hero__news-date {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 0.75rem;
}
.hero__news-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--color-primary);
}
.hero__news-title {
  font-size: 0.9375rem;
  transition: color 0.3s;
}
.hero__news:hover .hero__news-title {
  color: var(--color-primary);
}

@media (min-width: 768px) {
  .hero__news {
    display: flex;
  }
}

/* 手機：舞台變直的，用 s 開頭的位置 */
@media (max-width: 767px) {
  .hero__stage {
    width: 100%;
    aspect-ratio: 375 / 640;
  }
  .hero__item {
    left: var(--sx);
    top: var(--sy);
    width: var(--sw);
  }
  .hero__item--pc {
    display: none;
  }
  .hero__body {
    bottom: 4%;
  }
}

/* ===================== 共用 ===================== */
.mask-line {
  display: block;
  overflow: hidden;
  padding-bottom: 0.08em;
}
.mask-line > span {
  display: inline-block;
}
.label {
  font-size: 0.75rem;
  color: var(--color-primary);
}
.section-head {
  display: flex;
  align-items: baseline;
  gap: 16px;
  margin-bottom: clamp(24px, 3vw, 40px);
}
.section-head__title {
  font-size: clamp(1.5rem, 2.6vw, 2.25rem);
  font-weight: 500;
}
.section-head__en {
  font-size: 0.75rem;
  color: var(--color-primary);
}
.reveal-img {
  display: block;
  overflow: hidden;
}
.reveal-img img {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.arrow-link {
  display: inline-flex;
  gap: 10px;
  align-items: center;
  font-size: 0.9375rem;
  padding-bottom: 4px;
  border-bottom: 1px solid currentColor;
  transition: gap 0.3s, color 0.3s;
}
.arrow-link:hover {
  gap: 18px;
  color: var(--color-primary);
}
.pill-btn {
  display: inline-flex;
  align-items: center;
  gap: 14px;
  padding: 18px 40px;
  border-radius: 999px;
  background: var(--color-text);
  color: #fff;
  font-size: 0.9375rem;
  transition: background 0.3s;
}
.pill-btn .font-en {
  font-size: 0.6875rem;
  opacity: 0.7;
}
.pill-btn:hover {
  background: var(--color-primary);
}

/* ===================== 照片跑馬燈 ===================== */
.marquee {
  overflow: hidden;
  padding: clamp(24px, 3vw, 40px) 0 0;
}
.marquee__track {
  display: flex;
  align-items: center;
  gap: clamp(10px, 1.2vw, 18px);
  width: max-content;
  will-change: transform;
}
.marquee__item {
  height: clamp(120px, 15vw, 220px);
  margin: 0;
  overflow: hidden;
  background: var(--color-bg-soft);
  flex-shrink: 0;
}
/* 高低錯落 */
.marquee__item:nth-child(even) {
  transform: translateY(clamp(10px, 1.4vw, 24px));
}
.marquee__item img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

/* ===================== 大字英文背景 ===================== */
.about,
.feature,
.gallery {
  position: relative;
  overflow: hidden;
}
.bg-word {
  position: absolute;
  top: clamp(8px, 2vw, 32px);
  right: -2%;
  z-index: 0;
  font-size: clamp(72px, 15vw, 240px);
  font-weight: 500;
  line-height: 1;
  letter-spacing: 0.02em;
  color: var(--color-primary);
  opacity: 0.06;
  white-space: nowrap;
  pointer-events: none;
  user-select: none;
}
.feature .bg-word {
  right: auto;
  left: -2%;
}
.about__grid,
.feature > :not(.bg-word),
.gallery > :not(.bg-word) {
  position: relative;
  z-index: 1;
}

/* ===================== 文字區 ===================== */
.about {
  padding: clamp(64px, 9vw, 120px) clamp(20px, 6vw, 96px);
}
.about__grid {
  display: grid;
  gap: clamp(40px, 5vw, 72px);
  align-items: center;
}
@media (min-width: 900px) {
  .about__grid {
    grid-template-columns: 1fr auto;
  }
}
.about__title {
  margin: 16px 0 24px;
  font-size: clamp(1.75rem, 3.4vw, 3rem);
  font-weight: 500;
  line-height: 1.6;
}
.about__text {
  font-size: clamp(0.9375rem, 1.2vw, 1.0625rem);
  line-height: 2.2;
  color: #444;
}
/* 數字統計 */
.stats {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16px;
}
.stats__item {
  padding-top: 14px;
  border-top: 1px solid #d9dcd6;
}
.stats__label {
  font-size: 0.75rem;
  color: var(--color-muted);
}
.stats__value {
  display: flex;
  align-items: baseline;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 4px;
}
.stats__num {
  font-size: clamp(1.75rem, 3.6vw, 3.25rem);
  font-weight: 300;
  letter-spacing: 0;
  line-height: 1.1;
  font-variant-numeric: tabular-nums;
  color: var(--color-primary);
}
.stats__unit {
  font-size: 0.6875rem;
  color: var(--color-muted);
}
@media (min-width: 900px) {
  .stats {
    grid-template-columns: 1fr;
    min-width: 260px;
    gap: 24px;
  }
}
.about__error {
  margin-top: 32px;
  color: #c0392b;
}

/* ===================== 最新相簿 ===================== */
.feature {
  padding: clamp(40px, 5vw, 64px) clamp(20px, 6vw, 96px) clamp(64px, 8vw, 100px);
}
.feature__item {
  display: grid;
  gap: clamp(24px, 4vw, 56px);
  align-items: center;
  margin-bottom: clamp(48px, 6vw, 80px);
}
.feature__visual {
  aspect-ratio: 4 / 3;
}
.feature__visual img {
  transform: scale(1.15);
}
.feature__num {
  font-size: 0.875rem;
  color: var(--color-primary);
}
.feature__title {
  margin: 8px 0 12px;
  font-size: clamp(1.5rem, 2.4vw, 2.125rem);
  font-weight: 500;
}
.feature__meta {
  font-size: 0.75rem;
  color: var(--color-muted);
  margin-bottom: 20px;
}
.feature__desc {
  line-height: 2;
  color: #444;
  margin-bottom: 28px;
  white-space: pre-line;
}
.feature__more {
  text-align: center;
}
@media (min-width: 900px) {
  .feature__item {
    grid-template-columns: 7fr 5fr;
  }
  .feature__item--reverse {
    grid-template-columns: 5fr 7fr;
  }
  .feature__item--reverse .feature__visual {
    order: 2;
  }
}

/* ===================== 照片牆 ===================== */
.gallery {
  padding: clamp(56px, 7vw, 90px) clamp(20px, 6vw, 96px);
  background: var(--color-bg-soft);
}
.gallery__grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: clamp(8px, 1.4vw, 20px);
}
.gallery__item {
  aspect-ratio: 1 / 1;
}
.gallery__item--wide {
  grid-column: span 2;
  aspect-ratio: 2 / 1;
}
.gallery__item img {
  transition: transform 0.8s cubic-bezier(0.2, 0.8, 0.2, 1);
}
.gallery__item:hover img {
  transform: scale(1.06);
}
@media (min-width: 768px) {
  .gallery__grid {
    grid-template-columns: repeat(4, 1fr);
  }
}
</style>
