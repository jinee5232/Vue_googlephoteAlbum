// 一次性設定：授權網站讀寫你的 Flickr（讀私密照片、上傳、建立相簿）
// 執行：npm run flickr-auth
// 完成後把印出來的值貼進 .env
import "dotenv/config";
import readline from "node:readline/promises";
import { signedUrl } from "../flickrOAuth.js";

const key = process.env.FLICKR_API_KEY;
const secret = process.env.FLICKR_API_SECRET;
if (!key || !secret) {
  console.error("請先在 .env 填入 FLICKR_API_KEY 與 FLICKR_API_SECRET");
  process.exit(1);
}

const parse = async (res) => {
  const text = await res.text();
  if (!res.ok) throw new Error(`Flickr ${res.status}: ${text}`);
  return Object.fromEntries(new URLSearchParams(text));
};

// 1. 取得 request token（oob = 授權後在頁面上顯示驗證碼）
const request = await parse(
  await fetch(
    signedUrl(
      "https://www.flickr.com/services/oauth/request_token",
      { oauth_callback: "oob" },
      { key, secret }
    )
  )
);

// 2. 讓你在瀏覽器授權
console.log("\n請用瀏覽器打開以下網址並按「OK, I'll authorize it」：\n");
console.log(
  `https://www.flickr.com/services/oauth/authorize?oauth_token=${request.oauth_token}&perms=write\n`
);
const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const verifier = (await rl.question("貼上頁面顯示的驗證碼（例如 123-456-789）：")).trim();
rl.close();

// 3. 換成長期有效的 access token
const access = await parse(
  await fetch(
    signedUrl(
      "https://www.flickr.com/services/oauth/access_token",
      { oauth_verifier: verifier },
      {
        key,
        secret,
        token: request.oauth_token,
        tokenSecret: request.oauth_token_secret,
      }
    )
  )
);

console.log(`\n授權成功（${access.username}）！把下面三行貼進 .env：\n`);
console.log(`FLICKR_OAUTH_TOKEN=${access.oauth_token}`);
console.log(`FLICKR_OAUTH_TOKEN_SECRET=${access.oauth_token_secret}`);
console.log(`FLICKR_USER_ID=${access.user_nsid}\n`);
