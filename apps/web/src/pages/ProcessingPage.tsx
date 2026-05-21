import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ApiError, apiGet, apiPost } from "@/lib/api";

const POLL_MS = parseInt(import.meta.env.VITE_POLLING_INTERVAL_MS ?? "2000", 10);
const TIMEOUT_MS = 60_000;

const A = {
  // 3_1-processing 設計：UVAIR 防曬產品 dropper 近照（淺藍/白底）
  // ⚠️ placeholder — 實際素材放入後路徑不變，直接替換檔案即可
  bgProduct: "/assets/upload-gen-page/pic_genAI_processing_bg.png",
  logo: "/assets/landing-page-home/lp_logo.png",
} as const;

const CAROUSEL = [
  "AI 正在幫你生成專屬應援照，請稍候…",
  "你知道嗎？SPF 50+ 可以抵擋 98% UVB 光線",
  "每 2 小時補擦一次防曬，效果才完整喔！",
  "La Roche-Posay 安得利系列通過皮膚科醫師測試",
  "夏日防曬不只是防曬傷，更是抗老的第一步",
  "UVAIR 空氣感隱形抗曬科技，輕盈不悶油",
];

type JobResponse = { job_id: string; status: string; can_retry?: boolean };

export default function ProcessingPage() {
  const { jobId } = useParams<{ jobId: string }>();
  const navigate = useNavigate();
  const [idx, setIdx] = useState(0);
  const [showHint, setShowHint] = useState(false);
  const [failed, setFailed] = useState(false);
  const [canRetry, setCanRetry] = useState(true);
  const [retrying, setRetrying] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isMock = jobId === "mock-job-id";

  function stop() {
    if (pollRef.current) clearInterval(pollRef.current);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
  }

  useEffect(() => {
    const carousel = setInterval(() => setIdx((i) => (i + 1) % CAROUSEL.length), 3000);
    if (isMock) {
      const t = setTimeout(() => navigate("/result"), 3000);
      return () => { clearInterval(carousel); clearTimeout(t); };
    }
    const poll = async () => {
      try {
        const data = await apiGet<JobResponse>(`/api/v1/jobs/${jobId}`);
        if (data.status === "succeeded") { stop(); navigate("/result"); }
        else if (data.status === "failed_final") {
          stop();
          setCanRetry(data.can_retry ?? false);
          setFailed(true);
        }
      } catch { /* keep polling on transient errors */ }
    };
    poll();
    pollRef.current = setInterval(poll, POLL_MS);
    timeoutRef.current = setTimeout(() => setShowHint(true), TIMEOUT_MS);
    return () => { clearInterval(carousel); stop(); };
  }, [jobId, navigate, isMock]);

  async function handleRetry() {
    setRetrying(true);
    try {
      const data = await apiPost<{ job_id: string }>(`/api/v1/jobs/${jobId}/retry`);
      navigate(`/processing/${data.job_id}`);
    } catch (e) {
      const msg =
        e instanceof ApiError && e.code === "retry_quota_exceeded"
          ? "已達重試上限，感謝你的參與"
          : "重試失敗，請稍後再試";
      navigate("/error", { state: { message: msg } });
    } finally {
      setRetrying(false);
    }
  }

  return (
    <div className="relative min-h-dvh mx-auto max-w-mobile overflow-hidden bg-[#d8eef6]">
      {/* ── Background: product dropper image (3_1-processing design) ── */}
      <img
        src={A.bgProduct}
        alt=""
        className="absolute inset-0 w-full h-full object-cover object-center"
      />

      {/* Top shimmer loading bar */}
      {!failed && (
        <div className="absolute top-0 left-0 right-0 z-30 h-1.5 overflow-hidden bg-white/30">
          <div
            className="absolute inset-y-0 w-1/3 bg-gradient-to-r from-transparent via-brand-orange to-transparent loading-shimmer"
          />
        </div>
      )}

      {/* Top gradient so logo is readable over the product photo */}
      <div className="absolute top-0 left-0 right-0 h-28 z-10 bg-gradient-to-b from-white/60 to-transparent" />

      {/* Logo */}
      <div className="absolute top-4 left-4 z-20">
        <img src={A.logo} alt="LA ROCHE-POSAY 理膚寶水" className="h-7 object-contain drop-shadow" />
      </div>

      {/* ── Failed state: semi-transparent overlay modal ── */}
      {failed && (
        <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/55 px-6">
          <div className="w-full max-w-xs rounded-2xl bg-white px-8 py-8 shadow-2xl text-center">
            <span className="text-5xl block mb-4">😢</span>
            <h2 className="text-xl font-bold text-brand-blue mb-2">人潮較多，請稍後再試</h2>
            <p className="text-sm text-gray-500 mb-5">
              AI 生成暫時遇到問題，你還有一次重新生成的機會。
            </p>
            {canRetry ? (
              <button
                className="upload-cta w-full disabled:opacity-40 disabled:cursor-not-allowed"
                onClick={() => void handleRetry()}
                disabled={retrying}
              >
                {retrying ? "處理中…" : "重新生成"}
              </button>
            ) : (
              <p className="text-sm text-gray-400">已達重試上限，感謝你的參與。</p>
            )}
          </div>
        </div>
      )}

      {/* ── Loading state: bottom overlay panel ── */}
      {!failed && (
        <>
          {/* Dark gradient at bottom */}
          <div className="absolute bottom-0 left-0 right-0 h-64 z-10 bg-gradient-to-t from-black/80 via-black/40 to-transparent" />

          <div className="absolute bottom-0 left-0 right-0 z-20 px-6 pb-12 text-center">
            <h2 className="text-white text-2xl font-black drop-shadow-lg mb-1">AI 生成中…</h2>
            <p className="text-brand-orange font-semibold text-sm drop-shadow mb-3">
              專屬應援照製作中，請稍候
            </p>

            {/* Carousel tip */}
            <p className="text-white/85 text-sm leading-relaxed drop-shadow min-h-[42px]">
              {CAROUSEL[idx]}
            </p>

            {/* Pill-dot progress indicators */}
            <div className="flex justify-center gap-2 mt-4">
              {CAROUSEL.map((_, i) => (
                <span
                  key={i}
                  className="block rounded-full bg-white transition-all duration-500"
                  style={{
                    width: i === idx ? 16 : 8,
                    height: 8,
                    opacity: i === idx ? 1 : 0.35,
                  }}
                />
              ))}
            </div>

            {showHint && (
              <p className="mt-4 text-xs font-semibold text-brand-orange drop-shadow">
                人潮較多，仍在努力處理中，請耐心等候 ⏳
              </p>
            )}
          </div>
        </>
      )}
    </div>
  );
}
