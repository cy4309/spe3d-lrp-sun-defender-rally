import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { QRCodeSVG } from "qrcode.react";
import ActivityRulesPopup from "@/components/ActivityRulesPopup";
import ModalOverlay from "@/components/ModalOverlay";
import Signboard from "@/components/Signboard";
import SlantedBorder from "@/components/SlantedBorder";
import { useAuth } from "@/contexts/AuthContext";
import { ApiError, apiGet, apiPost, apiPostForm } from "@/lib/api";
import { buildShareCardImage, resolveShareImageUrl, SHARE_CARD_ASPECT_RATIO } from "@/lib/shareCardImage";
import { shareTargetPicker } from "@/lib/liff";

const CAMPAIGN_CODE = (import.meta.env.VITE_CAMPAIGN_CODE as string) || "anthelios-2026-summer";
const LIFF_URL = import.meta.env.VITE_LIFF_URL as string | undefined;

const A = {
  bg: "/assets/genai_done_qr_page/GenAI_donepage_QR_bg1.png",
  bg2: "/assets/genai_done_qr_page/GenAI_donepage_QR_bg2.png",
  bg2Cover: "/assets/genai_done_qr_page/GenAI_donepage_QR_bg2_cover.png",
  shareBubble: "/assets/genai_done_qr_page/GenAI_donepage_QR_share1.png",
  picbot: "/assets/genai_done_qr_page/GenAI_donepage_QR_pic_picbot.png",
  sample: "/assets/genai_done_qr_page/GenAI_donepage_QR_pic_sample.png",
  logo: "/assets/landing-page-home/lp_logo.png",
} as const;

const VENUES = [
  {
    title: "台北天母棒球場｜賽事限定",
    dates: "活動日期：7/3(五)、7/4(六)、7/5(日)",
    booth: "2 樓用餐休息區（三壘側 H 區）",
  },
  {
    title: "台中漢神洲際購物廣場",
    dates: "活動日期：7/6(一)～8/2(日)",
    booth: "4 樓運動用品區",
    dividerBefore: true,
  },
  {
    title: "高雄澄清湖棒球場｜賽事限定",
    dates: "活動日期：8/5(三)、8/7(五)、8/8(六)、8/9(日)、8/11(二)、8/12(三)、8/21(五)、8/22(六)、8/23(日)",
    booth: "三壘側品牌活動區",
    dividerBefore: true,
  },
] as const;

type RedeemCode = {
  code: string;
  qr_payload: string;
  status: string;
  expires_at: string;
};
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
  redeem_code: {
    code: "MOCKQR01",
    qr_payload: "https://example.com/redeem?code=MOCKQR01",
    status: "unused",
    expires_at: "2026-08-31T23:59:00+08:00",
  },
  channel_code: null,
};

type DiscountType = "momo" | "shopee" | "watsons" | "cosmed";

const TEXT_PLATFORMS: Record<"momo" | "shopee" | "cosmed", { label: string; color: string }> = {
  momo: { label: "momo 購物", color: "#c0392b" },
  shopee: { label: "蝦皮購物", color: "#f26522" },
  cosmed: { label: "康是美", color: "#e60012" },
};

/** Share confirmation popup (5_2-share-popup) */
function SharePopup({ onClose, onConfirm, sharing }: { onClose: () => void; onConfirm: () => void; sharing: boolean }) {
  return (
    <ModalOverlay onClose={onClose}>
      <>
        <img src={A.shareBubble} alt="分享應援活動 參加抽籤！" className="w-full" />
        <div className="mt-3 px-2">
          <button type="button" className="cta-primary w-full py-4 text-[17px] tracking-widest disabled:opacity-40" onClick={onConfirm} disabled={sharing}>
            {sharing ? "分享中…" : "立即分享 >>"}
          </button>
        </div>
      </>
    </ModalOverlay>
  );
}

