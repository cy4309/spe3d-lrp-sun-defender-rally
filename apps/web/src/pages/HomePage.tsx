import { useState } from "react";
import { useNavigate } from "react-router-dom";
import Layout from "@/components/Layout";
import { useAuth } from "@/contexts/AuthContext";
import { apiPost, clearAuthToken } from "@/lib/api";
import { logoutLiff } from "@/lib/liff";

const CAMPAIGN_CODE =
  (import.meta.env.VITE_CAMPAIGN_CODE as string) || "anthelios-2026-summer";

export default function HomePage() {
  const auth = useAuth();
  const navigate = useNavigate();
  const [agreed, setAgreed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [reloginBusy, setReloginBusy] = useState(false);
  const isMock = auth.phase === "mock";

  async function handleReloginLine() {
    setReloginBusy(true);
    try {
      clearAuthToken();
      await logoutLiff();
    } finally {
      window.location.reload();
    }
  }

  if (auth.phase === "loading") {
    return (
      <Layout>
        <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 text-gray-400">
          <div className="spinner w-10 h-10" />
          <p>載入中…</p>
        </div>
      </Layout>
    );
  }

  if (auth.phase === "error") {
    return (
      <Layout>
        <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 text-center px-4">
          <p className="text-red-500 text-sm">{auth.message}</p>
          {!isMock && (
            <p className="text-gray-500 text-xs max-w-sm">
              id_token 過期時，僅重整無法換新憑證。請先登出 LIFF 再載入頁面。
            </p>
          )}
          <div className="flex flex-col gap-2 w-full max-w-xs">
            {!isMock && (
              <button
                type="button"
                className="btn btn-primary"
                disabled={reloginBusy}
                onClick={() => void handleReloginLine()}
              >
                {reloginBusy ? "處理中…" : "重新登入 LINE"}
              </button>
            )}
            <button
              type="button"
              className="btn btn-outline"
              disabled={reloginBusy}
              onClick={() => window.location.reload()}
            >
              僅重新整理
            </button>
          </div>
        </div>
      </Layout>
    );
  }

  async function handleStart() {
    if (!agreed) return;
    setLoading(true);
    try {
      if (!isMock) {
        await apiPost(
          "/api/v1/auth/consent",
          { consent_version: "2026-06-01" },
          { campaign_code: CAMPAIGN_CODE },
        );
      }
      navigate("/upload");
    } catch {
      navigate("/error", { state: { message: "記錄同意條款失敗，請稍後再試" } });
    } finally {
      setLoading(false);
    }
  }

  return (
    <Layout
      cta={
        <button
          className="btn btn-primary btn-block"
          onClick={handleStart}
          disabled={!agreed || loading}
        >
          {loading ? "處理中…" : "開始製作我的應援照"}
        </button>
      }
    >
      {isMock && (
        <div className="mb-4 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-700 text-center">
          開發模式（非 LINE 環境）
        </div>
      )}

      {/* Hero */}
      <section className="py-8 text-center">
        <span className="inline-block rounded-full bg-blue-50 text-brand-blue text-xs font-semibold px-4 py-1.5 mb-4 tracking-wide">
          La Roche-Posay × 應援活動
        </span>
        <h1 className="text-3xl font-extrabold text-brand-blue leading-tight mb-3">
          讓防曬成為<br />你的應援宣言
        </h1>
        <p className="text-sm text-gray-500 leading-relaxed">
          上傳你的照片，AI 生成你專屬的應援照，<br />現場兌換安得利防曬試用包！
        </p>
      </section>

      {/* Rules */}
      <section className="card mb-4 text-sm text-gray-700">
        <h2 className="text-[15px] font-semibold text-brand-blue mb-2">活動說明</h2>
        <ul className="list-disc pl-5 space-y-1 leading-relaxed">
          <li>上傳清晰人像照（正面、光線充足）</li>
          <li>AI 生成韓系清爽應援風格</li>
          <li>憑 QR Code 到機台兌換試用包（每人限 1 份）</li>
          <li>分享活動可取得抽獎資格</li>
        </ul>
      </section>

      {/* Consent */}
      <label className="flex gap-3 items-start text-xs text-gray-500 leading-relaxed cursor-pointer py-2">
        <input
          type="checkbox"
          checked={agreed}
          onChange={(e) => setAgreed(e.target.checked)}
          className="mt-0.5 shrink-0 w-4 h-4 accent-brand-blue"
        />
        <span>
          我已閱讀並同意{" "}
          <a href="#privacy" onClick={(e) => e.preventDefault()} className="text-brand-blue underline">
            隱私權政策
          </a>{" "}
          與{" "}
          <a href="#terms" onClick={(e) => e.preventDefault()} className="text-brand-blue underline">
            使用條款
          </a>
          ，並同意本活動收集、使用我的照片用於 AI 生成。
        </span>
      </label>
    </Layout>
  );
}
