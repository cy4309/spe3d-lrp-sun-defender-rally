import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import CloseButton from "@/components/CloseButton";
import Signboard from "@/components/Signboard";
import { useAuth } from "@/contexts/AuthContext";
import { ApiError, apiPostForm } from "@/lib/api";

const A = {
  bg: "/assets/upload-gen-page/pic_genAI_bg_1.png",
  bgCover: "/assets/upload-gen-page/pic_genAI_bg_cover.png",
  logo: "/assets/landing-page-home/lp_logo.png",
  title: "/assets/upload-gen-page/upload_subject.png",
  frame: "/assets/upload-gen-page/pic_genAI_frame.png",
  frameLine: "/assets/upload-gen-page/pic_genAI_frame_faceline.png",
  sample: "/assets/upload-gen-page/pic_genAI_sample.png",
} as const;

const MAX_BYTES = 10 * 1024 * 1024;
const MIN_EDGE_PX = 720;

const INSTRUCTIONS = [
  { text: "請提供個人正面照片", hasExample: true },
  { text: "確保臉部清晰且環境光線充足" },
  { text: "避免遮蔽臉部（如帽子、口罩、墨鏡等）" },
] as const;

async function validateImage(file: File): Promise<string | null> {
  if (!["image/jpeg", "image/png"].includes(file.type)) return "請上傳 JPG 或 PNG 圖片";
  if (file.size > MAX_BYTES) return "圖片過大（上限 10 MB），請重新選擇";
  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const min = Math.min(img.naturalWidth, img.naturalHeight);
      resolve(min < MIN_EDGE_PX ? `請上傳至少 ${MIN_EDGE_PX}px 的圖片（目前最短邊：${min}px）` : null);
    };
    img.onerror = () => { URL.revokeObjectURL(url); resolve("無法讀取圖片，請換一張"); };
    img.src = url;
  });
}

function AssetImg({ src, alt, className }: { src: string; alt: string; className?: string }) {
  const [failed, setFailed] = useState(false);
  if (failed) return null;
  return <img src={src} alt={alt} className={className} onError={() => setFailed(true)} />;
}

function SlantedDashes() {
  return (
    <div className="flex items-center justify-center gap-[5px] py-3 overflow-hidden" aria-hidden>
      {Array.from({ length: 14 }).map((_, i) => (
        <span key={i} className="block h-[3px] w-4 rounded-sm bg-blue-900 -skew-x-[28deg]" />
      ))}
    </div>
  );
}

