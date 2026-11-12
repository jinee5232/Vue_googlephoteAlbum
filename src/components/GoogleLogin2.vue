<template>
  <div class="flex flex-col items-center justify-center h-screen bg-gray-100">
    <h1 class="text-3xl font-bold mb-4">Google 登入</h1>
    <button
      @click="login"
      class="px-6 py-3 text-white bg-blue-500 rounded hover:bg-blue-600"
    >
      使用 Google 登入
    </button>
  </div>
</template>

<script setup lang="ts">
import { nextTick } from "vue";
import { useRouter } from "vue-router";
import { googleSdkLoaded } from "vue3-google-login";

const router = useRouter();

const login = async () => {
  googleSdkLoaded((google) => {
    const tokenClient = google.accounts.oauth2.initTokenClient({
      client_id:
        "346003631691-imttb3pofls24ji64dir4nfk90mvka60.apps.googleusercontent.com",
      // 照片改從 Flickr 讀取，登入只用來驗證身分（photoslibrary 權限已被 Google 停用）
      scope: "email profile openid",
      callback: async (response) => {
        if (response?.access_token) {
          const token = response.access_token;
          console.log("Access Token:", token);

          // 儲存 token
          sessionStorage.setItem("googleToken", token);
          console.log("登入成功，token 已儲存:", token);

          // 跳轉到首頁
          await nextTick();
          router.push({ name: "Home" });
        } else {
          console.error("登入失敗，未獲取到 token");
        }
      },
    });
    tokenClient.requestAccessToken(); // 彈出登入視窗
  });
};
</script>
