import { createContext, ReactNode, useContext, useEffect, useState } from "react";
import { setAuthToken } from "@/lib/api";
import { getIdToken, getProfile, initLiff, login as liffLogin } from "@/lib/liff";

const CAMPAIGN_CODE =
  (import.meta.env.VITE_CAMPAIGN_CODE as string) || "anthelios-2026-summer";
const API_BASE =
  (import.meta.env.VITE_API_BASE_URL as string) || "";

export type UserInfo = {
  id: string;
  line_user_id: string;
  display_name: string | null;
  picture_url?: string | null;
};
export type UserCampaignInfo = {
  id: string;
  status: string;
  shared: boolean;
  lottery_eligible: boolean;
  lottery_result?: string;
};
export type CampaignInfo = {
  id: string;
  code: string;
  name: string;
  ends_at: string;
  ai_style: string;
};

export type AuthState =
  | { phase: "loading" }
  | { phase: "error"; message: string }
  | { phase: "mock" }
  | { phase: "ready"; user: UserInfo; userCampaign: UserCampaignInfo; campaign: CampaignInfo };

const AuthContext = createContext<AuthState>({ phase: "loading" });

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ phase: "loading" });

  useEffect(() => {
    (async () => {
      try {
        const { ok, mock, error } = await initLiff();
        console.log("[auth] initLiff", { ok, mock, error });
        if (mock) { setState({ phase: "mock" }); return; }
        if (!ok) throw new Error(error ?? "LIFF 初始化失敗");

        await liffLogin();
        const profile = await getProfile();
        console.log("[auth] LINE profile", profile);

        const idToken = await getIdToken();
        console.log("[auth] idToken", idToken ? `${idToken.slice(0, 20)}…` : null);
        if (!idToken) throw new Error("無法取得 ID Token，請重新從 LINE 進入活動");

        const entrySource =
          new URLSearchParams(window.location.search).get("entry_source") ?? "unknown";

        const res = await fetch(`${API_BASE}/api/v1/auth/line`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id_token: idToken,
            campaign_code: CAMPAIGN_CODE,
            entry_source: entrySource,
            referrer_user_id: null,
          }),
        });

        if (!res.ok) {
          const body = await res.json().catch(() => null);
          throw new Error(body?.detail?.message ?? `登入失敗 (${res.status})`);
        }

        const token = res.headers.get("X-Access-Token");
        if (token) setAuthToken(token);

        const data = await res.json();
        console.log("[auth] /auth/line response", data);
        setState({
          phase: "ready",
          user: data.user,
          userCampaign: data.user_campaign,
          campaign: data.campaign,
        });
      } catch (e) {
        setState({ phase: "error", message: String(e) });
      }
    })();
  }, []);

  return <AuthContext.Provider value={state}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
