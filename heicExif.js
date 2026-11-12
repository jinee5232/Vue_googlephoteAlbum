// 把 HEIC 裡的 EXIF（拍攝日期、GPS、相機型號…）搬到轉好的 JPEG 裡。
// heic-convert 轉檔時會丟掉 EXIF，不處理的話 Flickr 會把上傳時間當成拍攝日期。
//
// HEIC 是 ISOBMFF 格式：meta 盒子裡的 iinf 記錄每個項目的類型（找 "Exif"），
// iloc 記錄項目資料在檔案中的位置。
// 規格：ISO/IEC 14496-12（ISOBMFF）、ISO/IEC 23008-12（HEIF）

const readBoxes = (buf, start, end) => {
  const boxes = [];
  let off = start;
  while (off + 8 <= end) {
    let size = buf.readUInt32BE(off);
    const type = buf.toString("latin1", off + 4, off + 8);
    let header = 8;
    if (size === 1) {
      size = Number(buf.readBigUInt64BE(off + 8));
      header = 16;
    } else if (size === 0) {
      size = end - off;
    }
    if (size < header || off + size > end) break;
    boxes.push({ type, start: off, content: off + header, end: off + size });
    off += size;
  }
  return boxes;
};

const readUInt = (buf, off, size) => {
  if (size === 0) return 0;
  if (size === 2) return buf.readUInt16BE(off);
  if (size === 4) return buf.readUInt32BE(off);
  if (size === 8) return Number(buf.readBigUInt64BE(off));
  throw new Error(`不支援的欄位長度 ${size}`);
};

// 在 iinf 裡找出類型是 "Exif" 的項目 ID
const findExifItemId = (buf, iinf) => {
  const version = buf[iinf.content];
  let off = iinf.content + 4;
  off += version === 0 ? 2 : 4; // entry_count
  for (const infe of readBoxes(buf, off, iinf.end)) {
    if (infe.type !== "infe") continue;
    const v = buf[infe.content];
    if (v < 2) continue;
    let p = infe.content + 4;
    const itemId = v === 2 ? buf.readUInt16BE(p) : buf.readUInt32BE(p);
    p += v === 2 ? 2 : 4;
    p += 2; // item_protection_index
    if (buf.toString("latin1", p, p + 4) === "Exif") return itemId;
  }
  return null;
};

// 在 iloc 裡找出項目資料的位置（可能分成好幾段）
const findItemExtents = (buf, iloc, itemId) => {
  const version = buf[iloc.content];
  let off = iloc.content + 4;
  const offsetSize = buf[off] >> 4;
  const lengthSize = buf[off] & 0x0f;
  const baseOffsetSize = buf[off + 1] >> 4;
  const indexSize = version === 1 || version === 2 ? buf[off + 1] & 0x0f : 0;
  off += 2;
  const itemCount = version < 2 ? buf.readUInt16BE(off) : buf.readUInt32BE(off);
  off += version < 2 ? 2 : 4;

  for (let i = 0; i < itemCount; i++) {
    const id = version < 2 ? buf.readUInt16BE(off) : buf.readUInt32BE(off);
    off += version < 2 ? 2 : 4;
    let constructionMethod = 0;
    if (version === 1 || version === 2) {
      constructionMethod = buf.readUInt16BE(off) & 0x0f;
      off += 2;
    }
    off += 2; // data_reference_index
    const baseOffset = readUInt(buf, off, baseOffsetSize);
    off += baseOffsetSize;
    const extentCount = buf.readUInt16BE(off);
    off += 2;
    const extents = [];
    for (let e = 0; e < extentCount; e++) {
      off += indexSize;
      const extentOffset = readUInt(buf, off, offsetSize);
      off += offsetSize;
      const extentLength = readUInt(buf, off, lengthSize);
      off += lengthSize;
      extents.push({ offset: baseOffset + extentOffset, length: extentLength });
    }
    // 只處理資料直接存在檔案裡的情況（construction_method 0）
    if (id === itemId) return constructionMethod === 0 ? extents : null;
  }
  return null;
};

/** 從 HEIC 取出 EXIF 的 TIFF 資料，找不到回傳 null */
export const extractHeicExif = (buf) => {
  try {
    const meta = readBoxes(buf, 0, buf.length).find((b) => b.type === "meta");
    if (!meta) return null;
    const children = readBoxes(buf, meta.content + 4, meta.end); // meta 是 FullBox
    const iinf = children.find((b) => b.type === "iinf");
    const iloc = children.find((b) => b.type === "iloc");
    if (!iinf || !iloc) return null;

    const itemId = findExifItemId(buf, iinf);
    if (itemId === null) return null;
    const extents = findItemExtents(buf, iloc, itemId);
    if (!extents?.length) return null;

    const data = Buffer.concat(
      extents.map((e) => buf.subarray(e.offset, e.offset + e.length))
    );
    // 前 4 bytes 是到 TIFF 標頭的位移，中間通常是 "Exif\0\0"
    const tiffStart = 4 + data.readUInt32BE(0);
    for (let i = tiffStart; i < Math.min(data.length - 4, tiffStart + 16); i++) {
      const sig = data.toString("latin1", i, i + 4);
      if (sig === "II*\0" || sig === "MM\0*") return Buffer.from(data.subarray(i));
    }
    return null;
  } catch {
    return null;
  }
};

// 轉檔時已經依照方向把畫面轉正了，所以要把 EXIF 的方向改成 1（正常），
// 不然瀏覽器會再轉一次，照片變成歪的
const resetOrientation = (tiff) => {
  const le = tiff.toString("latin1", 0, 2) === "II";
  const u16 = (o) => (le ? tiff.readUInt16LE(o) : tiff.readUInt16BE(o));
  const u32 = (o) => (le ? tiff.readUInt32LE(o) : tiff.readUInt32BE(o));
  const ifd0 = u32(4);
  if (ifd0 + 2 > tiff.length) return;
  const count = u16(ifd0);
  for (let i = 0; i < count; i++) {
    const entry = ifd0 + 2 + i * 12;
    if (entry + 12 > tiff.length) return;
    if (u16(entry) === 0x0112 && u16(entry + 2) === 3) {
      if (le) tiff.writeUInt16LE(1, entry + 8);
      else tiff.writeUInt16BE(1, entry + 8);
      return;
    }
  }
};

/** 把 EXIF 放進 JPEG（加在 SOI / JFIF 標頭後面） */
export const insertExifIntoJpeg = (jpeg, tiff) => {
  const exif = Buffer.from(tiff);
  resetOrientation(exif);
  const payload = Buffer.concat([Buffer.from("Exif\0\0", "latin1"), exif]);
  if (payload.length + 2 > 0xffff) return jpeg; // APP1 最大 64KB，太大就放棄

  const app1 = Buffer.alloc(4);
  app1.writeUInt16BE(0xffe1, 0);
  app1.writeUInt16BE(payload.length + 2, 2);

  // SOI 之後如果有 JFIF（APP0）就插在它後面
  let insertAt = 2;
  if (jpeg.readUInt16BE(2) === 0xffe0) insertAt = 4 + jpeg.readUInt16BE(4);
  return Buffer.concat([jpeg.subarray(0, insertAt), app1, payload, jpeg.subarray(insertAt)]);
};
