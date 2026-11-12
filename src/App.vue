<template>
  <div id="app">
    <router-view />
    <button v-if="isAuthenticated" @click="logout" class="logout-btn">登出</button>
  </div>
</template>

<script setup lang="ts">
import "./assets/gsap.css";
import { ref, watchEffect } from "vue";
import { useRouter } from "vue-router";
const router = useRouter();
const isAuthenticated = ref(false);

// 使用 watchEffect 確保在掛載後檢查登錄狀態
watchEffect(() => {
  const token = sessionStorage.getItem("googleToken");
  if (!token && router.currentRoute.value.name !== "Login") {
    // 如果沒有 token 且不是登入頁，跳轉到登入頁
    router.push({ name: "Login" });
  }
  if (token && router.currentRoute.value.name !== "Login") {
    isAuthenticated.value = true;
  }
});

const logout = () => {
  // 清除 token 並跳轉到登入頁
  isAuthenticated.value = false;
  sessionStorage.removeItem("googleToken");
  router.push({ name: "Login" });
};
</script>

<style>
.logout-btn {
  position: fixed;
  top: 20px;
  right: 20px;
  padding: 10px 20px;
  background-color: red;
  color: white;
  border: none;
  cursor: pointer;
}
</style>
