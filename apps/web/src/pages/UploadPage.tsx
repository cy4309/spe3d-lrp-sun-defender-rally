import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import ActivityRulesPopup from "@/components/ActivityRulesPopup";
import CloseButton from "@/components/CloseButton";
import CtaPrimaryButton from "@/components/CtaPrimaryButton";
import PrivacyPolicyPopup from "@/components/PrivacyPolicyPopup";
import TermsOfServicePopup from "@/components/TermsOfServicePopup";
import ModalOverlay from "@/components/ModalOverlay";
import Signboard, { SIGNBOARD_BORDER_GRADIENT } from "@/components/Signboard";
import SlantedBorder from "@/components/SlantedBorder";
import { useAuth } from "@/contexts/AuthContext";
import { ApiError, apiPostForm } from "@/lib/api";
import { logMockPostForm } from "@/lib/mockApi";

const A = {
  bg: "/assets/upload-gen-page/pic_genAI_bg_1.png",
  bgCover: "/assets/upload-gen-page/pic_genAI_bg_cover.png",
  logo: "/assets/landing-page-home/lp_logo.png",
  title: "/assets/upload-gen-page/upload_subject.png",
  frameLine: "/assets/upload-gen-page/pic_genAI_frame_faceline.png",
  sample: "/assets/upload-gen-page/pic_genAI_sample.png",
  instruction: "/assets/upload-gen-page/instruction.png",
  baseball: "/assets/landing-page-home/landing-page_home_icon_baseball.png",
} as const;

const MAX_BYTES = 10 * 1024 * 1024;
const MIN_EDGE_PX = 720;

const INSTRUCTIONS = [{ text: "請提供單人正面照片。", hasExample: true }, { text: "確保臉部清晰且環境光線充足。" }, { text: "避免遮蔽臉部(如帽子、口罩、墨鏡等)。" }] as const;

const IMAGE_MIME = new Set(["image/jpeg", "image/png", "image/jpg", "image/heic", "image/heif", "image/webp"]);
const IMAGE_EXT = /\.(jpe?g|png|heic|heif|webp)$/i;

function isAllowedImageFile(file: File): boolean {
  if (file.type && IMAGE_MIME.has(file.type)) return true;
  return IMAGE_EXT.test(file.name);
}

async function validateImage(file: File): Promise<string | null> {
  if (!isAllowedImageFile(file)) return "請上傳 JPG 或 PNG 圖片";
  if (file.size > MAX_BYTES) return "圖片過大（上限 10 MB），請重新選擇";
  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const min = Math.min(img.naturalWidth, img.naturalHeight);
      resolve(min < MIN_EDGE_PX ? `請上傳至少 ${MIN_EDGE_PX}px 的圖片（目前最短邊：${min}px）` : null);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve("無法讀取圖片，請換一張");
    };
    img.src = url;
  });
}

