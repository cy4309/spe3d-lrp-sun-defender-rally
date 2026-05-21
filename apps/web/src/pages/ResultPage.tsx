import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { apiGet } from "@/lib/api";

const CAMPAIGN_CODE =
  (import.meta.env.VITE_CAMPAIGN_CODE as string) || "anthelios-2026-summer";

const A = {
  bg: "/assets/genai_done_qr_page/GenAI_donepage_bg.png",
  slogan: "/assets/genai_done_qr_page/GenAI_donepage_slogan.png",
  frame: "/assets/upload-gen-page/pic_genAI_frame.png",
  logo: "/assets/landing-page-home/lp_logo.png",
  baseball: "/assets/genai_done_qr_page/GenAI_donepage_QR_pic_baseball.png",
  newUvair: "/assets/landing-page-home/landing-page_home_new_uvair.png",
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
  const isMock = auth.phase === "mock";

  useEffect(() => {
    if (isMock) {
      setResult(MOCK_RESULT);
      setLoading(false);
      return;
    }
    apiGet<MeResult>("/api/v1/me/result", { campaign_code: CAMPAIGN_CODE })
      .then((d) => setResult(d))
      .catch(() => navigate("/error"))
      .finally(() => setLoading(false));
  }, [isMock, navigate]);

  if (loading) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-[#1361b5]">
        <div className="spinner w-10 h-10" />
      </div>
    );
  }

  if (!result?.redeem_code) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-4 p-6 text-center bg-[#1361b5]">
        <p className="text-white text-sm">尚無生成結果，請先完成照片上傳。</p>
        <button className="btn btn-primary" onClick={() => navigate("/upload")}>
          去上傳
        </button>
      </div>
    );
  }

  return (
    <div className="relative mx-auto max-w-mobile min-h-dvh overflow-x-hidden">
      {/* Background */}
      <div className="absolute inset-0 z-0 bg-[#1361b5]" />
      <img
        src={A.bg}
        alt=""
        className="absolute inset-0 z-0 w-full h-full object-cover object-center opacity-70"
      />
      {/* gradient overlay so text is readable */}
      <div className="absolute inset-0 z-0 bg-gradient-to-b from-[#1361b5]/60 via-transparent to-[#0a3a78]/80" />

      <div className="relative z-10 flex flex-col min-h-dvh">
        {/* Header */}
        <div className="px-4 pt-4 pb-1">
          <img src={A.logo} alt="LA ROCHE-POSAY 理膚寶水" className="h-8 object-contain" />
        </div>

        {/* Slogan */}
        <div className="px-4 pt-2 pb-3">
          <img
            src={A.slogan}
            alt="理膚寶水 NEW UVAIR 和您一起熱血應援!! 守護陽光下的每一刻"
            className="w-full max-w-[360px]"
          />
        </div>

        {/* AI photo */}
        <div className="flex-1 flex flex-col items-center justify-center px-6 py-2">
          <div className="relative w-full max-w-[300px]">
            {result.result_image_url ? (
              <img
                src={result.result_image_url}
                alt="AI 應援照"
                className="w-full rounded-2xl block shadow-2xl"
              />
            ) : (
              <div
                className="aspect-[3/4] w-full rounded-2xl flex flex-col items-center justify-center gap-2"
                style={{ background: "rgba(255,255,255,0.15)", backdropFilter: "blur(6px)" }}
              >
                <div className="flex items-center gap-2">
                  <img src={A.newUvair} alt="NEW" className="h-5 object-contain" />
                  <span className="text-white font-black text-xl tracking-widest">UVAIR</span>
                </div>
                <p className="text-white/60 text-sm text-center px-6">
                  {isMock ? "（Mock 模式：圖片待生成）" : "AI 應援照"}
                </p>
              </div>
            )}
            {/* Frame overlay */}
            <img
              src={A.frame}
              alt=""
              className="pointer-events-none absolute inset-0 w-full h-full"
            />
          </div>

          {/* Baseball decoration */}
          <img
            src={A.baseball}
            alt=""
            className="w-12 mt-3 drop-shadow-lg"
            aria-hidden
          />
        </div>

        {/* Bottom CTA */}
        <div className="px-5 pt-3 pb-6">
          <button
            type="button"
            className="cta-primary w-full py-4 text-[17px] tracking-wide shadow-2xl"
            onClick={() => navigate("/share", { state: { result } })}
          >
            前往領取試用組兌換碼
          </button>
          <p className="text-center text-white/60 text-[11px] mt-2">
            ★活動期間：2026/7/3 00時00分 至 2026/8/23 23點59分★
          </p>
        </div>
      </div>
    </div>
  );
}
