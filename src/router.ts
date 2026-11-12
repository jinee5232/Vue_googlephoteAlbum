import { createRouter, createWebHistory } from "vue-router";
import GoogleLogin from "./components/GoogleLogin2.vue";
import HomePage from "./pages/index.vue";
import ShowPage from "./pages/ShowPage.vue";

const routes = [
  { path: "/", name: "Login", component: GoogleLogin },
  { path: "/home", name: "Home", component: HomePage }, // 啟用 props
  {
    path: "/show/:albumId",
    name: "ShowPage",
    component: ShowPage,
    props: true,
  },
];

const router = createRouter({
  history: createWebHistory(),
  routes,
});

// 全域導航守衛
router.beforeEach((to, _from, next) => {
  const token = sessionStorage.getItem("googleToken");

  if (to.name !== "Login" && !token) {
    // 如果未登入且不是登入頁，跳轉到登入頁
    next({ name: "Login" });
  } else {
    // 其他情況，正常放行
    next();
  }
});
export default router;
