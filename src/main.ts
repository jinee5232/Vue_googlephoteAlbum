import vue3GoogleLogin from "vue3-google-login";
import { createApp } from "vue";
import App from "./App.vue";
import router from "./router";
import "./style.css";

const app = createApp(App);
app.use(vue3GoogleLogin, {
  clientId:
    "346003631691-imttb3pofls24ji64dir4nfk90mvka60.apps.googleusercontent.com",
});
app.use(router).mount("#app");