/** Watson's barcode popup (5_4) */
function BarcodePopup({ code, onClose }: { code: string; onClose: () => void }) {
  return (
    <ModalOverlay onClose={onClose}>
      <Signboard>
        <div className="px-6 py-6 text-center">
          <h2 className="mb-1 text-xl font-black text-brand-blue">您的通路折扣碼</h2>
          <SlantedBorder className="mb-4" />
          <p className="mb-4 text-sm font-semibold text-gray-700">WSN 安得利系列防曬商品折價券</p>
          <div className="relative mx-auto mb-1 w-full max-w-[260px]">
            <div
              className="h-20 w-full"
              style={{
                backgroundImage: "repeating-linear-gradient(90deg, #000 0px, #000 2px, transparent 2px, transparent 5px, #000 5px, #000 6px, transparent 6px, transparent 9px, #000 9px, #000 12px, transparent 12px, transparent 14px)",
              }}
            />
          </div>
          <p className="mb-4 font-mono text-sm tracking-widest text-gray-800">{code}</p>
          <p className="mb-1 text-[11px] text-gray-400">★ 長按圖片下載條碼 ★</p>
          <p className="mb-4 text-xs text-gray-600">
            請持此條碼前往屈臣氏門市購物使用。
            <br />
            效期：2026/7/1–2026/12/31
          </p>
          <button type="button" className="btn btn-secondary btn-block py-3 text-sm" onClick={onClose}>
            確認
          </button>
        </div>
      </Signboard>
    </ModalOverlay>
  );
}

/** Text code popup for momo / Shopee / Cosmed (5_5) */
function TextCodePopup({ platform, code, onClose }: { platform: "momo" | "shopee" | "cosmed"; code: string; onClose: () => void }) {
  const [copied, setCopied] = useState(false);
  const { label, color } = TEXT_PLATFORMS[platform];

  async function handleCopy() {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <ModalOverlay onClose={onClose}>
      <Signboard>
        <div className="px-6 py-6 text-center">
          <h2 className="mb-1 text-xl font-black text-brand-blue">您的通路折扣碼</h2>
          <SlantedBorder className="mb-5" />
          <p className="mb-3 text-sm font-semibold text-gray-600">{label}折扣碼：</p>
          <div className="mx-auto mb-5 rounded-xl px-6 py-4 text-3xl font-black tracking-[4px]" style={{ background: `${color}15`, border: `2px solid ${color}40`, color }}>
            {code}
          </div>
          <div className="flex flex-col gap-2">
            <button type="button" className="w-full rounded-full py-3.5 text-sm font-bold text-white" style={{ background: color }} onClick={() => void handleCopy()}>
              {copied ? "已複製！" : "複製折扣碼"}
            </button>
            <button type="button" className="btn btn-outline btn-block py-3 text-sm" onClick={onClose}>
              前往活動頁領券
            </button>
          </div>
        </div>
      </Signboard>
    </ModalOverlay>
  );
}

function VenueBlock({ venue, onMapClick }: { venue: (typeof VENUES)[number]; onMapClick: () => void }) {
  const withDivider = "dividerBefore" in venue && venue.dividerBefore;

  return (
    <div className={`text-[11px] leading-relaxed text-gray-800 ${withDivider ? "border-t border-brand-blue pt-3" : ""}`}>
      <p className="font-bold text-brand-blue">{venue.title}</p>
      <p>{venue.dates}</p>
      <p>派樣機地點：{venue.booth}</p>
      <p>
        <button type="button" className="font-bold text-brand-orange underline underline-offset-2" onClick={onMapClick}>
          機台位置圖
        </button>
      </p>
    </div>
  );
}

