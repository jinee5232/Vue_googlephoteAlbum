<template>
  <footer class="site-footer">
    <div class="site-footer__inner">
      <div>
        <router-link to="/home" class="site-footer__logo">
          <img src="/OUOYO.svg" alt="" width="40" height="40" />
          <span class="font-en">OUOYO</span>
        </router-link>
        <p class="site-footer__tagline">一緒に旅行を楽しみましょう</p>
      </div>
      <nav class="site-footer__nav" aria-label="頁尾選單">
        <router-link to="/home">首頁</router-link>
        <router-link to="/albums">所有相簿</router-link>
        <button type="button" class="font-en site-footer__top" @click="toTop">
          Page Top ↑
        </button>
      </nav>
    </div>
    <p class="site-footer__copy font-en">© {{ year }} OUOYO. All Rights Reserved.</p>
  </footer>
</template>

<script setup lang="ts">
import { lenis } from "../animation/smoothScroll";

const year = new Date().getFullYear();
const toTop = () => {
  if (lenis) lenis.scrollTo(0, { duration: 1.4 });
  else window.scrollTo({ top: 0, behavior: "smooth" });
};
</script>

<style scoped>
.site-footer {
  background: var(--color-footer);
  color: rgba(255, 255, 255, 0.85);
  padding: clamp(48px, 6vw, 72px) clamp(20px, 6vw, 80px) 28px;
}
.site-footer__inner {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  gap: 32px;
  padding-bottom: 36px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.12);
}
.site-footer__logo {
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 1.5rem;
  color: #fff;
}
.site-footer__logo img {
  filter: brightness(0) invert(1);
}
.site-footer__tagline {
  margin-top: 16px;
  font-size: 0.875rem;
  color: rgba(255, 255, 255, 0.6);
}
.site-footer__nav {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 14px;
  font-size: 0.9375rem;
}
.site-footer__nav a:hover,
.site-footer__top:hover {
  color: #fff;
}
.site-footer__top {
  margin-top: 8px;
  font-size: 0.75rem;
  color: rgba(255, 255, 255, 0.6);
}
.site-footer__copy {
  padding-top: 24px;
  font-size: 0.6875rem;
  color: rgba(255, 255, 255, 0.45);
}
</style>
