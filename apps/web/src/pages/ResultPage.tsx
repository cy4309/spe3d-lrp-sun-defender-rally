import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { QRCodeSVG } from "qrcode.react";
import Layout from "@/components/Layout";
import { useAuth } from "@/contexts/AuthContext";
import { ApiError, apiGet, apiPost } from "@/lib/api";
import { shareTargetPicker } from "@/lib/liff";

const CAMPAIGN_CODE =
  (import.meta.env.VITE_CAMPAIGN_CODE as string) || "anthelios-2026-summer";
const LIFF_URL = import.meta.env.VITE_LIFF_URL as string | undefined;

type RedeemCode = { code: string; qr_payload: string; status: string; expires_at: string };
type MeResult = {
  user_campaign_id: string;
  status: string;
  result_image_url: string | null;
  redeem_code: RedeemCode | null;
  channel_code: string | null;
};

const MOCK_RESULT: MeResult = {
  user_campaign_id: "mock-uc",
  status: "generated",
  result_image_url: null,
  redeem_code: { code: "MOCKQR01", qr_payload: "https://example.com/redeem?code=MOCKQR01", status: "unused", expires_at: "2026-08-31T23:59:00+08:00" },
  channel_code: null,
};

export default function ResultPage() {
  const auth = useAuth();
  const navigate = useNavigate();
  const [result, setResult] = useState<MeResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [ucStatus, setUcStatus] = useState("");
  const [channelCode, setChannelCode] = useState<string | null>(null);
  const [sharing, setSharing] = useState(false);
  const [claiming, setClaiming] = useState(false);
  const [claimErr, setClaimErr] = useState<string | null>(null);
  const isMock = auth.phase === "mock";

  useEffect(() => {
    if (isMock) {
      setResult(MOCK_RESULT); setUcStatus(MOCK_RESULT.status);
      setChannelCode(MOCK_RESULT.channel_code); setLoading(false); return;
    }
    apiGet<MeResult>("/api/v1/me/result", { campaign_code: CAMPAIGN_CODE })
      .then((d) => { setResult(d); setUcStatus(d.status); setChannelCode(d.channel_code); })
      .catch(() => navigate("/error"))
      .finally(() => setLoading(false));
  }, [isMock, navigate]);

  async function handleShare() {
    setSharing(true);
    try {
      const ok = await shareTargetPicker([{
        type: "flex", altText: "我做了安得利防曬應援照，快來一起！",
        contents: {
          type: "bubble",
          body: {
            type: "box", layout: "vertical",
            contents: [
              { type: "text", text: "La Roche-Posay 安得利防曬應援", weight: "bold", color: "#0a4a8c" },
              { type: "text", text: "快來生成你的應援照，到現場兌換試用包！", wrap: true, margin: "md" },
              ...(LIFF_URL ? [{ type: "button", style: "primary", margin: "lg", action: { type: "uri", label: "立即參加", uri: LIFF_URL } }] : []),
            ],
          },
        },
      }]);
      if (ok) {
        await apiPost("/api/v1/me/share", { target: "line" }, { campaign_code: CAMPAIGN_CODE });
        setUcStatus("shared");
      }
    } catch { /* cancelled or error */ } finally { setSharing(false); }
  }

  async function handleClaimCode() {
    setClaiming(true); setClaimErr(null);
    try {
      const d = await apiPost<{ code: string }>("/api/v1/me/channel-code", undefined, { campaign_code: CAMPAIGN_CODE });
      setChannelCode(d.code);
    } catch (e) {
      setClaimErr(e instanceof ApiError && e.code === "channel_code_pool_empty" ? "通路折扣碼已發送完畢" : "領取失敗，請稍後再試");
    } finally { setClaiming(false); }
  }

  if (loading) {
    return (
      <Layout>
        <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 text-gray-400">
          <div className="spinner w-10 h-10" /><p>載入中…</p>
        </div>
      </Layout>
    );
  }

  if (!result?.redeem_code) {
    return (
      <Layout>
        <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 text-center">
          <p className="text-gray-500 text-sm">尚無生成結果，請先完成照片上傳。</p>
          <button className="btn btn-primary" onClick={() => navigate("/upload")}>去上傳</button>
        </div>
      </Layout>
    );
  }

  const { redeem_code, result_image_url } = result;
  const alreadyShared = ucStatus === "shared";

  return (
    <Layout>
      <div className="flex flex-col gap-4">
        <h2 className="text-xl font-bold text-brand-blue">你的應援照來囉！</h2>

        {result_image_url ? (
          <img src={result_image_url} alt="AI 應援照" className="w-full rounded-xl block" />
        ) : (
          <div className="w-full min-h-48 rounded-xl bg-gradient-to-br from-blue-50 to-blue-100 flex items-center justify-center text-brand-blue text-sm font-semibold">
            {isMock ? "（Mock 模式：圖片待生成）" : "AI 應援照"}
          </div>
        )}

        {/* QR Code */}
        <div className="card text-center">
          <h3 className="text-[15px] font-semibold text-brand-blue mb-1">兌換 QR Code</h3>
          <p className="text-xs text-gray-500 mb-4">到現場機台出示，兌換安得利防曬試用包（每人限 1 份）</p>
          <div className="flex justify-center mb-3">
            <QRCodeSVG value={redeem_code.qr_payload} size={180} />
          </div>
          <p className="text-2xl font-extrabold tracking-[3px] text-brand-blue mb-1">{redeem_code.code}</p>
          <p className="text-xs text-gray-400">
            有效期限：{new Date(redeem_code.expires_at).toLocaleDateString("zh-TW")}
          </p>
        </div>

        {/* Share */}
        <button
          className="btn btn-primary btn-block"
          onClick={handleShare}
          disabled={sharing || alreadyShared}
        >
          {alreadyShared ? "已分享（已取得抽獎資格）" : sharing ? "分享中…" : "分享到 LINE 參加抽獎"}
        </button>

        {/* Channel code */}
        {channelCode ? (
          <div className="card text-center">
            <h3 className="text-[15px] font-semibold text-brand-blue mb-2">通路折扣碼</h3>
            <span className="inline-block bg-blue-50 text-brand-blue text-xl font-bold tracking-[2px] rounded-lg px-6 py-2.5">
              {channelCode}
            </span>
          </div>
        ) : (
          <div className="flex flex-col gap-1">
            <button className="btn btn-outline btn-block" onClick={handleClaimCode} disabled={claiming}>
              {claiming ? "領取中…" : "領取通路折扣碼"}
            </button>
            {claimErr && <p className="text-red-500 text-xs text-center">{claimErr}</p>}
          </div>
        )}
      </div>
    </Layout>
  );
}
