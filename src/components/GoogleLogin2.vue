<template>
  <div ref="rootRef" class="login">
    <!-- ===================== 左側：拼貼（跟首頁封面同風格） ===================== -->
    <div class="login__visual" aria-hidden="true">
      <div class="login__stage">
        <figure class="login__item login__photo login__photo--main" data-depth="14">
          <img :src="coverImage" alt="" />
        </figure>
        <figure class="login__item login__photo login__photo--sub" data-depth="24">
          <img :src="coverImage" alt="" />
        </figure>
        <div class="login__item login__shape login__shape--ring" data-depth="-30">
          <svg viewBox="0 0 100 100"><circle cx="50" cy="50" r="40" fill="none" stroke="currentColor" stroke-width="16" /></svg>
        </div>
        <div class="login__item login__shape login__shape--square" data-depth="-18"></div>
        <div class="login__item login__shape login__shape--hill" data-depth="10">
          <svg viewBox="0 0 100 50" preserveAspectRatio="none"><path d="M0 50 C 20 5, 80 5, 100 50 Z" fill="currentColor" /></svg>
        </div>
        <div class="login__item login__shape login__shape--dot" data-depth="-40"></div>
      </div>
    </div>

    <!-- ===================== 右側：登入 ===================== -->
    <main class="login__panel">
      <div class="login__panel-inner">
        <div class="login__brand reveal">
          <img src="/OUOYO.svg" alt="" width="36" height="36" />
          <span class="font-en">OUOYO</span>
        </div>

        <p class="login__en font-en reveal">Private Travel Albums</p>
        <h1 class="login__title">
          <span class="mask-line"><span>一緒に旅行を</span></span>
          <span class="mask-line"><span>楽しみましょう</span></span>
        </h1>
        <p class="login__lead reveal">
          這是私人相簿，請使用已授權的 Google 帳號登入。
        </p>

        <button class="login__button reveal" :disabled="signingIn" @click="login">
          <svg class="login__g" viewBox="0 0 48 48" aria-hidden="true">
            <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
            <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
            <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
            <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
          </svg>
          <span>{{ signingIn ? "登入中…" : "使用 Google 登入" }}</span>
        </button>

        <p v-if="errorMessage" class="login__error">{{ errorMessage }}</p>

        <p class="login__copy font-en reveal">© {{ year }} OUOYO</p>
      </div>
    </main>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount } from "vue";
import { useRouter } from "vue-router";
import { googleSdkLoaded } from "vue3-google-login";
import gsap from "gsap";
import coverImage from "../assets/cover.png";

const router = useRouter();
const year = new Date().getFullYear();
const signingIn = ref(false);
const errorMessage = ref("");

const login = () => {
  errorMessage.value = "";
  signingIn.value = true;
  googleSdkLoaded((google) => {
    const tokenClient = google.accounts.oauth2.initTokenClient({
      client_id:
        "346003631691-imttb3pofls24ji64dir4nfk90mvka60.apps.googleusercontent.com",
      // 照片從 Flickr 讀取，登入只用來驗證身分
      scope: "email profile openid",
      callback: (response) => {
        signingIn.value = false;
        if (response?.access_token) {
          // 注意：不要把 token 印到 Console，被看到就能拿去冒用身分
          sessionStorage.setItem("googleToken", response.access_token);
          leave();
        } else {
          errorMessage.value = "登入失敗，請再試一次。";
        }
      },
      // 使用者關掉登入視窗或被瀏覽器擋下
      error_callback: () => {
        signingIn.value = false;
        errorMessage.value = "登入視窗已關閉，請再試一次（若沒有跳出視窗，請允許此網站的彈出式視窗）。";
      },
    });
    tokenClient.requestAccessToken();
  });
};

// ===================== GSAP 特效 =====================
const rootRef = ref<HTMLElement>();
const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const ctx = gsap.context(() => {});
onBeforeUnmount(() => ctx.revert());

onMounted(() => {
  if (reduceMotion) return;
  ctx.add(() => {
    const tl = gsap.timeline({ defaults: { ease: "power3.out" } });
    tl.fromTo(
      ".login__shape",
      { opacity: 0, scale: 0.5, rotate: -25 },
      { opacity: 1, scale: 1, rotate: 0, duration: 1.4, stagger: 0.12, ease: "expo.out" }
    )
      .fromTo(
        ".login__photo",
        { clipPath: "inset(100% 0% 0% 0%)" },
        { clipPath: "inset(0% 0% 0% 0%)", duration: 1.3, stagger: 0.15 },
        0.15
      )
      .fromTo(".login__photo img", { scale: 1.35 }, { scale: 1, duration: 1.8, stagger: 0.15 }, 0.15)
      .fromTo(".login__title .mask-line > span", { yPercent: 110 }, { yPercent: 0, duration: 1.1, stagger: 0.12, ease: "power4.out" }, 0.4)
      .fromTo(".login__panel .reveal", { opacity: 0, y: 16 }, { opacity: 1, y: 0, duration: 0.8, stagger: 0.08 }, 0.6);

    // 圖形持續緩慢漂浮
    gsap.utils.toArray<HTMLElement>(".login__shape").forEach((el, i) => {
      gsap.to(el, {
        y: i % 2 ? 14 : -14,
        duration: 3 + i * 0.6,
        repeat: -1,
        yoyo: true,
        ease: "sine.inOut",
        delay: 1.5,
      });
    });
    gsap.to(".login__shape--ring svg", { rotate: 360, duration: 40, repeat: -1, ease: "none" });

    // 滑鼠移動時，拼貼依深度輕微位移（視差）
    const items = gsap.utils.toArray<HTMLElement>(".login__item");
    const movers = items.map((el) => ({
      depth: Number(el.dataset.depth || 0),
      x: gsap.quickTo(el, "x", { duration: 1.2, ease: "power3.out" }),
    }));
    const onMove = (e: PointerEvent) => {
      const dx = e.clientX / window.innerWidth - 0.5;
      movers.forEach((m) => m.x(dx * m.depth));
    };
    window.addEventListener("pointermove", onMove);
    return () => window.removeEventListener("pointermove", onMove);
  });
});

