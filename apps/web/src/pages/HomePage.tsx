import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { apiPost, clearAuthToken } from "@/lib/api";
import { logoutLiff } from "@/lib/liff";

const A = {
  bg1: "/assets/landing-page-home/landing-page_home_bg1.png",
  bg2: "/assets/landing-page-home/landing-page_home_bg2.png",
  bg3: "/assets/landing-page-home/landing-page_home_bg3.png",
  bg4: "/assets/landing-page-home/landing-page_home_bg4.png",
  bg5: "/assets/landing-page-home/landing-page_home_bg5.png",
  logo: "/assets/landing-page-home/lp_logo.png",
  no1: "/assets/landing-page-home/tw_no1_logo.png",
  eventName: "/assets/landing-page-home/landing-page_home_event_name.png",
  newUvair: "/assets/landing-page-home/landing-page_home_new_uvair.png",
  cta: "/assets/landing-page-home/landing-page_home_cta.png",
  picbot: "/assets/landing-page-home/landing-page_home_picbot.png",
} as const;

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

  async function handleStart() {
    if (!agreed) {
      document.getElementById("consent-section")?.scrollIntoView({ behavior: "smooth" });
      return;
    }
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

  if (auth.phase === "loading") {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-[#1361b5]">
        <div className="spinner w-10 h-10" />
      </div>
    );
  }

  if (auth.phase === "error") {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center bg-[#1361b5] gap-4 px-6 text-center">
        <img src={A.logo} alt="LA ROCHE-POSAY 理膚寶水" className="h-10 object-contain" />
        <p className="text-white/80 text-sm">{auth.message}</p>
        <div className="flex flex-col gap-2 w-full max-w-xs">
          {!isMock && (
            <button
              type="button"
              className="btn btn-primary w-full"
              disabled={reloginBusy}
              onClick={() => void handleReloginLine()}
            >
              {reloginBusy ? "處理中…" : "重新登入 LINE"}
            </button>
          )}
          <button
            type="button"
            className="btn btn-outline border-white/50 text-white w-full"
            onClick={() => window.location.reload()}
          >
            僅重新整理
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-mobile bg-white overflow-x-hidden">
      {/* ── Hero Section ── */}
      <div className="relative">
        <img src={A.bg1} alt="理膚防曬應援 今夏不怕曬" className="w-full block" />
        <div className="absolute top-0 left-0 right-0 flex justify-between items-start px-3 pt-3">
          <img src={A.logo} alt="LA ROCHE-POSAY 理膚寶水" className="h-7 object-contain" />
          <img src={A.no1} alt="台灣皮膚科醫師No.1" className="h-11 object-contain" />
        </div>
      </div>

      {/* ── CTA Section ── */}
      <div id="consent-section" className="bg-[#1361b5] px-5 pb-6 pt-5 text-center">
        <img
          src={A.eventName}
          alt="理膚防曬應援 今夏不怕曬"
          className="mx-auto mb-3 w-[88%] max-w-[320px]"
        />

        <div className="flex items-center justify-center gap-2 mb-4">
          <img src={A.newUvair} alt="NEW" className="h-5 object-contain" />
          <span className="text-white font-black text-xl tracking-widest drop-shadow">UVAIR</span>
        </div>

        <img
          src={A.cta}
          alt="立即製作專屬應援人物 免費領取「夏日防曬組」"
          className="mx-auto mb-5 w-[95%] max-w-[360px]"
        />

        {isMock && (
          <div className="mb-4 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-700">
            開發模式（非 LINE 環境）
          </div>
        )}

        {/* Consent checkbox */}
        <label className="flex gap-2.5 items-start mb-4 cursor-pointer px-2 text-left">
          <input
            type="checkbox"
            checked={agreed}
            onChange={(e) => setAgreed(e.target.checked)}
            className="mt-0.5 shrink-0 h-4 w-4 accent-[#f47a1f]"
          />
          <span className="text-white/80 text-[12px] leading-relaxed">
            我已閱讀並同意{" "}
            <a
              href="#"
              onClick={(e) => e.preventDefault()}
              className="text-yellow-300 underline"
            >
              隱私權政策
            </a>{" "}
            與{" "}
            <a
              href="#"
              onClick={(e) => e.preventDefault()}
              className="text-yellow-300 underline"
            >
              使用條款
            </a>
            ，並同意本活動收集、使用我的照片用於 AI 生成。
          </span>
        </label>

        <button
          type="button"
          className="w-full rounded-full py-4 text-[18px] font-black text-white tracking-widest mb-3 disabled:opacity-40 disabled:cursor-not-allowed"
          style={{
            background: "linear-gradient(180deg, #ff8c2a 0%, #f47a1f 55%, #e86a10 100%)",
            border: "2px solid #fff",
            boxShadow: "0 4px 16px rgba(244,122,31,0.5)",
          }}
          onClick={() => void handleStart()}
          disabled={!agreed || loading}
        >
          {loading ? "處理中…" : "我要參加"}
        </button>

        <p className="text-white/60 text-[11px]">
          ★活動期間：2026/7/3 00時00分 至 2026/8/23 23點59分★
        </p>
      </div>

      {/* ── Stacked info sections ── */}
      <img src={A.bg4} alt="首創UVAIR 空氣感隱形抗曬科技" className="w-full block" />
      <img src={A.bg2} alt="安得利防曬系列產品" className="w-full block" />
      <img src={A.bg3} alt="安得利防曬精華 16H全能抵禦" className="w-full block" />
      <img src={A.bg5} alt="戶外防曬NO.1 理膚寶水安得利" className="w-full block" />
      <img src={A.picbot} alt="活動機台 理膚寶水安得利防曬" className="w-full block" />

      {/* ── Sticky bottom CTA ── */}
      <div
        className="sticky bottom-0 z-50 bg-[#0a3a78] px-5 py-3"
        style={{ boxShadow: "0 -4px 20px rgba(0,0,0,0.35)" }}
      >
        <button
          type="button"
          className="w-full rounded-full py-3.5 text-[17px] font-black text-white tracking-widest disabled:opacity-40 disabled:cursor-not-allowed"
          style={{
            background: agreed
              ? "linear-gradient(180deg, #ff8c2a 0%, #f47a1f 55%, #e86a10 100%)"
              : "#666",
            border: "2px solid #fff",
          }}
          onClick={() => void handleStart()}
          disabled={loading}
        >
          {loading ? "處理中…" : agreed ? "我要參加" : "請先勾選同意條款"}
        </button>
      </div>
    </div>
  );
}