export default function SharePage() {
  const auth = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const isMock = auth.phase === "mock";

  const passedResult = (location.state as { result?: MeResult } | null)?.result;

  const [result, setResult] = useState<MeResult | null>(passedResult ?? null);
  const [loading, setLoading] = useState(!passedResult && !isMock);
  const [channelCode, setChannelCode] = useState<string | null>(passedResult?.channel_code ?? null);

  const [showSharePopup, setShowSharePopup] = useState(false);
  const [showRules, setShowRules] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [shareErr, setShareErr] = useState<string | null>(null);
  const [showDiscountPopup, setShowDiscountPopup] = useState<DiscountType | null>(null);
  const [claiming, setClaiming] = useState(false);
  const [claimErr, setClaimErr] = useState<string | null>(null);

  useEffect(() => {
    if (isMock) {
      setResult(MOCK_RESULT);
      setChannelCode(MOCK_RESULT.channel_code);
      setLoading(false);
      return;
    }
    if (passedResult) return;
    apiGet<MeResult>("/api/v1/me/result", { campaign_code: CAMPAIGN_CODE })
      .then((d) => {
        setResult(d);
        setChannelCode(d.channel_code);
      })
      .catch(() => navigate("/error"))
      .finally(() => setLoading(false));
  }, [isMock, navigate, passedResult]);

  async function handleShare() {
    if (!result) return;

    setSharing(true);
    setShareErr(null);
    let mockObjectUrl: string | null = null;
    try {
      const base = window.location.origin;
      const actionUrl = LIFF_URL ?? base;
      const safeActionUrl = actionUrl.startsWith("https://") ? actionUrl : null;

      const photoUrl = result.result_image_url ?? (isMock ? `${base}${A.sample}` : null);
      if (!photoUrl) {
        setShareErr("尚無應援照可分享，請先完成 AI 生成");
        return;
      }

      const cardBlob = await buildShareCardImage(photoUrl);

      let heroUrl: string;
      if (isMock) {
        mockObjectUrl = URL.createObjectURL(cardBlob);
        heroUrl = mockObjectUrl;
      } else {
        const form = new FormData();
        form.append("file", cardBlob, "share-card.png");
        const uploadUrl = new URL("/api/v1/me/share-card", window.location.origin);
        uploadUrl.searchParams.set("campaign_code", CAMPAIGN_CODE);
        const uploaded = await apiPostForm<{ share_image_url: string }>(uploadUrl.pathname + uploadUrl.search, form);
        heroUrl = resolveShareImageUrl(uploaded.share_image_url);
        if (!heroUrl.startsWith("https://")) {
          setShareErr("分享圖須為 HTTPS 絕對網址，請確認 ngrok 已指向本機且 IMAGE_BASE_URL=/img");
          return;
        }
      }

      // 先關閉彈窗，避免 Modal 擋住 LINE 分享選人畫面
      setShowSharePopup(false);

      const ok = await shareTargetPicker([
        {
          type: "flex",
          altText: "我做了安得利防曬應援照，快來一起參加！",
          contents: {
            type: "bubble",
            size: "giga",
            hero: {
              type: "image",
              url: heroUrl,
              size: "full",
              aspectRatio: SHARE_CARD_ASPECT_RATIO,
              aspectMode: "cover",
              ...(safeActionUrl ? { action: { type: "uri", uri: safeActionUrl } } : {}),
            },
          },
        },
      ]);
      if (ok) {
        if (!isMock) {
          await apiPost("/api/v1/me/share", { target: "line" }, { campaign_code: CAMPAIGN_CODE });
        }
        setShareErr("✅ LINE 回傳分享成功（ok=true）");
      } else {
        setShareErr("分享取消或失敗（ok=false），請再試一次");
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setShareErr(`分享失敗：${msg}`);
    } finally {
      if (mockObjectUrl) URL.revokeObjectURL(mockObjectUrl);
      setSharing(false);
    }
  }

  async function handleClaimCode() {
    setClaiming(true);
    setClaimErr(null);
    try {
      const d = await apiPost<{ code: string }>("/api/v1/me/channel-code", undefined, {
        campaign_code: CAMPAIGN_CODE,
      });
      setChannelCode(d.code);
    } catch (e) {
      setClaimErr(e instanceof ApiError && e.code === "channel_code_pool_empty" ? "通路折扣碼已發送完畢" : "領取失敗，請稍後再試");
    } finally {
      setClaiming(false);
    }
  }

  function handleDiscountClick(type: DiscountType) {
    if (!channelCode) {
      void handleClaimCode().then(() => setShowDiscountPopup(type));
    } else {
      setShowDiscountPopup(type);
    }
  }

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
        <p className="text-sm text-white">找不到兌換資料，請重新從首頁進入。</p>
        <button type="button" className="btn btn-primary" onClick={() => navigate("/")}>
          回首頁
        </button>
      </div>
    );
  }

  const { redeem_code } = result;

  return (
    <>
      <div className="relative mx-auto min-h-dvh max-w-mobile overflow-x-hidden">
        {/* 背景：上半球場、下半藍底（bg2 + cover 疊加） */}
        <div className="pointer-events-none absolute inset-0 z-0" aria-hidden>
          <img src={A.bg} alt="" className="absolute inset-x-0 top-0 h-[100vh] w-full object-cover object-top" />
          <div className="absolute inset-x-0 top-[100vh] bottom-0">
            <img src={A.bg2} alt="" className="absolute inset-0 h-full w-full object-cover object-bottom" />
            <img src={A.bg2Cover} alt="" className="absolute inset-0 h-full w-full object-cover object-center" />
          </div>
        </div>

        <div className="relative z-10 px-8 pb-8">
          <img src={A.logo} alt="LA ROCHE-POSAY 理膚寶水" className="mb-4 h-8 object-contain object-left drop-shadow" />

          {/* 專屬兌換碼 Signboard */}
          <Signboard className="mb-4">
            <div className="px-8 py-5 text-center">
              <h1 className="mb-1 text-xl font-black text-gray-900">您的專屬兌換碼</h1>
              <SlantedBorder className="mb-4" />

              <div className="mx-auto mb-3 flex justify-center rounded-xl bg-white p-3">
                <QRCodeSVG value={redeem_code.qr_payload} size={200} fgColor="#003e89" />
              </div>

              <p className="mb-3 text-[12px] font-bold tracking-wide text-gray-400">★ 長按圖片下載 QR Code ★</p>

              <p className="text-[11px] leading-relaxed text-gray-800">
                請持此 QR Code 前往
                <span className="font-bold text-brand-orange">指定地點</span>
              </p>
              <p className="mt-2 text-[11px] leading-relaxed text-gray-800">設置的派樣機台，掃碼兌換試用組，</p>
              <p className="pb-4 mt-2 text-[11px] leading-relaxed text-gray-800">每人限領1組，數量有限，送完為止。</p>

              <div className="flex items-start gap-3 border-t border-brand-blue pt-3 text-left">
                <img src={A.sample} alt="防曬淨痘試用組" className="w-[96px] shrink-0 object-contain sm:w-[108px]" />
                <div className="min-w-0 text-[11px] leading-relaxed text-gray-800">
                  <p className="font-bold text-brand-blue">「防曬淨痘試用組」內容包含：</p>
                  <ul className="mt-1.5 space-y-1">
                    <li>安得利清爽極效夏卡防曬液 3ml x 2</li>
                    <li>淨痘無瑕極效精華 3ml x 1</li>
                  </ul>
                </div>
              </div>
            </div>
          </Signboard>

          {/* CTA 按鈕區 */}
          <div className="mb-4 space-y-2.5">
            <button type="button" className="cta-primary w-full py-4 text-[17px] tracking-[0.06em] disabled:opacity-40" onClick={() => setShowSharePopup(true)} disabled={sharing}>
              {sharing ? "分享中…" : "分享活動 參加抽籤"}
            </button>

            <button type="button" className="share-cta disabled:opacity-50" onClick={() => handleDiscountClick("momo")} disabled={claiming}>
              領取 momo 折扣碼
            </button>
            <button type="button" className="share-cta disabled:opacity-50" onClick={() => handleDiscountClick("shopee")} disabled={claiming}>
              領取蝦皮折扣碼
            </button>
            <button type="button" className="share-cta disabled:opacity-50" onClick={() => handleDiscountClick("watsons")} disabled={claiming}>
              領取屈臣氏折扣碼
            </button>
            <button type="button" className="share-cta disabled:opacity-50" onClick={() => handleDiscountClick("cosmed")} disabled={claiming}>
              領取康是美折扣碼
            </button>
          </div>

          {shareErr && <p className="mb-2 text-center text-xs text-red-600 drop-shadow-sm">{shareErr}</p>}
          {claimErr && <p className="mb-2 text-center text-xs text-red-600 drop-shadow-sm">{claimErr}</p>}

          {/* 活動日期及指定地點 Signboard */}
          <Signboard className="mb-4">
            <div className="px-8 py-5">
              <h2 className="mb-1 text-center text-lg font-black text-gray-900">活動日期及指定地點</h2>
              <SlantedBorder className="mb-4" />
              <div className="space-y-4">
                {VENUES.map((venue) => (
                  <VenueBlock key={venue.title} venue={venue} onMapClick={() => setShowRules(true)} />
                ))}
              </div>
            </div>
          </Signboard>

          <img src={A.picbot} alt="活動派樣機台" className="mx-auto block w-[88%] max-w-[320px]" />
        </div>

        {showSharePopup && <SharePopup onClose={() => setShowSharePopup(false)} onConfirm={() => void handleShare()} sharing={sharing} />}

        {showRules && <ActivityRulesPopup onClose={() => setShowRules(false)} />}

        {showDiscountPopup === "watsons" && <BarcodePopup code={channelCode ?? "---"} onClose={() => setShowDiscountPopup(null)} />}

        {(showDiscountPopup === "momo" || showDiscountPopup === "shopee" || showDiscountPopup === "cosmed") && <TextCodePopup platform={showDiscountPopup} code={channelCode ?? "---"} onClose={() => setShowDiscountPopup(null)} />}
      </div>
      <footer className="bg-white px-5 py-4 text-center">
        <p className="text-center text-[11px] text-gray-900">
          *活動詳情與注意事項請參閱{" "}
          <button type="button" className="text-brand-blue underline underline-offset-2" onClick={() => setShowRules(true)}>
            活動辦法
          </button>
          。
        </p>
      </footer>
    </>
  );
}
