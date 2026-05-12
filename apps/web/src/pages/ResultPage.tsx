import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Layout from "@/components/Layout";
import { useAuth } from "@/contexts/AuthContext";
import { apiGet } from "@/lib/api";

const CAMPAIGN_CODE =
  (import.meta.env.VITE_CAMPAIGN_CODE as string) || "anthelios-2026-summer";

type MeResult = {
  user_campaign_id: string;
  status: string;
  result_image_url: string | null;
  redeem_code: { code: string; qr_payload: string; status: string; expires_at: string } | null;
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
      <Layout>
        <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 text-gray-400">
          <div className="spinner w-10 h-10" />
          <p>載入中…</p>
        </div>
      </Layout>
    );
  }

  if (!result?.redeem_code) {
    return (
      <Layout>
        <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 text-center">
          <p className="text-gray-500 text-sm">尚無生成結果，請先完成照片上傳。</p>
          <button className="btn btn-primary" onClick={() => navigate("/upload")}>
            去上傳
          </button>
        </div>
      </Layout>
    );
  }

  return (
    <Layout
      cta={
        <button
          className="btn btn-primary btn-block"
          onClick={() => navigate("/share", { state: { result } })}
        >
          取得試用兌換組
        </button>
      }
    >
      <div className="flex flex-col gap-4">
        <h2 className="text-xl font-bold text-brand-blue">你的應援照來囉！</h2>

        {result.result_image_url ? (
          <img
            src={result.result_image_url}
            alt="AI 應援照"
            className="w-full rounded-xl block"
          />
        ) : (
          <div className="w-full min-h-64 rounded-xl bg-gradient-to-br from-blue-50 to-blue-100 flex items-center justify-center text-brand-blue text-sm font-semibold">
            {isMock ? "（Mock 模式：圖片待生成）" : "AI 應援照"}
          </div>
        )}

        <p className="text-sm text-gray-500 text-center">
          按下方按鈕取得現場兌換 QR Code，並分享到 LINE 參加抽獎！
        </p>
      </div>
    </Layout>
  );
}
