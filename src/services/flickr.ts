// 相簿資料由 server.js 從 Flickr 讀取（可讀私密照片），
// 前端只帶 Google 登入 token，Flickr 的 Key / Secret 不會出現在這裡。

export interface Album {
  id: string;
  title: string;
  photoCount: number;
  coverUrl: string;
  coverLargeUrl: string;
  coverWidth: number;
  coverHeight: number;
  description: string;
  createdAt: number; // 毫秒
}

export interface Photo {
  id: string;
  title: string;
  thumbUrl: string; // 列表用（約 640px）
  largeUrl: string; // 放大用（最大 2048px）
  width: number;
  height: number;
  dateTaken: string; // "2026-11-12 14:09:59"，未知時為空字串
  media: "photo" | "video"; // 影片的 thumbUrl / largeUrl 是預覽圖
}

/** 取得影片播放網址 */
export const getVideoUrl = async (
  photoId: string
): Promise<{ url: string; width: number; height: number }> =>
  api(`/api/videos/${encodeURIComponent(photoId)}`);

/** "2026-11-12 14:09:59" → "2026年11月12日" */
export const formatDate = (s: string) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  return m ? `${m[1]}年${Number(m[2])}月${Number(m[3])}日` : "";
};

const api = async (path: string, init: RequestInit = {}) => {
  const token = sessionStorage.getItem("googleToken");
  const res = await fetch(path, {
    ...init,
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (res.status === 401) {
    // 登入過期：清掉 token 回登入頁
    sessionStorage.removeItem("googleToken");
    window.location.href = "/";
    throw new Error("登入已過期，請重新登入");
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
};

export interface Me {
  email: string;
  role: "editor" | "viewer";
}

// 同一個登入只問一次 server
let meCache: { token: string | null; promise: Promise<Me> } | null = null;
export const getMe = (): Promise<Me> => {
  const token = sessionStorage.getItem("googleToken");
  if (!meCache || meCache.token !== token) {
    const promise = api("/api/me") as Promise<Me>;
    promise.catch(() => (meCache = null));
    meCache = { token, promise };
  }
  return meCache.promise;
};

/** 是否可以上傳、建立 / 刪除相簿（只是用來隱藏按鈕，真正的檢查在 server） */
export const canEdit = async () => {
  try {
    return (await getMe()).role === "editor";
  } catch {
    return false;
  }
};

export const getAlbums = async (): Promise<Album[]> =>
  (await api("/api/albums")).albums;

export const getAlbumPhotos = async (
  albumId: string,
  page = 1
): Promise<{ title: string; photos: Photo[]; hasMore: boolean }> =>
  api(`/api/albums/${encodeURIComponent(albumId)}/photos?page=${page}`);

const photoForm = (file: File, extra: Record<string, string> = {}) => {
  const form = new FormData();
  for (const [k, v] of Object.entries(extra)) form.append(k, v);
  form.append("photo", file);
  return form;
};

/** 建立相簿（Flickr 規定要有封面，所以用第一張照片建立），回傳相簿 id */
export const createAlbum = async (
  title: string,
  description: string,
  firstPhoto: File
): Promise<string> =>
  (
    await api("/api/albums", {
      method: "POST",
      body: photoForm(firstPhoto, { title, description }),
    })
  ).id;

/** 上傳一張照片或一支影片到相簿（一律設為私密） */
export const uploadToAlbum = (albumId: string, file: File) =>
  api(`/api/albums/${encodeURIComponent(albumId)}/photos`, {
    method: "POST",
    body: photoForm(file),
  });

/** 逐張上傳，onProgress 回報已完成張數；回傳失敗的檔名 */
export const uploadMany = async (
  albumId: string,
  files: File[],
  onProgress: (done: number) => void
): Promise<string[]> => {
  const failed: string[] = [];
  for (let i = 0; i < files.length; i++) {
    try {
      await uploadToAlbum(albumId, files[i]);
    } catch (error) {
      console.error("上傳失敗:", files[i].name, error);
      failed.push(files[i].name);
    }
    onProgress(i + 1);
  }
  return failed;
};

/** 刪除相簿（照片仍保留在 Flickr） */
export const deleteAlbum = (albumId: string) =>
  api(`/api/albums/${encodeURIComponent(albumId)}`, { method: "DELETE" });

/** 從相簿移除照片（照片仍保留在 Flickr） */
export const removeFromAlbum = (albumId: string, photoId: string) =>
  api(
    `/api/albums/${encodeURIComponent(albumId)}/photos/${encodeURIComponent(photoId)}`,
    { method: "DELETE" }
  );