function AssetImg({ src, alt, className }: { src: string; alt: string; className?: string }) {
  const [failed, setFailed] = useState(false);
  if (failed) return null;
  return <img src={src} alt={alt} className={className} onError={() => setFailed(true)} />;
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
  const [showInstruction, setShowInstruction] = useState(false);
  const [showRules, setShowRules] = useState(false);
  const [showPrivacy, setShowPrivacy] = useState(false);
  const [showTerms, setShowTerms] = useState(false);

  const isMock = auth.phase === "mock";
  const userCampaignId = auth.phase === "ready" ? auth.userCampaign.id : "mock-uc-id";

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setError(null);
    if (preview) URL.revokeObjectURL(preview);
    const err = await validateImage(f);
    if (err) {
      setError(err);
      setFile(null);
      setPreview(null);
      if (inputRef.current) inputRef.current.value = "";
      return;
    }
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
        const data = logMockPostForm(
          "/api/v1/jobs",
          {
            image: file?.name ?? "(mock 無檔案)",
            user_campaign_id: userCampaignId,
          },
          { job_id: "mock-job-id", status: "queued", polling_interval_ms: 2000 },
        );
        navigate(`/processing/${data.job_id}`);
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

  function openPicker() {
    inputRef.current?.click();
  }

  const canSubmit = (file || isMock) && agreed && !uploading;

  return (
    <div className="relative min-h-dvh overflow-x-hidden mx-auto max-w-mobile">
      {/* Background */}
      <div className="absolute inset-0 z-0 bg-gradient-to-b from-sky-400 via-blue-500 to-blue-900" />
      <AssetImg src={A.bg} alt="" className="absolute inset-0 z-0 h-full w-full object-cover object-top" />

      <div className="relative z-10 flex min-h-dvh flex-col px-8 pb-32">
        {/* Logo */}
        <div className="pb-2 absolute top-0">
          <AssetImg src={A.logo} alt="LA ROCHE-POSAY 理膚寶水" className="h-7 w-auto object-contain object-left" />
        </div>

        {/* Title image */}
        <div className="w-full">
          <AssetImg src={A.title} alt="製作我的專屬應援人物 領取夏日防曬組" className="mx-auto w-full" />
        </div>

        {/* Signboard + CTA（按鈕在卡片外、略重疊底部，對齊 UI） */}
        <div className="relative mb-8">
          <div className="relative">
            <AssetImg src={A.sample} alt="" aria-hidden className="pointer-events-none z-20 absolute -right-4 -top-16 sm:-top-20 w-[120px] sm:w-[160px] object-contain drop-shadow-md" />
            <Signboard className="mb-0">
              <div className="px-8 pb-4 pt-4">
                <p className="text-center text-xl font-bold leading-snug text-brand-blue">請選擇自拍或上傳一張照片</p>

                <SlantedBorder className="py-3" />

                <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/heic,image/heif,.heic,.heif,.jpg,.jpeg,.png" className="hidden" onChange={handleFileChange} />

                {/* Photo area */}
                <div className="relative mx-auto mb-4 w-full max-w-[300px]">
                  {preview ? (
                    <div className="w-full rounded-2xl p-[3px]" style={{ background: SIGNBOARD_BORDER_GRADIENT }}>
                      <div className="relative aspect-[4/5] w-full overflow-hidden rounded-[14px] bg-brand-blue">
                        <img src={preview} alt="預覽" className="absolute inset-0 h-full w-full object-cover" />
                        <CloseButton onClick={clearFile} label="移除照片" variant="preview" />
                      </div>
                    </div>
                  ) : (
                    <button type="button" onClick={openPicker} className="upload-dropzone relative mx-auto flex aspect-[4/5] w-full flex-col items-center justify-center overflow-hidden rounded-2xl bg-brand-blue active:opacity-90">
                      <img src={A.frameLine} alt="" className="pointer-events-none absolute inset-0 h-full w-full object-contain p-3 brightness-0 invert opacity-90" aria-hidden />
                      <span className="relative z-10 -mt-2 text-[56px] font-light leading-none text-white">+</span>
                      <span className="relative z-10 -mt-1 text-[13px] font-bold tracking-wide text-white">點擊上傳</span>
                    </button>
                  )}
                </div>

                {/* Instructions */}
                <div className="mb-4 rounded-2xl bg-brand-blue px-3.5 py-4">
                  <ul className="space-y-3.5">
                    {INSTRUCTIONS.map((item, i) => (
                      <li key={i} className="flex gap-3">
                        <span className="home-step-badge mt-0.5 shrink-0" aria-hidden>
                          <img src={A.baseball} alt="" className="home-step-badge__icon" />
                          <span className="home-step-badge__num">{i + 1}</span>
                        </span>
                        <div className="min-w-0 flex-1 pt-0.5">
                          {"hasExample" in item && item.hasExample ? (
                            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                              <p className="text-[13px] font-medium leading-snug text-white">{item.text}</p>
                              <button type="button" onClick={() => setShowInstruction(true)} className="inline-flex shrink-0 items-center gap-1 rounded-full border border-white/50 bg-brand-blue px-2.5 py-1 text-[11px] font-normal text-white">
                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5 shrink-0" aria-hidden>
                                  <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                                  <circle cx="8.5" cy="8.5" r="1.5" fill="currentColor" stroke="none" />
                                  <path d="m21 15-5-5L5 21" />
                                </svg>
                                查看範例
                              </button>
                            </div>
                          ) : (
                            <p className="text-[13px] font-medium leading-snug text-white">{item.text}</p>
                          )}
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Consent（置中、收窄，避免被左下帽子圖擋住） */}
                <div className="mx-auto flex w-full max-w-[256px] flex-col items-center gap-0.5">
                  <label className="inline-flex cursor-pointer items-start gap-2.5 text-left">
                    <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} className="upload-checkbox mt-0.5 shrink-0" />
                    <span className="text-[12px] leading-relaxed text-gray-800">
                      我已閱讀並同意{" "}
                      <button
                        type="button"
                        className="underline"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setShowPrivacy(true);
                        }}
                      >
                        隱私權政策
                      </button>{" "}
                      與{" "}
                      <button
                        type="button"
                        className="underline"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setShowTerms(true);
                        }}
                      >
                        使用條款
                      </button>
                      。
                    </span>
                  </label>
                  <p className="text-center text-[11px] text-brand-orange">（須先同意使用條款才能繼續）</p>
                </div>
              </div>
            </Signboard>
          </div>

          <div className="relative z-30 w-[70%] mx-auto -mt-4">
            {error && <p className="mb-2 text-center text-xs text-red-600 drop-shadow-sm">{error}</p>}
            <CtaPrimaryButton variant="upload" onClick={() => void handleUpload()} disabled={!canSubmit}>
              {uploading ? "上傳中…" : "開始製作"}
            </CtaPrimaryButton>
          </div>
        </div>

        {/* 底部前景（帽子／球棒等）+ 頁尾文案同一層 */}
        <div className="pointer-events-none absolute inset-x-0 bottom-10 z-20 mx-auto max-w-mobile">
          <AssetImg src={A.bgCover} alt="" className="block w-full" />
          <footer className="pointer-events-auto absolute inset-x-0 bottom-0 px-8 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2 text-center">
            <p className="text-xs leading-relaxed text-white drop-shadow-sm">★活動期間：2026/7/3 00時00分 至 2026/8/23 23點59分★</p>
            <p className="mt-1 text-[10px] leading-relaxed text-white/80 drop-shadow-sm">
              *活動詳情與注意事項請參閱{" "}
              <button type="button" className="text-yellow-300 underline" onClick={() => setShowRules(true)}>
                活動辦法
              </button>
              。
            </p>
          </footer>
        </div>
      </div>

      {showRules && <ActivityRulesPopup onClose={() => setShowRules(false)} />}
      {showPrivacy && <PrivacyPolicyPopup onClose={() => setShowPrivacy(false)} />}
      {showTerms && <TermsOfServicePopup onClose={() => setShowTerms(false)} />}

      {/* Instruction popup */}
      {showInstruction && (
        <ModalOverlay onClose={() => setShowInstruction(false)} closeLabel="關閉範例" closeClassName="absolute -right-3 -top-3 z-10">
          <img src={A.instruction} alt="照片範例" className="w-full rounded-2xl shadow-2xl" />
        </ModalOverlay>
      )}
    </div>
  );
}
