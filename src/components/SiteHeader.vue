<template>
  <header
    ref="headerRef"
    class="site-header"
    :class="{ 'is-solid': solid || drawerOpen }"
  >
    <router-link to="/home" class="site-header__logo" @click="closeDrawer">
      <img src="/OUOYO.svg" alt="" width="32" height="32" />
      <span class="font-en">OUOYO</span>
    </router-link>

    <!-- 桌機選單 -->
    <nav class="site-header__nav" aria-label="主選單">
      <router-link
        v-for="link in links"
        :key="link.to"
        :to="link.to"
        class="site-header__link"
        :class="{ 'is-active': isActive(link) }"
      >
        <span>{{ link.label }}</span>
        <span class="font-en">{{ link.en }}</span>
      </router-link>
      <button class="site-header__logout" @click="logout">登出</button>
    </nav>

    <!-- 手機漢堡按鈕 -->
    <button
      class="hamburger"
      :class="{ 'is-open': drawerOpen }"
      :aria-expanded="drawerOpen"
      aria-label="開啟 / 關閉選單"
      @click="toggleDrawer"
    >
      <span></span><span></span>
    </button>
  </header>

  <!-- 手機抽屜選單 -->
  <div v-show="drawerOpen" ref="drawerRef" class="drawer" data-lenis-prevent>
    <nav class="drawer__nav" aria-label="手機選單">
      <router-link
        v-for="link in links"
        :key="link.to"
        :to="link.to"
        class="drawer__link"
        @click="closeDrawer"
      >
        <span class="font-en drawer__en">{{ link.en }}</span>
        <span class="drawer__label">{{ link.label }}</span>
      </router-link>
      <button class="drawer__link drawer__logout" @click="logout">
        <span class="font-en drawer__en">Logout</span>
        <span class="drawer__label">登出</span>
      </button>
    </nav>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount, watch, nextTick } from "vue";
import { useRoute, useRouter } from "vue-router";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { lockScroll, unlockScroll } from "../animation/smoothScroll";

const route = useRoute();
const router = useRouter();
const links = [
  { to: "/home", label: "首頁", en: "Home", match: ["Home"] },
  { to: "/albums", label: "所有相簿", en: "Albums", match: ["Albums", "ShowPage"] },
];
const isActive = (link: (typeof links)[number]) =>
  link.match.includes(String(route.name));

const headerRef = ref<HTMLElement>();
const drawerRef = ref<HTMLElement>();
const drawerOpen = ref(false);
const scrolled = ref(false);
// 首頁封面上是透明的，捲動後或其他頁面是白底
const solid = computed(() => route.name !== "Home" || scrolled.value);

// 往下捲時藏起來，往上捲時出現
let trigger: ScrollTrigger | null = null;
onMounted(() => {
  trigger = ScrollTrigger.create({
    start: 0,
    end: "max",
    onUpdate: (self) => {
      scrolled.value = self.scroll() > 40;
      const hide = self.direction === 1 && self.scroll() > 200 && !drawerOpen.value;
      gsap.to(headerRef.value!, { yPercent: hide ? -100 : 0, duration: 0.4, ease: "power2.out", overwrite: true });
    },
  });
});
onBeforeUnmount(() => trigger?.kill());

// 換頁時讓導覽列出現
watch(
  () => route.fullPath,
  () => gsap.to(headerRef.value!, { yPercent: 0, duration: 0.3 })
);

const toggleDrawer = () => (drawerOpen.value ? closeDrawer() : openDrawer());

const openDrawer = async () => {
  drawerOpen.value = true;
  lockScroll();
  await nextTick();
  const el = drawerRef.value!;
  gsap.fromTo(el, { clipPath: "inset(0 0 100% 0)" }, { clipPath: "inset(0 0 0% 0)", duration: 0.6, ease: "power3.inOut" });
  gsap.fromTo(
    el.querySelectorAll(".drawer__link"),
    { y: 30, opacity: 0 },
    { y: 0, opacity: 1, duration: 0.6, stagger: 0.08, delay: 0.25, ease: "power3.out" }
  );
};

const closeDrawer = () => {
  if (!drawerOpen.value) return;
  gsap.to(drawerRef.value!, {
    clipPath: "inset(0 0 100% 0)",
    duration: 0.45,
    ease: "power3.inOut",
    onComplete: () => {
      drawerOpen.value = false;
      unlockScroll();
    },
  });
};

const logout = () => {
  closeDrawer();
  sessionStorage.removeItem("googleToken");
  router.push({ name: "Login" });
};
</script>

<style scoped>
.site-header {
  position: fixed;
  inset: 0 0 auto 0;
  z-index: 40;
  height: var(--header-height);
  padding: 0 clamp(16px, 4vw, 48px);
  display: flex;
  align-items: center;
  justify-content: space-between;
  transition: background-color 0.4s, box-shadow 0.4s;
}
.site-header.is-solid {
  background: rgba(255, 255, 255, 0.88);
  backdrop-filter: blur(10px);
  box-shadow: 0 1px 0 rgba(0, 0, 0, 0.06);
}
.site-header__logo {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 1.125rem;
  font-weight: 500;
}
.site-header__nav {
  display: none;
  align-items: center;
  gap: clamp(20px, 3vw, 44px);
}
.site-header__link {
  display: flex;
  flex-direction: column;
  align-items: center;
  font-size: 0.9375rem;
  line-height: 1.4;
  position: relative;
}
.site-header__link .font-en {
  font-size: 0.625rem;
  color: var(--color-muted);
}
/* 底線從中間展開 */
.site-header__link::after {
  content: "";
  position: absolute;
  left: 0;
  right: 0;
  bottom: -8px;
  height: 1px;
  background: var(--color-primary);
  transform: scaleX(0);
  transition: transform 0.4s cubic-bezier(0.2, 0.8, 0.2, 1);
}
.site-header__link:hover::after,
.site-header__link.is-active::after {
  transform: scaleX(1);
}
.site-header__link.is-active {
  color: var(--color-primary);
}
.site-header__logout {
  font-size: 0.8125rem;
  padding: 8px 18px;
  border: 1px solid currentColor;
  border-radius: 999px;
  transition: background 0.3s, color 0.3s;
}
.site-header__logout:hover {
  background: var(--color-text);
  color: #fff;
}

.hamburger {
  width: 44px;
  height: 44px;
  position: relative;
}
.hamburger span {
  position: absolute;
  left: 10px;
  right: 10px;
  height: 1.5px;
  background: currentColor;
  transition: transform 0.4s, top 0.4s;
}
.hamburger span:nth-child(1) {
  top: 17px;
}
.hamburger span:nth-child(2) {
  top: 26px;
}
.hamburger.is-open span:nth-child(1) {
  top: 21.5px;
  transform: rotate(25deg);
}
.hamburger.is-open span:nth-child(2) {
  top: 21.5px;
  transform: rotate(-25deg);
}

@media (min-width: 768px) {
  .site-header__nav {
    display: flex;
  }
  .hamburger {
    display: none;
  }
}

.drawer {
  position: fixed;
  inset: 0;
  z-index: 39;
  background: var(--color-bg-soft);
  padding: calc(var(--header-height) + 40px) 32px 40px;
}
.drawer__nav {
  display: flex;
  flex-direction: column;
  gap: 28px;
}
.drawer__link {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  text-align: left;
}
.drawer__en {
  font-size: 0.75rem;
  color: var(--color-primary);
}
.drawer__label {
  font-size: 1.75rem;
}
.drawer__logout .drawer__label {
  font-size: 1.125rem;
  color: var(--color-muted);
}
</style>
