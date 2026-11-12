import "dotenv/config";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";
import multer from "multer";
import heicConvert from "heic-convert";
import { callFlickr, uploadPhoto, signedUrl } from "./flickrOAuth.js";
import { extractHeicExif, insertExifIntoJpeg } from "./heicExif.js";

const app = express();
app.use(express.json());
app.use(function (req, res, next) {
  res.setHeader(
    "Content-Security-Policy",
    "script-src 'self' https://apis.google.com https://www.gstatic.com https://accounts.google.com 'unsafe-inline' 'unsafe-eval' blob: data:; frame-src 'self' https://accounts.google.com https://www.gstatic.com; object-src 'none';"
  );
  next();
});

app.use(function (req, res, next) {
  res.setHeader("Cross-Origin-Opener-Policy", "unsafe-none"); // 設置為 "unsafe-none"
  next();
});

const CLIENT_ID =
  "346003631691-imttb3pofls24ji64dir4nfk90mvka60.apps.googleusercontent.com";
// ===================== 私密相簿（Flickr） =====================
// Flickr 的授權只放在 server，前端拿不到；
// 每個請求都要帶 Google 登入 token，且 email 必須在白名單內：
//   EDITOR_EMAILS：可以看、上傳、建立 / 刪除相簿
//   VIEWER_EMAILS：只能看
// （舊的 ALLOWED_EMAILS 仍然有效，視為 EDITOR_EMAILS）
const FLICKR = {
  key: process.env.FLICKR_API_KEY,
  secret: process.env.FLICKR_API_SECRET,
  token: process.env.FLICKR_OAUTH_TOKEN,
  tokenSecret: process.env.FLICKR_OAUTH_TOKEN_SECRET,
};
const FLICKR_USER_ID = process.env.FLICKR_USER_ID;
const emailList = (value) =>
  (value || "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
const EDITOR_EMAILS = emailList(process.env.EDITOR_EMAILS || process.env.ALLOWED_EMAILS);
const VIEWER_EMAILS = emailList(process.env.VIEWER_EMAILS);
const roleOf = (email) =>
  EDITOR_EMAILS.includes(email) ? "editor" : VIEWER_EMAILS.includes(email) ? "viewer" : null;

if (Object.values(FLICKR).some((v) => !v) || !FLICKR_USER_ID) {
  console.warn("Flickr 設定不完整，請先執行 npm run flickr-auth 並填好 .env");
}
if (EDITOR_EMAILS.length === 0) {
  console.warn("EDITOR_EMAILS 是空的，沒有人可以管理相簿");
}

// 驗證 Google access token（快取 5 分鐘，避免每次都打 Google）
const tokenCache = new Map();
const requireLogin = async (req, res, next) => {
  const match = /^Bearer (.+)$/.exec(req.headers.authorization || "");
  if (!match) return res.status(401).json({ error: "請先登入" });
  const token = match[1];

  let entry = tokenCache.get(token);
  if (!entry || entry.until < Date.now()) {
    try {
      const r = await fetch(
        `https://oauth2.googleapis.com/tokeninfo?access_token=${encodeURIComponent(token)}`
      );
      if (!r.ok) return res.status(401).json({ error: "登入已過期" });
      const info = await r.json();
      // 確認 token 是發給這個網站的，而不是其他 App 的 token
      if (info.azp !== CLIENT_ID && info.aud !== CLIENT_ID) {
        return res.status(401).json({ error: "無效的登入" });
      }
      const ttl = Math.min(Number(info.expires_in) || 0, 300) * 1000;
      entry = {
        email: info.email_verified === "true" ? String(info.email).toLowerCase() : "",
        until: Date.now() + ttl,
      };
      tokenCache.set(token, entry);
    } catch (err) {
      console.error("驗證 Google token 失敗:", err.message);
      return res.status(502).json({ error: "無法驗證登入" });
    }
  }

  const role = roleOf(entry.email);
  if (!role) {
    return res.status(403).json({ error: "這個 Google 帳號沒有權限查看相簿" });
  }
  req.user = { email: entry.email, role };
  res.setHeader("Cache-Control", "private, no-store");
  next();
};

// 只有 EDITOR_EMAILS 的帳號可以上傳、建立 / 刪除相簿
const requireEditor = (req, res, next) =>
  req.user?.role === "editor"
    ? next()
    : res.status(403).json({ error: "你的帳號只能瀏覽，不能修改相簿" });

// 前端用來決定要不要顯示管理按鈕
app.get("/api/me", requireLogin, (req, res) => res.json(req.user));

app.get("/api/albums", requireLogin, async (req, res) => {
  try {
    const albums = [];
    let page = 1;
    let pages = 1;
    do {
      const data = await callFlickr(
        "flickr.photosets.getList",
        {
          user_id: FLICKR_USER_ID,
          page: String(page),
          per_page: "500",
          primary_photo_extras: "url_z,url_m,url_l",
        },
        FLICKR
      );
      for (const set of data.photosets.photoset) {
        const extras = set.primary_photo_extras || {};
        albums.push({
          id: set.id,
          title: set.title._content,
          photoCount: Number(set.photos) || 0,
          coverUrl: extras.url_z || extras.url_m || "",
          // 首頁封面用較大的尺寸（url_l 1024px）
          coverLargeUrl: extras.url_l || extras.url_z || extras.url_m || "",
          coverWidth: Number(extras.width_l || extras.width_z || extras.width_m) || 1,
          coverHeight: Number(extras.height_l || extras.height_z || extras.height_m) || 1,
          description: set.description?._content || "",
          createdAt: Number(set.date_create) * 1000 || 0,
        });
      }
      pages = Number(data.photosets.pages) || 1;
      page++;
    } while (page <= pages);
    res.json({ albums });
  } catch (err) {
    console.error("取得 Flickr 相簿失敗:", err.message);
    res.status(500).json({ error: "取得相簿失敗" });
  }
});

app.get("/api/albums/:id/photos", requireLogin, async (req, res) => {
  const page = Math.max(1, Number(req.query.page) || 1);
  try {
    const data = await callFlickr(
      "flickr.photosets.getPhotos",
      {
        photoset_id: req.params.id,
        user_id: FLICKR_USER_ID,
        page: String(page),
        per_page: "50",
        media: "all",
        extras: "url_m,url_z,url_l,url_k,date_taken,media",
      },
      FLICKR
    );
    const set = data.photoset;
    res.json({
      title: set.title,
      hasMore: page < (Number(set.pages) || 1),
      photos: set.photo.map((p) => {
        const thumbUrl = p.url_z || p.url_m;
        return {
          id: p.id,
          title: p.title,
          thumbUrl,
          largeUrl: p.url_k || p.url_l || thumbUrl,
          width: Number(p.width_z || p.width_m) || 1,
          height: Number(p.height_z || p.height_m) || 1,
          // 拍攝日期（Flickr 從 EXIF 讀取，格式 "2026-11-12 14:09:59"）
          dateTaken: p.datetakenunknown === "1" ? "" : p.datetaken || "",
          // 影片的 url_* 是預覽圖，播放網址另外用 /api/videos/:id 取得
          media: p.media === "video" ? "video" : "photo",
        };
      }),
    });
  } catch (err) {
    console.error("取得 Flickr 照片失敗:", err.message);
    res.status(500).json({ error: "取得照片失敗" });
  }
});

// ---- 上傳與相簿管理 ----
// 一次只收一個檔案（前端逐個上傳，才能顯示進度）。
// 先存成暫存檔（影片可能很大，不放記憶體），處理完自動刪除。
const MAX_IMAGE_MB = 100;
const MAX_VIDEO_MB = 500;
const upload = multer({
  storage: multer.diskStorage({ destination: os.tmpdir() }),
  limits: { fileSize: MAX_VIDEO_MB * 1024 * 1024 },
  // Windows 瀏覽器常把 HEIC / MOV 標成空白或 octet-stream，所以也用副檔名判斷
  fileFilter: (req, file, cb) =>
    cb(null, file.mimetype.startsWith("image/") || isHeic(file) || isVideo(file)),
});

// 請求結束時刪掉暫存檔
const cleanupUpload = (req, res, next) => {
  if (req.file?.path) {
    res.on("close", () => fs.unlink(req.file.path, () => {}));
  }
  next();
};

// multer 的錯誤（例如檔案太大）轉成看得懂的訊息
const handleUpload = (req, res, next) =>
  upload.single("photo")(req, res, (err) => {
    if (err?.code === "LIMIT_FILE_SIZE") {
      return res.status(413).json({ error: `檔案太大，影片最大 ${MAX_VIDEO_MB}MB、照片最大 ${MAX_IMAGE_MB}MB` });
    }
    if (err) return res.status(400).json({ error: err.message });
    cleanupUpload(req, res, next);
  });

const isHeic = (f) =>
  /^image\/hei[cf]/.test(f.mimetype) || /\.hei[cf]$/i.test(f.originalname);

const VIDEO_TYPES = {
  ".mp4": "video/mp4",
  ".m4v": "video/mp4",
  ".mov": "video/quicktime",
  ".avi": "video/x-msvideo",
  ".3gp": "video/3gpp",
  ".mpg": "video/mpeg",
  ".mpeg": "video/mpeg",
  ".ogv": "video/ogg",
  ".wmv": "video/x-ms-wmv",
};
const extOf = (name) => (name.match(/\.[^.]+$/) || [""])[0].toLowerCase();
const isVideo = (f) => f.mimetype.startsWith("video/") || extOf(f.originalname) in VIDEO_TYPES;

// 用檔案內容（不是副檔名）判斷實際格式。
// 很多 .heic 檔其實已經是 JPEG（例如從 iCloud、LINE 下載的），直接上傳即可。
const HEIC_BRANDS = ["heic", "heix", "heim", "heis", "hevc", "hevx", "hevm", "hevs", "mif1", "msf1"];
const sniff = (buf) => {
  if (buf[0] === 0xff && buf[1] === 0xd8) return { mime: "image/jpeg", ext: ".jpg" };
  if (buf.toString("latin1", 1, 4) === "PNG") return { mime: "image/png", ext: ".png" };
  if (buf.toString("latin1", 0, 3) === "GIF") return { mime: "image/gif", ext: ".gif" };
  if (buf.toString("latin1", 4, 8) === "ftyp") {
    const brand = buf.toString("latin1", 8, 12).replace(/\0/g, "").trim();
    return HEIC_BRANDS.includes(brand) ? { heic: true, brand } : { brand };
  }
  return null;
};

// multer 預設用 latin1 解讀檔名，中文檔名要轉回 UTF-8
// Flickr 不支援 HEIC（iPhone 照片），先轉成 JPEG
const fileOf = async (f) => {
  const filename = Buffer.from(f.originalname, "latin1").toString("utf8");

  // 影片：不轉檔，直接從暫存檔串流給 Flickr
  if (isVideo(f)) {
    const mimeType = f.mimetype.startsWith("video/")
      ? f.mimetype
      : VIDEO_TYPES[extOf(filename)] || "video/mp4";
    return { path: f.path, size: f.size, filename, mimeType };
  }

  if (f.size > MAX_IMAGE_MB * 1024 * 1024) {
    throw new Error(`「${filename}」太大了，照片最大 ${MAX_IMAGE_MB}MB`);
  }
  f.buffer = await fs.promises.readFile(f.path);
  if (!isHeic(f)) return { buffer: f.buffer, filename, mimeType: f.mimetype };

  const type = sniff(f.buffer);
  console.log(`收到 ${filename}，實際格式：${type?.mime || type?.brand || "未知"}`);

  // 名字是 .heic 但其實是 JPEG / PNG：直接上傳，順便把副檔名改對
  if (type?.mime) {
    return {
      buffer: f.buffer,
      filename: filename.replace(/\.hei[cf]$/i, type.ext),
      mimeType: type.mime,
    };
  }
  if (!type?.heic) {
    throw new Error(
      `「${filename}」不是有效的 HEIC 圖片（實際格式：${type?.brand || "無法辨識"}）`
    );
  }

  // heic-decode 只認得部分格式標記，其他 HEIC 標記改成 heic 讓它解碼
  let buffer = f.buffer;
  if (!["heic", "heix", "hevc", "hevx", "mif1", "msf1"].includes(type.brand)) {
    buffer = Buffer.from(f.buffer);
    buffer.write("heic", 8, "latin1");
  }
  const jpeg = Buffer.from(await heicConvert({ buffer, format: "JPEG", quality: 0.92 }));
  // 把拍攝日期、GPS 等 EXIF 搬過去，Flickr 才會用正確的拍攝日期
  const exif = extractHeicExif(f.buffer);
  if (!exif) console.log(`  ${filename} 沒有 EXIF，Flickr 會用上傳時間當拍攝日期`);
  return {
    buffer: exif ? insertExifIntoJpeg(jpeg, exif) : jpeg,
    filename: filename.replace(/\.hei[cf]$/i, ".jpg"),
    mimeType: "image/jpeg",
  };
};

// 上傳的照片、影片一律設成私密
const uploadPrivate = (file) =>
  uploadPhoto(
    file,
    {
      title: file.filename.replace(/\.[^.]+$/, ""),
      is_public: "0",
      is_friend: "0",
      is_family: "0",
      hidden: "2",
    },
    FLICKR
  );

const sendError = (res, label, err) => {
  console.error(`${label}:`, err.message);
  res.status(500).json({ error: `${label}：${err.message}` });
};

// 建立相簿：Flickr 規定相簿一定要有封面照片，所以建立時要附第一張照片
app.post("/api/albums", requireLogin, requireEditor, handleUpload, async (req, res) => {
  const title = String(req.body.title || "").trim();
  if (!title) return res.status(400).json({ error: "請輸入相簿名稱" });
  if (!req.file) return res.status(400).json({ error: "請至少選一張照片或影片" });
  try {
    const photoId = await uploadPrivate(await fileOf(req.file));
    const data = await callFlickr(
      "flickr.photosets.create",
      {
        title,
        description: String(req.body.description || ""),
        primary_photo_id: photoId,
      },
      FLICKR,
      "POST"
    );
    res.json({ id: data.photoset.id });
  } catch (err) {
    sendError(res, "建立相簿失敗", err);
  }
});

// 上傳照片到相簿
app.post("/api/albums/:id/photos", requireLogin, requireEditor, handleUpload, async (req, res) => {
  if (!req.file) return res.status(400).json({ error: "請選擇照片或影片" });
  try {
    const photoId = await uploadPrivate(await fileOf(req.file));
    await callFlickr(
      "flickr.photosets.addPhoto",
      { photoset_id: req.params.id, photo_id: photoId },
      FLICKR,
      "POST"
    );
    res.json({ id: photoId });
  } catch (err) {
    sendError(res, "上傳失敗", err);
  }
});

// 取得影片播放網址（Flickr 的 getSizes 會列出各種畫質的 MP4）
const VIDEO_PREFERENCE = ["1080p", "720p", "HD MP4", "Site MP4", "360p", "Mobile MP4", "Video Original"];
app.get("/api/videos/:id", requireLogin, async (req, res) => {
  try {
    const data = await callFlickr("flickr.photos.getSizes", { photo_id: req.params.id }, FLICKR);
    const sizes = (data.sizes?.size || []).filter((s) => s.media === "video");
    const best = VIDEO_PREFERENCE.map((label) => sizes.find((s) => s.label === label)).find(Boolean);
    if (!best) {
      return res.status(409).json({ error: "影片還在 Flickr 處理中，請過幾分鐘再試" });
    }
    // 私密影片的播放網址要用 OAuth 簽章開啟，Flickr 才會轉址到可播放的影片檔
    // （直接開會被影片主機拒絕 403）。轉址後的網址本身帶有時效簽章，瀏覽器可直接播放。
    const r = await fetch(signedUrl(best.source, {}, FLICKR), { redirect: "manual" });
    const url = r.headers.get("location");
    if (!url) throw new Error(`Flickr 沒有回傳影片網址（HTTP ${r.status}）`);
    res.json({ url, width: Number(best.width) || 0, height: Number(best.height) || 0 });
  } catch (err) {
    sendError(res, "取得影片失敗", err);
  }
});

// 刪除相簿（照片本身仍保留在 Flickr）
app.delete("/api/albums/:id", requireLogin, requireEditor, async (req, res) => {
  try {
    await callFlickr(
      "flickr.photosets.delete",
      { photoset_id: req.params.id },
      FLICKR,
      "POST"
    );
    res.json({ ok: true });
  } catch (err) {
    sendError(res, "刪除相簿失敗", err);
  }
});

// 從相簿移除照片（照片本身仍保留在 Flickr）
app.delete("/api/albums/:id/photos/:photoId", requireLogin, requireEditor, async (req, res) => {
  try {
    await callFlickr(
      "flickr.photosets.removePhoto",
      { photoset_id: req.params.id, photo_id: req.params.photoId },
      FLICKR,
      "POST"
    );
    res.json({ ok: true });
  } catch (err) {
    sendError(res, "移除照片失敗", err);
  }
});

// ===================== 正式環境：提供建置好的網頁 =====================
// 先執行 npm run build 產生 dist/，部署時只要跑 npm start 一個服務
const distDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "dist");
app.use("/api", (req, res) => res.status(404).json({ error: "Not found" }));
if (fs.existsSync(distDir)) {
  app.use(express.static(distDir, { index: false }));
  // Vue Router 使用 history 模式，所有非 /api 的網址都回傳 index.html
  app.get("*", (req, res) => res.sendFile(path.join(distDir, "index.html")));
}

const PORT = Number(process.env.PORT) || 4000;
const server = app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
// 影片上傳可能超過 Node 預設的 5 分鐘，放寬到 30 分鐘
server.requestTimeout = 30 * 60 * 1000;
