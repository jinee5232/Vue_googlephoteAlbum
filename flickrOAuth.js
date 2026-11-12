// Flickr OAuth 1.0a 簽章（只在 server 端使用，Secret 不會進到前端）
// 文件：https://www.flickr.com/services/api/auth.oauth.html
import crypto from "node:crypto";

const REST_URL = "https://api.flickr.com/services/rest";
const UPLOAD_URL = "https://up.flickr.com/services/upload/";

const enc = (s) =>
  encodeURIComponent(String(s)).replace(
    /[!'()*]/g,
    (c) => "%" + c.charCodeAt(0).toString(16).toUpperCase()
  );

/**
 * 回傳加上 OAuth 參數與簽章後的所有參數
 * @param {"GET"|"POST"} httpMethod
 * @param {string} url
 * @param {Record<string,string>} params 一般參數（上傳時不含檔案本身）
 * @param {{ key: string, secret: string, token?: string, tokenSecret?: string }} creds
 */
export const signParams = (httpMethod, url, params, creds) => {
  const all = {
    ...params,
    oauth_consumer_key: creds.key,
    oauth_nonce: crypto.randomBytes(16).toString("hex"),
    oauth_signature_method: "HMAC-SHA1",
    oauth_timestamp: String(Math.floor(Date.now() / 1000)),
    oauth_version: "1.0",
  };
  if (creds.token) all.oauth_token = creds.token;

  const paramString = Object.keys(all)
    .sort()
    .map((k) => `${enc(k)}=${enc(all[k])}`)
    .join("&");
  const base = [httpMethod, enc(url), enc(paramString)].join("&");
  const signingKey = `${enc(creds.secret)}&${enc(creds.tokenSecret || "")}`;
  all.oauth_signature = crypto
    .createHmac("sha1", signingKey)
    .update(base)
    .digest("base64");
  return all;
};

/** 產生帶 OAuth 簽章的 GET 網址 */
export const signedUrl = (url, params, creds) =>
  `${url}?${new URLSearchParams(signParams("GET", url, params, creds))}`;

/**
 * 用授權過的帳號呼叫 Flickr REST API
 * 讀取用 GET，會修改資料的方法（建立、刪除相簿等）要用 POST
 */
export const callFlickr = async (method, params, creds, httpMethod = "GET") => {
  const all = { method, format: "json", nojsoncallback: "1", ...params };
  const res =
    httpMethod === "POST"
      ? await fetch(REST_URL, {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams(signParams("POST", REST_URL, all, creds)),
        })
      : await fetch(signedUrl(REST_URL, all, creds));
  if (!res.ok) throw new Error(`Flickr HTTP ${res.status}`);
  const data = await res.json();
  if (data.stat !== "ok") throw new Error(`Flickr 錯誤：${data.message}`);
  return data;
};

/**
 * 上傳一張照片，回傳 photo id
 * 文件：https://www.flickr.com/services/api/upload.api.html
 * @param {{ buffer: Buffer, filename: string, mimeType: string }} file
 * @param {Record<string,string>} params 例如 title、is_public
 */
export const uploadPhoto = async (file, params, creds) => {
  // 檔案本身不參與簽章，其他欄位都要
  const signed = signParams("POST", UPLOAD_URL, params, creds);
  const form = new FormData();
  for (const [k, v] of Object.entries(signed)) form.append(k, v);
  form.append(
    "photo",
    new Blob([file.buffer], { type: file.mimeType }),
    file.filename
  );

  const res = await fetch(UPLOAD_URL, { method: "POST", body: form });
  const text = await res.text();
  const id = /<photoid>(\d+)<\/photoid>/.exec(text)?.[1];
  if (!id) {
    const msg = /msg="([^"]*)"/.exec(text)?.[1] || `HTTP ${res.status}`;
    throw new Error(`Flickr 上傳失敗：${msg}`);
  }
  return id;
};
