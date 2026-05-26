import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import ActivityRulesPopup from "@/components/ActivityRulesPopup";
import CtaPrimaryButton from "@/components/CtaPrimaryButton";
import Signboard from "@/components/Signboard";
import { useAuth } from "@/contexts/AuthContext";
import { apiGet, apiPost } from "@/lib/api";
import { logMockGet, logMockSkip } from "@/lib/mockApi";

const CAMPAIGN_CODE =
  (import.meta.env.VITE_CAMPAIGN_CODE as string) || "anthelios-2026-summer";

const A = {
  bg: "/assets/genai_done_qr_page/GenAI_donepage_bg.png",
  slogan: "/assets/genai_done_qr_page/GenAI_donepage_slogan.png",
  logo: "/assets/landing-page-home/lp_logo.png",
  sample: "/assets/genai_done_qr_page/GenAI_donepage_QR_pic_sample.png",
  mock: "/assets/line/demo.png",
} as const;

type MeResult = {
  user_campaign_id: string;
  status: string;
  result_image_url: string | null;
  redeem_code: {
    code: string;
    qr_payload: string;
    status: string;
    expires_at: string;
  } | null;
  channel_code: string | null;
};

const MOCK_RESULT: MeResult = {
  user_campaign_id: "mock-uc",
  status: "generated",
  result_image_url: null,
  redeem_code: {
    code: "MOCKQR01",
    qr_payload: "https://example.com/redeem?code=MOCKQR01",
    status: "unused",
    expires_at: "2026-08-31T23:59:00+08:00",
  },
  channel_code: null,
};

export default function ResultPage() {
  const auth = useAuth();
  const navigate = useNavigate();
  const [result, setResult] = useState<MeResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [showRules, setShowRules] = useState(false);
  const pushRequestedRef = useRef(false);
  const isMock = auth.phase === "mock";

  useEffect(() => {
    if (isMock) {
      const mockData = logMockGet<MeResult>(
        "/api/v1/me/result",
        { campaign_code: CAMPAIGN_CODE },
        {
          ...MOCK_RESULT,
          result_image_url: `${window.location.origin}${A.mock}`,
        },
      );
      setResult(mockData);
      setLoading(false);
      return;
    }
    apiGet<MeResult>("/api/v1/me/result", { campaign_code: CAMPAIGN_CODE })
      .then((d) => setResult(d))
      .catch(() => navigate("/error"))
      .finally(() => setLoading(false));
  }, [isMock, navigate]);

  /** 生圖完成進入結果頁時，同步 Push 應援照至 LINE 聊天室（後端冪等） */
  useEffect(() => {
    if (isMock) {
      logMockSkip("POST /api/v1/me/push-result-image", "VITE_MOCK_MODE（無 LINE Push）", {
        campaign_code: CAMPAIGN_CODE,
      });
      return;
    }
    if (!result?.result_image_url || pushRequestedRef.current) return;
    pushRequestedRef.current = true;
    void apiPost<{ pushed: boolean; skipped?: boolean }>(
      "/api/v1/me/push-result-image",
      undefined,
      {
        campaign_code: CAMPAIGN_CODE,
      },
    ).catch(() => {
      pushRequestedRef.current = false;
    });
  }, [isMock, result?.result_image_url]);

  if (loading) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-[#1361b5]">
        <div className="spinner h-10 w-10" />
      </div>
    );
  }

  if (!result?.redeem_code) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-[#1361b5] p-6 text-center">
        <p className="text-sm text-white">尚無生成結果，請先完成照片上傳。</p>
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => navigate("/upload")}
        >
          去上傳
        </button>
      </div>
    );
  }

  const imageSrc = result.result_image_url ?? (isMock ? A.mock : null);

  return (
    <div className="relative mx-auto min-h-dvh max-w-mobile overflow-x-hidden">
      <img
        src={A.bg}
        alt=""
        className="absolute inset-0 h-full w-full object-cover object-center"
        aria-hidden
      />

      <div className="relative z-10 flex min-h-dvh flex-col">
        {/* Header */}
        <div className="px-8">
          <img
            src={A.logo}
            alt="LA ROCHE-POSAY 理膚寶水"
            className="h-8 object-contain object-left"
          />
        </div>

        {/* 標語 + 應援照同一層；標語略疊在照片上緣（對齊設計稿） */}
        <div className="flex flex-1 flex-col items-center justify-center px-5">
          <div className="relative w-full max-w-[320px]">
            <img
              src={A.slogan}
              alt="理膚寶水 NEW UVAIR 和您一起熱血應援!! 守護陽光下的每一刻"
              className="relative z-20 mx-auto block w-full -mb-12"
            />
            <Signboard className="relative z-10 w-full">
              {imageSrc ? (
                <img
                  src={imageSrc}
                  alt="AI 應援照"
                  className="block w-full border-[10px] border-white rounded-[20px]"
                />
              ) : (
                <div className="flex aspect-[3/4] w-full items-center justify-center bg-gray-100 text-sm text-gray-500">
                  應援照載入中…
                </div>
              )}
              <p className="pb-3 text-center text-[13px] font-bold tracking-wide text-brand-blue">
                ★ 長按圖片下載影像 ★
              </p>
            </Signboard>
          </div>
        </div>

        {/* CTA + 說明 + 頁尾 */}
        <div className="px-5">
          <CtaPrimaryButton
            elevated
            onClick={() => navigate("/share", { state: { result } })}
          >
            獲取試用組兌換碼
          </CtaPrimaryButton>
          <p className="mt-2 text-center text-[11px] leading-relaxed text-white drop-shadow-sm">
            兌換碼為一次性QR Code，於機台掃描兌換完成後即失效。
          </p>
          <p className="mt-4 text-center text-[11px] leading-relaxed text-white/95 drop-shadow-sm">
            ★ 活動期間：2026/7/3 00時00分 至 2026/8/23 23點59分 ★
          </p>
          <p className="mt-1 text-center text-[11px] leading-relaxed text-white/90">
            *活動詳情與注意事項請參閱{" "}
            <button
              type="button"
              className="text-[#ffe566] underline underline-offset-2"
              onClick={() => setShowRules(true)}
            >
              活動辦法
            </button>
            。
          </p>
        </div>
      </div>

      {showRules && <ActivityRulesPopup onClose={() => setShowRules(false)} />}
    </div>
  );
}
