<template>
  <div id="app">
    <SiteHeader v-if="route.name !== 'Login'" />
    <router-view />
  </div>
</template>

<script setup lang="ts">
import { watch, nextTick } from "vue";
import { useRoute } from "vue-router";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import SiteHeader from "./components/SiteHeader.vue";
import { resetScroll, unlockScroll } from "./animation/smoothScroll";

const route = useRoute();

// 換頁：回到頂端、解除捲動鎖定、重新計算捲動動畫的位置
watch(
  () => route.fullPath,
  async () => {
    unlockScroll();
    resetScroll();
    await nextTick();
    ScrollTrigger.refresh();
  }
);
</script>
