import { useState } from "react";
import { clearAuthToken } from "@/lib/api";
import { logoutLiff } from "@/lib/liff";

const LOGO = "/assets/landing-page-home/lp_logo.png";

/** LIFF 初始化失敗、登入過期等全站共用畫面 */
export default function AuthErrorScreen({ message }: { message: string }) {
  const [reloginBusy, setReloginBusy] = useState(false);
  const isMockMode = import.meta.env.VITE_MOCK_MODE === "true";

  async function handleReloginLine() {
    setReloginBusy(true);
    try {
      clearAuthToken();
      await logoutLiff();
    } finally {
      window.location.reload();
    }
  }

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-[#1361b5] px-6 text-center">
      <img src={LOGO} alt="LA ROCHE-POSAY 理膚寶水" className="h-10 object-contain" />
      <p className="text-sm text-white/80">{message}</p>
      <div className="flex w-full max-w-xs flex-col gap-2">
        {!isMockMode && (
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
          className="btn btn-outline w-full border-white/50 bg-brand-blue text-white"
          onClick={() => window.location.reload()}
        >
          僅重新整理
        </button>
      </div>
    </div>
  );
}
