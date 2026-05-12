import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import Layout from "@/components/Layout";
import { ApiError, apiGet, apiPost } from "@/lib/api";

const POLL_MS = parseInt(import.meta.env.VITE_POLLING_INTERVAL_MS ?? "2000", 10);
const TIMEOUT_MS = 60_000;

const CAROUSEL = [
  "你知道嗎？SPF 50+ 可以抵擋 98% UVB 光線",
  "每 2 小時補擦一次防曬，效果才完整喔！",
  "La Roche-Posay 安得利系列通過皮膚科醫師測試",
  "夏日防曬不只是防曬傷，更是抗老的第一步",
  "AI 正在努力生成你的應援照，請稍候…",
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
        else if (data.status === "failed_final") { stop(); setCanRetry(data.can_retry ?? false); setFailed(true); }
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
      const msg = e instanceof ApiError && e.code === "retry_quota_exceeded"
        ? "已達重試上限，感謝你的參與" : "重試失敗，請稍後再試";
      navigate("/error", { state: { message: msg } });
    } finally {
      setRetrying(false);
    }
  }

  if (failed) {
    return (
      <Layout>
        <div className="flex flex-col items-center text-center gap-4 py-16">
          <span className="text-5xl">😢</span>
          <h2 className="text-xl font-bold text-brand-blue">人潮較多，請稍後再試</h2>
          <p className="text-sm text-gray-500 max-w-xs">AI 生成暫時遇到問題，你還有一次重新生成的機會。</p>
          {canRetry ? (
            <button className="btn btn-primary mt-2" onClick={handleRetry} disabled={retrying}>
              {retrying ? "處理中…" : "重新生成"}
            </button>
          ) : (
            <p className="text-sm text-gray-400">已達重試上限，感謝你的參與。</p>
          )}
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-5 text-center">
        <div className="spinner w-14 h-14" />
        <h2 className="text-xl font-bold text-brand-blue">AI 生成中…</h2>
        <p className="text-sm text-gray-500 max-w-[280px] leading-relaxed min-h-[42px]">
          {CAROUSEL[idx]}
        </p>
        {showHint && (
          <p className="text-xs text-brand-orange">人潮較多，仍在努力處理中，請耐心等候</p>
        )}
      </div>
    </Layout>
  );
}
