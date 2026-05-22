import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { useNavigate } from "react-router-dom";
import {
  clearAuthToken,
  getAuthToken,
  getTokenExpiresAtMs,
  setAuthToken,
  setUnauthorizedHandler,
} from "@/lib/api";
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

type AuthContextValue = {
  state: AuthState;
  invalidateSession: (message?: string) => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

const DEFAULT_SESSION_EXPIRED_MSG = "登入已過期，請重新從 LINE 開啟活動";

export function AuthProvider({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const [state, setState] = useState<AuthState>({ phase: "loading" });

  const invalidateSession = useCallback(
    (message?: string) => {
      clearAuthToken();
      setState({
        phase: "error",
        message: message ?? DEFAULT_SESSION_EXPIRED_MSG,
      });
      navigate("/", { replace: true });
    },
    [navigate],
  );

  useEffect(() => {
    setUnauthorizedHandler(invalidateSession);
    return () => setUnauthorizedHandler(null);
  }, [invalidateSession]);

  useEffect(() => {
    (async () => {
      try {
        const { ok, mock, error } = await initLiff();
        console.log("[auth] initLiff", { ok, mock, error });
        if (mock) {
          setState({ phase: "mock" });
          return;
        }
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

  /** JWT 到期時主動登出（使用者停留在頁面、尚未打 API 的情況） */
  useEffect(() => {
    if (state.phase !== "ready") return;

    const token = getAuthToken();
    if (!token) {
      invalidateSession();
      return;
    }

    const expiresAt = getTokenExpiresAtMs(token);
    if (!expiresAt) return;

    const delay = expiresAt - Date.now();
    if (delay <= 0) {
      invalidateSession();
      return;
    }

    const timer = window.setTimeout(() => invalidateSession(), delay);
    return () => window.clearTimeout(timer);
  }, [state.phase, invalidateSession]);

  return (
    <AuthContext.Provider value={{ state, invalidateSession }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx.state;
}

export function useInvalidateSession() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useInvalidateSession must be used within AuthProvider");
  return ctx.invalidateSession;
}