// 登入成功：內容淡出後進入首頁
const leave = () => {
  if (reduceMotion) return router.push({ name: "Home" });
  gsap.to(rootRef.value!, {
    opacity: 0,
    duration: 0.5,
    ease: "power2.in",
    onComplete: () => {
      router.push({ name: "Home" });
    },
  });
};
</script>

<style scoped>
.login {
  min-height: 100svh;
  display: grid;
  background: var(--color-bg);
  overflow: hidden;
}
@media (min-width: 900px) {
  .login {
    grid-template-columns: 1.15fr 1fr;
  }
}

/* ===================== 拼貼 ===================== */
.login__visual {
  position: relative;
  background: var(--color-bg-soft);
  min-height: 46svh;
}
/* 淡淡的顆粒質感 */
.login__visual::before {
  content: "";
  position: absolute;
  inset: 0;
  background-image: var(--noise);
  opacity: 0.35;
  mix-blend-mode: multiply;
  pointer-events: none;
}
.login__stage {
  position: absolute;
  inset: 0;
}
.login__item {
  position: absolute;
}
.login__photo {
  margin: 0;
  overflow: hidden;
  z-index: 2;
  box-shadow: 0 20px 50px rgba(31, 34, 33, 0.12);
}
.login__photo img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.login__photo--main {
  left: 18%;
  top: 14%;
  width: 52%;
  aspect-ratio: 3 / 4;
}
.login__photo--sub {
  left: 60%;
  top: 56%;
  width: 26%;
  aspect-ratio: 1 / 1;
}
.login__photo--sub img {
  object-position: 70% 40%;
  transform-origin: 70% 40%;
}
.login__shape {
  z-index: 1;
  color: var(--color-accent);
}
.login__shape svg {
  width: 100%;
  height: 100%;
}
.login__shape--ring {
  left: 64%;
  top: 8%;
  width: 18%;
  aspect-ratio: 1;
}
.login__shape--square {
  left: 8%;
  top: 58%;
  width: 20%;
  aspect-ratio: 9 / 10;
  background-color: var(--color-accent);
  background-image: var(--noise);
  background-blend-mode: multiply;
}
.login__shape--hill {
  left: 34%;
  bottom: 6%;
  width: 22%;
  aspect-ratio: 2 / 1;
}
.login__shape--dot {
  left: 8%;
  top: 10%;
  width: 6%;
  aspect-ratio: 1;
  border-radius: 50%;
  background: var(--color-primary);
  opacity: 0.85;
}

/* 手機：拼貼在上方，比例調整 */
@media (max-width: 899px) {
  .login__photo--main {
    left: 24%;
    top: 10%;
    width: 44%;
  }
  .login__photo--sub {
    left: 62%;
    top: 52%;
    width: 28%;
  }
  .login__shape--ring {
    left: 70%;
    top: 8%;
    width: 16%;
  }
}

/* ===================== 登入區 ===================== */
.login__panel {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: clamp(40px, 6vw, 96px) clamp(24px, 6vw, 88px);
}
.login__panel-inner {
  width: 100%;
  max-width: 420px;
}
.login__brand {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 1.125rem;
  font-weight: 500;
  margin-bottom: clamp(32px, 5vw, 64px);
}
.login__en {
  font-size: 0.75rem;
  color: var(--color-primary);
}
.login__title {
  margin: 10px 0 20px;
  font-size: clamp(1.875rem, 3.2vw, 2.75rem);
  font-weight: 500;
  line-height: 1.5;
  letter-spacing: 0.04em;
}
.mask-line {
  display: block;
  overflow: hidden;
  padding-bottom: 0.08em;
}
.mask-line > span {
  display: inline-block;
}
.login__lead {
  color: var(--color-muted);
  line-height: 1.9;
  font-size: 0.9375rem;
  margin-bottom: 36px;
}
.login__button {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 14px;
  padding: 16px 28px;
  border-radius: 999px;
  background: var(--color-text);
  color: #fff;
  font-size: 0.9375rem;
  transition: background 0.3s, transform 0.3s;
}
.login__button:hover:not(:disabled) {
  background: var(--color-primary);
  transform: translateY(-2px);
}
.login__button:disabled {
  opacity: 0.6;
  cursor: wait;
}
.login__g {
  width: 22px;
  height: 22px;
  padding: 3px;
  border-radius: 50%;
  background: #fff;
}
.login__error {
  margin-top: 16px;
  font-size: 0.8125rem;
  line-height: 1.7;
  color: #c0392b;
}
.login__copy {
  margin-top: clamp(40px, 6vw, 72px);
  font-size: 0.6875rem;
  color: var(--color-muted);
}
</style>