export default function UploadPage() {
  const auth = useAuth();
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [agreed, setAgreed] = useState(false);
  const [showSample, setShowSample] = useState(false);

  const isMock = auth.phase === "mock";
  const userCampaignId = auth.phase === "ready" ? auth.userCampaign.id : "mock-uc-id";

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setError(null);
    const err = await validateImage(f);
    if (err) { setError(err); return; }
    setFile(f);
    setPreview(URL.createObjectURL(f));
  }

  function clearFile() {
    if (preview) URL.revokeObjectURL(preview);
    setFile(null);
    setPreview(null);
    setError(null);
    if (inputRef.current) inputRef.current.value = "";
  }

  async function handleUpload() {
    if ((!file && !isMock) || !agreed) return;
    setUploading(true);
    try {
      if (isMock) {
        await new Promise((r) => setTimeout(r, 800));
        navigate("/processing/mock-job-id");
        return;
      }
      const form = new FormData();
      form.append("image", file!);
      form.append("user_campaign_id", userCampaignId);
      const data = await apiPostForm<{ job_id: string }>("/api/v1/jobs", form);
      navigate(`/processing/${data.job_id}`);
    } catch (e) {
      if (e instanceof ApiError && e.code === "job_already_in_progress") {
        navigate("/result");
        return;
      }
      setError(e instanceof ApiError ? e.message : "上傳失敗，請稍後再試");
    } finally {
      setUploading(false);
    }
  }

  function open(capture?: boolean) {
    if (!inputRef.current) return;
    if (capture) inputRef.current.setAttribute("capture", "environment");
    else inputRef.current.removeAttribute("capture");
    inputRef.current.click();
  }

  const canSubmit = (file || isMock) && agreed && !uploading;

  return (
    <div className="relative min-h-dvh overflow-x-hidden mx-auto max-w-mobile">
      {/* Background */}
      <div className="absolute inset-0 z-0 bg-gradient-to-b from-sky-400 via-blue-500 to-blue-900" />
      <AssetImg
        src={A.bg}
        alt=""
        className="absolute inset-0 z-0 h-full w-full object-cover object-top"
      />

      <div className="relative z-10 flex min-h-dvh flex-col px-4 pb-32">
        {/* Logo */}
        <div className="pt-4 pb-2">
          <AssetImg src={A.logo} alt="LA ROCHE-POSAY 理膚寶水" className="h-7 w-auto object-contain object-left" />
        </div>

        {/* Title image */}
        <div className="mb-4">
          <AssetImg
            src={A.title}
            alt="製作我的專屬應援人物 領取夏日防曬組"
            className="w-[85%] max-w-[320px]"
          />
        </div>

        {/* Signboard */}
        <Signboard className="mb-2">
          <div className="px-4 pb-5 pt-4">
            <p className="text-center text-[15px] font-bold leading-snug text-gray-900">
              請選擇自拍或上傳一張照片
            </p>

            <SlantedDashes />

            <input
              ref={inputRef}
              type="file"
              accept="image/jpeg,image/png"
              className="hidden"
              onChange={handleFileChange}
            />

            {/* Photo area */}
            <div className="relative mx-auto mb-4 w-full max-w-[280px]">
              {preview ? (
                <>
                  <div className="aspect-[4/5] overflow-hidden rounded-2xl bg-gray-100">
                    <img src={preview} alt="預覽" className="h-full w-full object-cover" />
                  </div>
                  {/* Frame overlay */}
                  <img
                    src={A.frame}
                    alt=""
                    className="pointer-events-none absolute inset-0 w-full h-full"
                  />
                  <CloseButton onClick={clearFile} label="移除照片" className="absolute -right-2 -top-2 z-10" />
                </>
              ) : (
                <button
                  type="button"
                  onClick={() => open(false)}
                  className="relative mx-auto flex aspect-[4/5] w-full flex-col items-center justify-center gap-3 overflow-hidden rounded-2xl border-2 border-dashed border-blue-300 bg-blue-50"
                >
                  {/* Dashed face outline overlay */}
                  <img
                    src={A.frameLine}
                    alt=""
                    className="pointer-events-none absolute inset-0 w-full h-full object-contain opacity-40"
                  />
                  <span className="relative z-10 flex h-16 w-16 items-center justify-center rounded-full bg-blue-100 text-3xl text-blue-300">
                    👤
                  </span>
                  <span className="relative z-10 text-sm font-medium text-blue-500">點此選擇照片</span>
                  <span className="relative z-10 px-6 text-center text-[11px] text-blue-300">
                    JPG / PNG，最短邊 ≥ 720px，10 MB 以內
                  </span>
                  <span className="relative z-10 flex gap-2">
                    <span
                      role="button"
                      tabIndex={0}
                      onClick={(e) => { e.stopPropagation(); open(true); }}
                      onKeyDown={(e) => e.key === "Enter" && (e.stopPropagation(), open(true))}
                      className="rounded-full border border-brand-blue px-4 py-2 text-xs font-semibold text-brand-blue bg-white"
                    >
                      拍照
                    </span>
                    <span
                      role="button"
                      tabIndex={0}
                      onClick={(e) => { e.stopPropagation(); open(false); }}
                      onKeyDown={(e) => e.key === "Enter" && (e.stopPropagation(), open(false))}
                      className="rounded-full bg-brand-blue px-4 py-2 text-xs font-semibold text-white"
                    >
                      從相簿選擇
                    </span>
                  </span>
                </button>
              )}
            </div>

            {/* Instructions */}
            <div className="mb-4 rounded-xl bg-blue-900 px-3.5 py-4">
              <ul className="space-y-3.5">
                {INSTRUCTIONS.map((item, i) => (
                  <li key={i} className="flex gap-3">
                    <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white text-sm font-black text-brand-orange">
                      {i + 1}
                    </span>
                    <div className="min-w-0 flex-1 pt-0.5">
                      <p className="text-[13px] font-medium leading-snug text-white">
                        {item.text}
                        {"hasExample" in item && item.hasExample && (
                          <button
                            type="button"
                            onClick={() => setShowSample(true)}
                            className="ml-1.5 inline-flex items-center gap-0.5 rounded border border-white/40 bg-white/10 px-2 py-0.5 text-[11px] font-normal text-white align-middle"
                          >
                            🖼 查看範例
                          </button>
                        )}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            </div>

            {/* Consent */}
            <label className="mb-1 flex cursor-pointer items-start gap-2.5">
              <input
                type="checkbox"
                checked={agreed}
                onChange={(e) => setAgreed(e.target.checked)}
                className="upload-checkbox mt-0.5 shrink-0"
              />
              <span className="text-[12px] leading-relaxed text-gray-800">
                我已閱讀並同意{" "}
                <a href="#" className="underline" onClick={(e) => e.preventDefault()}>
                  隱私權政策
                </a>{" "}
                與{" "}
                <a href="#" className="underline" onClick={(e) => e.preventDefault()}>
                  使用條款
                </a>
                。
              </span>
            </label>
            <p className="mb-4 text-center text-[11px] text-brand-orange">
              （請先同意使用條款才能繼續）
            </p>

            {error && <p className="mb-3 text-center text-xs text-red-600">{error}</p>}

            <button
              type="button"
              onClick={() => void handleUpload()}
              disabled={!canSubmit}
              className="upload-cta w-full disabled:cursor-not-allowed disabled:opacity-45"
            >
              {uploading ? "上傳中…" : "開始製作"}
            </button>
          </div>
        </Signboard>

        {/* Footer */}
        <footer className="mt-auto pt-4 text-center">
          <p className="text-[11px] leading-relaxed text-white drop-shadow-sm">
            ★活動期間：2026/7/3 00時00分 至 2026/8/23 23點59分★
          </p>
          <p className="mt-1 text-[10px] leading-relaxed text-white/80 drop-shadow-sm">
            *活動詳情與注意事項請參閱{" "}
            <a href="#" className="text-yellow-300 underline" onClick={(e) => e.preventDefault()}>
              活動辦法
            </a>
            。
          </p>
        </footer>
      </div>

      {/* Bottom foreground overlay (cap / baseball / glove) */}
      <AssetImg
        src={A.bgCover}
        alt=""
        className="pointer-events-none absolute bottom-0 left-0 right-0 z-20 w-full"
      />

      {/* Sample photo popup */}
      {showSample && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-6"
          onClick={() => setShowSample(false)}
        >
          <div className="relative w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
            <img src={A.sample} alt="照片範例" className="w-full rounded-2xl shadow-2xl" />
            <CloseButton
              onClick={() => setShowSample(false)}
              label="關閉範例"
              className="absolute -right-3 -top-3"
            />
          </div>
        </div>
      )}
    </div>
  );
}
