/** LINE 分享卡：應援照疊入框圖中央透明區（對齊 LINE_BannerB_share_frame.png） */
const SHARE_FRAME_SRC = "/assets/line/LINE_BannerB_share_frame.png";

/** 框圖中央相片區（比例，可依設計稿微調） */
const PHOTO_RECT = { x: 0.055, y: 0.305, w: 0.89, h: 0.405 };

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`無法載入圖片：${src}`));
    img.src = src;
  });
}

/** 將 /img 或 localhost 圖址改為目前網域的絕對 HTTPS URL（ngrok + Vite proxy） */
export function resolvePhotoUrl(url: string): string {
  if (url.startsWith("/")) {
    return `${window.location.origin}${url}`;
  }
  try {
    const parsed = new URL(url);
    if (parsed.pathname.startsWith("/img/")) {
      return `${window.location.origin}${parsed.pathname}`;
    }
    return parsed.href;
  } catch {
    return url;
  }
}

function drawPhotoCover(
  ctx: CanvasRenderingContext2D,
  photo: HTMLImageElement,
  dx: number,
  dy: number,
  dw: number,
  dh: number,
) {
  const scale = Math.max(dw / photo.naturalWidth, dh / photo.naturalHeight);
  const sw = photo.naturalWidth * scale;
  const sh = photo.naturalHeight * scale;
  const ox = dx + (dw - sw) / 2;
  const oy = dy + (dh - sh) / 2;
  ctx.fillStyle = "#000";
  ctx.fillRect(dx, dy, dw, dh);
  ctx.drawImage(photo, ox, oy, sw, sh);
}

/** 合成分享用 PNG（應援照 + 框圖） */
export async function buildShareCardImage(photoUrl: string): Promise<Blob> {
  const frameSrc = resolvePhotoUrl(SHARE_FRAME_SRC);
  const photoSrc = resolvePhotoUrl(photoUrl);

  const [frame, photo] = await Promise.all([loadImage(frameSrc), loadImage(photoSrc)]);

  const canvas = document.createElement("canvas");
  canvas.width = frame.naturalWidth;
  canvas.height = frame.naturalHeight;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("無法建立 canvas");

  const dx = PHOTO_RECT.x * canvas.width;
  const dy = PHOTO_RECT.y * canvas.height;
  const dw = PHOTO_RECT.w * canvas.width;
  const dh = PHOTO_RECT.h * canvas.height;

  drawPhotoCover(ctx, photo, dx, dy, dw, dh);
  ctx.drawImage(frame, 0, 0);

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("分享圖合成失敗"))),
      "image/png",
    );
  });
}

export const SHARE_CARD_ASPECT_RATIO = "727:725";

/** 分享卡上傳 API 回傳的圖片 URL（與 resolvePhotoUrl 相同邏輯） */
export function resolveShareImageUrl(url: string): string {
  return resolvePhotoUrl(url);
}
