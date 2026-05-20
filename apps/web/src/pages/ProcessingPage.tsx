import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ApiError, apiGet, apiPost } from "@/lib/api";

const POLL_MS = parseInt(import.meta.env.VITE_POLLING_INTERVAL_MS ?? "2000", 10);
const TIMEOUT_MS = 60_000;

const A = {
  bg: "/assets/upload-gen-page/pic_genAI_bg_1.png",
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

  if (failed) {
    return (
      <div className="relative min-h-dvh mx-auto max-w-mobile overflow-hidden">
        <div className="absolute inset-0 z-0 bg-gradient-to-b from-sky-400 to-blue-900" />
        <img src={A.bg} alt="" className="absolute inset-0 z-0 h-full w-full object-cover opacity-50" />
        <div className="relative z-10 flex min-h-dvh flex-col items-center justify-center px-6 text-center gap-5">
          <img src={A.logo} alt="LA ROCHE-POSAY" className="h-8 object-contain" />
          <div className="rounded-2xl bg-white/90 backdrop-blur px-8 py-8 shadow-2xl w-full max-w-xs">
            <span className="text-5xl block mb-4">😢</span>
            <h2 className="text-xl font-bold text-brand-blue mb-2">人潮較多，請稍後再試</h2>
            <p className="text-sm text-gray-500 mb-5">AI 生成暫時遇到問題，你還有一次重新生成的機會。</p>
            {canRetry ? (
              <button
                className="btn btn-primary w-full"
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
      </div>
    );
  }

  return (
    <div className="relative min-h-dvh mx-auto max-w-mobile overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 z-0 bg-gradient-to-b from-sky-400 via-blue-600 to-blue-900" />
      <img
        src={A.bg}
        alt=""
        className="absolute inset-0 z-0 h-full w-full object-cover object-top opacity-60"
      />
      {/* Blue tint overlay */}
      <div className="absolute inset-0 z-0 bg-[#1361b5]/50" />

      <div className="relative z-10 flex min-h-dvh flex-col items-center justify-center px-6 gap-6 text-center">
        {/* Logo */}
        <img src={A.logo} alt="LA ROCHE-POSAY 理膚寶水" className="h-8 object-contain" />

        {/* Card */}
        <div className="rounded-2xl bg-white/90 backdrop-blur px-8 py-8 shadow-2xl w-full max-w-xs">
          {/* Spinner */}
          <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-brand-blue/10">
            <div className="spinner w-10 h-10" />
          </div>

          <h2 className="text-xl font-black text-brand-blue mb-1">AI 生成中…</h2>
          <p className="text-[13px] text-brand-orange font-semibold mb-4">
            專屬應援照製作中，請稍候
          </p>

          {/* Carousel tip */}
          <div className="min-h-[52px] flex items-center justify-center">
            <p className="text-sm text-gray-500 leading-relaxed">{CAROUSEL[idx]}</p>
          </div>

          {showHint && (
            <p className="mt-3 text-xs text-brand-orange font-medium">
              人潮較多，仍在努力處理中，請耐心等候 ⏳
            </p>
          )}
        </div>

        {/* Dot progress */}
        <div className="flex gap-2">
          {CAROUSEL.map((_, i) => (
            <span
              key={i}
              className={`block h-2 w-2 rounded-full transition-all duration-500 ${
                i === idx ? "bg-white scale-125" : "bg-white/40"
              }`}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
