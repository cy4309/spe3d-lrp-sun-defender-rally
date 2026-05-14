import liff from "@line/liff";

const LIFF_ID = import.meta.env.VITE_LIFF_ID as string;
const FORCE_MOCK = import.meta.env.VITE_MOCK_MODE === "true";

let initialized = false;
let _mock = false;
/** React StrictMode 會在 dev 連跑兩次 effect；liff.init 會兌換 URL 上的 OAuth code，只能跑一次。 */
let _initPromise: Promise<{ ok: boolean; mock: boolean; error?: string }> | null = null;

export async function initLiff(): Promise<{ ok: boolean; mock: boolean; error?: string }> {
  if (FORCE_MOCK || !LIFF_ID) {
    _mock = true;
    return { ok: false, mock: true, error: FORCE_MOCK ? "VITE_MOCK_MODE=true" : "VITE_LIFF_ID 未設定" };
  }
  if (initialized) return { ok: true, mock: false };
  if (!_initPromise) {
    _initPromise = (async () => {
      try {
        await liff.init({ liffId: LIFF_ID });
        initialized = true;
        return { ok: true, mock: false };
      } catch (e) {
        _initPromise = null;
        return { ok: false, mock: false, error: String(e) };
      }
    })();
  }
  return _initPromise;
}

export function isMockMode(): boolean {
  return _mock;
}

export function isLoggedIn(): boolean {
  return initialized && liff.isLoggedIn();
}

export async function login(): Promise<void> {
  if (_mock) return;
  if (!initialized) throw new Error("LIFF not initialized");
  if (!liff.isLoggedIn()) liff.login();
}

/** 清掉 LIFF 登入狀態，下次 reload 後會再走 liff.login() 換新的 id_token。僅重整頁面不會清這個。 */
export async function logoutLiff(): Promise<void> {
  if (_mock || !initialized) return;
  if (liff.isLoggedIn()) await liff.logout();
}

export async function getIdToken(): Promise<string | null> {
  if (_mock || !initialized || !liff.isLoggedIn()) return null;
  return liff.getIDToken();
}

export async function getProfile() {
  if (_mock || !initialized || !liff.isLoggedIn()) return null;
  return liff.getProfile();
}

export async function shareTargetPicker(messages: object[]): Promise<boolean> {
  if (_mock) {
    console.log("[mock] shareTargetPicker", messages);
    return true;
  }
  if (!initialized) throw new Error("LIFF not initialized");
  const res = await liff.shareTargetPicker(
    messages as Parameters<typeof liff.shareTargetPicker>[0],
  );
  return res?.status === "success";
}

export { liff };
