import { useState } from "react";
import { useNavigate } from "react-router-dom";
import ActivityRulesPopup from "@/components/ActivityRulesPopup";
import { useAuth } from "@/contexts/AuthContext";
import { clearAuthToken } from "@/lib/api";
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
  baseball: "/assets/landing-page-home/landing-page_home_icon_baseball.png",
  cta: "/assets/landing-page-home/landing-page_home_cta.png",
  picbot: "/assets/landing-page-home/landing-page_home_picbot.png",
} as const;

/** bg2 藍色區塊左側三步驟（與 UI 稿一致） */
const CAMPAIGN_STEPS = [
  { n: 1, text: "加入理膚寶水LINE官方帳號" },
  { n: 2, text: "完成活動，獲得兌換 QR Code" },
  { n: 3, text: "前往派樣機，免費兌換試用組 (*每人限領一份，數量有限，送完為止。)" },
] as const;

export default function HomePage() {
  const auth = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [reloginBusy, setReloginBusy] = useState(false);
  const [showRules, setShowRules] = useState(false);
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

  function handleStart() {
    setLoading(true);
    navigate("/upload");
    setLoading(false);
  }

  if (auth.phase === "loading") {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-[#1361b5]">
        <div className="spinner h-10 w-10" />
      </div>
    );
  }

  if (auth.phase === "error") {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-[#1361b5] px-6 text-center">
        <img src={A.logo} alt="LA ROCHE-POSAY 理膚寶水" className="h-10 object-contain" />
        <p className="text-sm text-white/80">{auth.message}</p>
        <div className="flex w-full max-w-xs flex-col gap-2">
          {!isMock && (
            <button type="button" className="btn btn-primary w-full" disabled={reloginBusy} onClick={() => void handleReloginLine()}>
              {reloginBusy ? "處理中…" : "重新登入 LINE"}
            </button>
          )}
          <button type="button" className="btn btn-outline w-full border-white/50 text-white" onClick={() => window.location.reload()}>
            僅重新整理
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-mobile overflow-x-hidden bg-white">
      {/* ① Hero：bg1 底圖 + 疊加標題／CTA／按鈕 */}
      <section className="relative w-full">
        <img src={A.bg1} alt="" className="block w-full" aria-hidden />

        <div className="absolute inset-0 flex flex-col">
          {/* Header 疊在 bg1 上 */}
          <div className="bg-white flex items-start justify-between px-4 pt-3">
            <img src={A.logo} alt="LA ROCHE-POSAY 理膚寶水" className="h-7 object-contain drop-shadow-sm" />
            <img src={A.no1} alt="台灣皮膚科醫師 No.1" className="h-11 object-contain drop-shadow-sm" />
          </div>

          {/* 主標、副標、按鈕（疊在球場圖下半部） */}
          <div className="w-full h-full px-4 pb-5 pt-2 text-center">
            <div className="mb-2 flex items-center justify-start gap-1.5">
              <img src={A.newUvair} alt="NEW UVAIR" className="h-5 object-contain" />
            </div>

            <img src={A.eventName} alt="理膚防曬應援 今夏不怕曬" className="mx-auto mb-2 w-[80%]" />

            <img src={A.cta} alt="立即製作專屬應援人物 免費領取夏日防曬組" className="mx-auto absolute bottom-8 left-0 right-0 w-[94%] max-w-[360px]" />

            {isMock && <p className="mb-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">開發模式（非 LINE 環境）</p>}

            <button type="button" className="home-cta z-10 absolute -bottom-8 left-0 right-0 w-full max-w-[320px] disabled:cursor-not-allowed disabled:opacity-50" onClick={handleStart} disabled={loading}>
              {loading ? "處理中…" : "我要參加"}
            </button>
          </div>
        </div>
      </section>

      {/* ② bg2 + 左側三步驟 + picbot 疊右下角 */}
      <section className="relative w-full">
        <img src={A.bg2} alt="" className="block w-full" aria-hidden />

        <div className="absolute inset-x-0 bottom-0 z-10 flex items-end justify-between px-3 pb-11 sm:px-4">
          <ol className="mb-2 max-w-[58%] space-y-3.5 pl-1">
            {CAMPAIGN_STEPS.map((step) => (
              <li key={step.n} className="flex items-start gap-2.5">
                <span className="home-step-badge mt-0.5" aria-hidden>
                  <img src={A.baseball} alt="" className="home-step-badge__icon" />
                  <span className="home-step-badge__num">{step.n}</span>
                </span>
                <span className="text-left text-[13px] font-bold leading-snug text-white drop-shadow-sm">{step.text}</span>
              </li>
            ))}
          </ol>

          <img src={A.picbot} alt="活動兌換機台" className="pointer-events-none w-[44%] max-w-[178px] shrink-0 self-end object-contain object-bottom" />
        </div>

        <div className="home-period-bar absolute inset-x-0 bottom-0 z-20">
          <p>活動期間：2026/7/3(五)～8/23(日)</p>
        </div>
      </section>

      {/* ③ 產品特色 16H */}
      <img src={A.bg3} alt="安得利防曬精華 16H 全能抵禦" className="block w-full" />

      {/* ⑤ UVAIR 科技 */}
      <img src={A.bg4} alt="首創 UVAIR 0g 空氣感隱形抗曬科技" className="block w-full" />

      {/* ⑥ 戶外防曬 NO.1 產品線 */}
      <img src={A.bg5} alt="戶外防曬 NO.1 理膚寶水安得利" className="block w-full" />

      {/* 頁尾：活動辦法 */}
      <footer className="bg-brand-blue px-5 py-4 text-center">
        <p className="text-[11px] leading-relaxed text-white/90">
          *本活動詳情與注意事項請詳閱{" "}
          <button
            type="button"
            className="text-[#ffe566] underline underline-offset-2"
            onClick={() => setShowRules(true)}
          >
            活動辦法
          </button>
          。
        </p>
      </footer>

      {showRules && <ActivityRulesPopup onClose={() => setShowRules(false)} />}
    </div>
  );
}
