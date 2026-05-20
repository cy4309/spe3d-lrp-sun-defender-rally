import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { QRCodeSVG } from "qrcode.react";
import CloseButton from "@/components/CloseButton";
import { useAuth } from "@/contexts/AuthContext";
import { ApiError, apiGet, apiPost } from "@/lib/api";
import { shareTargetPicker } from "@/lib/liff";

const CAMPAIGN_CODE = (import.meta.env.VITE_CAMPAIGN_CODE as string) || "anthelios-2026-summer";
const LIFF_URL = import.meta.env.VITE_LIFF_URL as string | undefined;

const A = {
  bgStadium: "/assets/genai_done_qr_page/GenAI_donepage_QR_bg1.png",
  bgBlue: "/assets/genai_done_qr_page/GenAI_donepage_QR_bg2.png",
  bgBlueCover: "/assets/genai_done_qr_page/GenAI_donepage_QR_bg2_cover.png",
  shareBubble: "/assets/genai_done_qr_page/GenAI_donepage_QR_share1.png",
  picbot: "/assets/genai_done_qr_page/GenAI_donepage_QR_pic_picbot.png",
  logo: "/assets/landing-page-home/lp_logo.png",
} as const;

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

type DiscountType = "momo" | "shopee" | "watsons";

function SlantedBorder({ className = "" }: { className?: string }) {
  return (
    <div className={`flex items-center justify-center gap-[4px] overflow-hidden ${className}`} aria-hidden>
      {Array.from({ length: 18 }).map((_, i) => (
        <span key={i} className="block h-[4px] w-5 rounded-sm bg-brand-blue -skew-x-[28deg]" />
      ))}
    </div>
  );
}

/** Modal backdrop */
function Overlay({ onClose, children }: { onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-5" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="relative w-full max-w-sm">
        {children}
      </div>
    </div>
  );
}

/** Share confirmation popup (5_2-share-popup) */
function SharePopup({ onClose, onConfirm, sharing }: { onClose: () => void; onConfirm: () => void; sharing: boolean }) {
  return (
    <Overlay onClose={onClose}>
      <div className="relative">
        <CloseButton onClick={onClose} label="關閉" className="absolute -right-2 -top-2 z-10" />
        {/* Bubble image */}
        <img src={A.shareBubble} alt="分享應援活動 參加抽籤！" className="w-full" />
        {/* CTA below bubble */}
        <div className="mt-3 px-2">
          <button
            type="button"
            className="w-full rounded-full py-4 text-[17px] font-black text-white tracking-widest disabled:opacity-40"
            style={{
              background: "linear-gradient(180deg, #1e7bdc 0%, #0a4a8c 100%)",
              border: "3px solid #fff",
              boxShadow: "0 4px 16px rgba(0,0,0,0.3)",
            }}
            onClick={onConfirm}
            disabled={sharing}
          >
            {sharing ? "分享中…" : "立即分享 >>"}
          </button>
        </div>
      </div>
    </Overlay>
  );
}

/** Watson's barcode popup (5_4) */
function BarcodePopup({ code, onClose }: { code: string; onClose: () => void }) {
  return (
    <Overlay onClose={onClose}>
      <div className="rounded-2xl bg-white shadow-2xl overflow-hidden">
        <CloseButton onClick={onClose} label="關閉" className="absolute -right-2 -top-2 z-10" />
        <div className="px-6 py-6 text-center">
          <h2 className="text-xl font-black text-brand-blue mb-1">您的通路折扣碼</h2>
          <SlantedBorder className="mb-4" />
          <p className="text-sm font-semibold text-gray-700 mb-4">WSN 安得利系列防曬商品折價券</p>
          {/* Barcode visual — replace with a real barcode library if needed */}
          <div className="relative mx-auto w-full max-w-[260px] mb-1">
            <div
              className="h-20 w-full"
              style={{
                backgroundImage: "repeating-linear-gradient(90deg, #000 0px, #000 2px, transparent 2px, transparent 5px, #000 5px, #000 6px, transparent 6px, transparent 9px, #000 9px, #000 12px, transparent 12px, transparent 14px)",
              }}
            />
          </div>
          <p className="font-mono text-sm tracking-widest text-gray-800 mb-4">{code}</p>
          <p className="text-[11px] text-gray-400 mb-1">★ 長按圖片下載條碼 ★</p>
          <p className="text-xs text-gray-600 mb-4">
            請持此條碼前往屈臣氏門市購物使用。
            <br />
            效期：2026/7/1–2026/12/31
          </p>
          <button type="button" className="w-full rounded-full bg-[#009bdf] py-3 text-sm font-bold text-white" onClick={onClose}>
            確認
          </button>
        </div>
      </div>
    </Overlay>
  );
}

/** Text code popup for momo / Shopee (5_5) */
function TextCodePopup({ platform, code, onClose }: { platform: "momo" | "shopee"; code: string; onClose: () => void }) {
  const [copied, setCopied] = useState(false);
  const platformLabel = platform === "momo" ? "momo 購物" : "蝦皮購物";
  const platformColor = platform === "momo" ? "#c0392b" : "#f26522";

  async function handleCopy() {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <Overlay onClose={onClose}>
      <div className="rounded-2xl bg-white shadow-2xl overflow-hidden">
        <CloseButton onClick={onClose} label="關閉" className="absolute -right-2 -top-2 z-10" />
        <div className="px-6 py-6 text-center">
          <h2 className="text-xl font-black text-brand-blue mb-1">您的通路折扣碼</h2>
          <SlantedBorder className="mb-5" />
          <p className="text-sm font-semibold text-gray-600 mb-3">{platformLabel}折扣碼：</p>
          <div className="mx-auto mb-5 rounded-xl px-6 py-4 text-3xl font-black tracking-[4px]" style={{ background: `${platformColor}15`, border: `2px solid ${platformColor}40`, color: platformColor }}>
            {code}
          </div>
          <div className="flex flex-col gap-2">
            <button type="button" className="w-full rounded-full py-3.5 text-sm font-bold text-white" style={{ background: platformColor }} onClick={() => void handleCopy()}>
              {copied ? "已複製！" : "複製折扣碼"}
            </button>
            <button type="button" className="w-full rounded-full py-3 text-sm font-semibold text-gray-600 border border-gray-300" onClick={onClose}>
              前往活動頁領券
            </button>
          </div>
        </div>
      </div>
    </Overlay>
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
    setSharing(true);
    setShareErr(null);
    try {
      const base = window.location.origin;
      const actionUrl = LIFF_URL ?? base;
      // LINE uri action 必須是 HTTPS；localhost (HTTP) 會被 LINE 後端靜默丟棄
      const safeActionUrl = actionUrl.startsWith("https://") ? actionUrl : null;
      // AI 生成圖 URL（S3/CDN 公開路徑）；dev fallback 用 LINE 官方測試圖
      // const heroUrl = result?.result_image_url ?? "https://scdn.line-apps.com/n/channel_devcenter/img/fx/01_1_cafe.png";
      const heroUrl = "https://scdn.line-apps.com/n/channel_devcenter/img/fx/01_1_cafe.png";

      // 品牌疊加素材 base URL
      // dev (ngrok): VITE_SHARE_ASSET_BASE=https://xxxx.ngrok-free.app/public
      // prod (CDN):  VITE_SHARE_ASSET_BASE=https://your-cdn.com  (public/ 內容在根目錄)
      const shareAssetBase = (import.meta.env.VITE_SHARE_ASSET_BASE as string | undefined) ?? (base.startsWith("https://") ? `${base}/public` : null);
      const asset = (path: string) => (shareAssetBase ? `${shareAssetBase}/assets/landing-page-home/${path}` : null);

      const ok = await shareTargetPicker([
        {
          type: "flex",
          altText: "我做了安得利防曬應援照，快來一起參加！",
          contents: {
            type: "bubble",
            // Hero：以 AI 生成圖為底，疊加品牌素材
            hero: {
              type: "box",
              layout: "vertical",
              paddingAll: "none",
              ...(safeActionUrl ? { action: { type: "uri", uri: safeActionUrl } } : {}),
              contents: [
                // ① 底圖：AI 生成照
                {
                  type: "image",
                  url: heroUrl,
                  size: "full",
                  aspectRatio: "20:13",
                  aspectMode: "cover",
                  flex: 1,
                },
                // ② 疊加：LA ROCHE-POSAY logo（左上）
                ...(asset("lp_logo.png")
                  ? [
                      {
                        type: "image" as const,
                        url: asset("lp_logo.png")!,
                        position: "absolute" as const,
                        offsetTop: "sm",
                        offsetStart: "sm",
                        size: "90px",
                        aspectMode: "fit" as const,
                      },
                    ]
                  : []),
                // ③ 疊加：台灣皮膚科醫師 No.1 badge（右上）
                ...(asset("tw_no1_logo.png")
                  ? [
                      {
                        type: "image" as const,
                        url: asset("tw_no1_logo.png")!,
                        position: "absolute" as const,
                        offsetTop: "sm",
                        offsetEnd: "sm",
                        size: "50px",
                        aspectMode: "fit" as const,
                      },
                    ]
                  : []),
                // ④ 疊加：活動名稱「理膚防曬應援 今夏不怕曬」（置中下方）
                ...(asset("landing-page_home_event_name.png")
                  ? [
                      {
                        type: "image" as const,
                        url: asset("landing-page_home_event_name.png")!,
                        position: "absolute" as const,
                        offsetBottom: "xl",
                        offsetStart: "sm",
                        offsetEnd: "sm",
                        size: "full",
                        aspectMode: "fit" as const,
                      },
                    ]
                  : []),
                // ⑤ 疊加：CTA 文字圖「立即製作...」（最下方）
                ...(asset("landing-page_home_cta.png")
                  ? [
                      {
                        type: "image" as const,
                        url: asset("landing-page_home_cta.png")!,
                        position: "absolute" as const,
                        offsetBottom: "xs",
                        offsetStart: "sm",
                        offsetEnd: "sm",
                        size: "full",
                        aspectMode: "fit" as const,
                      },
                    ]
                  : []),
              ],
            },
            footer: {
              type: "box",
              layout: "horizontal",
              spacing: "sm",
              contents: [
                {
                  type: "button",
                  style: "primary",
                  color: "#f47a1f",
                  height: "sm",
                  action: {
                    type: "uri",
                    label: "我要參加 >>",
                    uri: safeActionUrl ?? "https://line.me",
                  },
                },
              ],
              flex: 0,
            },
          },
        },
      ]);
      console.log("[share] shareTargetPicker ok:", ok);
      if (ok) {
        // mock 模式下無 auth token，跳過 API call 直接更新 UI
        if (!isMock) {
          await apiPost("/api/v1/me/share", { target: "line" }, { campaign_code: CAMPAIGN_CODE });
        }
        setShowSharePopup(false);
        setShareErr("✅ LINE 回傳分享成功（ok=true）"); // 暫時顯示確認，確認後可移除
      } else {
        // 使用者在 LINE 選友人介面取消了分享，或 LINE 回傳非 success
        setShareErr("分享取消或失敗（ok=false），請再試一次");
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error("[share] liff.shareTargetPicker failed:", msg);
      setShareErr(`分享失敗：${msg}`);
    } finally {
      setSharing(false);
    }
  }

  async function handleClaimCode() {
    setClaiming(true);
    setClaimErr(null);
    try {
      const d = await apiPost<{ code: string }>("/api/v1/me/channel-code", undefined, { campaign_code: CAMPAIGN_CODE });
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
        <div className="spinner w-10 h-10" />
      </div>
    );
  }

  if (!result?.redeem_code) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-4 p-6 text-center bg-[#1361b5]">
        <p className="text-white text-sm">找不到兌換資料，請重新從首頁進入。</p>
        <button className="btn btn-primary" onClick={() => navigate("/")}>
          回首頁
        </button>
      </div>
    );
  }

  const { redeem_code } = result;

  return (
    <div className="mx-auto max-w-mobile bg-white">
      {/* ── Stadium background header ── */}
      <div className="relative overflow-hidden">
        <img src={A.bgStadium} alt="" className="w-full block object-cover" style={{ maxHeight: 180 }} />
        <div className="absolute inset-0 bg-gradient-to-b from-transparent to-white" />
        {/* Logo */}
        <div className="absolute top-3 left-4">
          <img src={A.logo} alt="LA ROCHE-POSAY 理膚寶水" className="h-6 object-contain" />
        </div>
      </div>

      {/* ── QR code section ── */}
      <div className="px-5 pt-2 pb-4">
        <h1 className="text-center text-[22px] font-black text-brand-blue mb-1">你的專屬兌換碼</h1>
        <SlantedBorder className="mb-4" />

        <div className="flex flex-col items-center mb-3">
          <div className="rounded-2xl p-4 shadow-lg" style={{ border: "3px solid #0a4a8c" }}>
            <QRCodeSVG value={redeem_code.qr_payload} size={200} fgColor="#0a4a8c" />
          </div>
          <p className="mt-3 text-2xl font-extrabold tracking-[4px] text-brand-blue">{redeem_code.code}</p>
          <p className="text-xs text-gray-400 mt-1">有效期限：{new Date(redeem_code.expires_at).toLocaleDateString("zh-TW")}</p>
        </div>

        <p className="text-center text-[13px] text-gray-500 leading-relaxed mb-4">
          請至活動機台出示此 QR Code，
          <br />
          兌換安得利防曬試用包（每人限 1 份）
        </p>

        {/* Share button */}
        <button
          type="button"
          className="w-full rounded-full py-4 text-[17px] font-black text-white tracking-widest mb-2"
          style={{
            background: "linear-gradient(180deg, #1e7bdc 0%, #0a4a8c 100%)",
            border: "3px solid rgba(255,255,255,0.6)",
            boxShadow: "0 4px 16px rgba(10,74,140,0.4)",
          }}
          onClick={() => setShowSharePopup(true)}
          disabled={sharing}
        >
          {sharing ? "分享中…" : "分享活動 參加抽籤"}
        </button>

        {shareErr && <p className="text-red-500 text-xs text-center mt-2">{shareErr}</p>}
      </div>

      {/* ── Blue section with discount codes ── */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-[#1361b5]" />
        <img src={A.bgBlueCover} alt="" className="absolute inset-0 w-full h-full object-cover opacity-30 mix-blend-overlay" />

        <div className="relative z-10 px-5 pt-5 pb-6">
          {/* Divider with label */}
          <div className="flex items-center gap-3 mb-4">
            <div className="flex-1 h-px bg-white/30" />
            <span className="text-white text-[13px] font-bold whitespace-nowrap">活動紅利指定通路</span>
            <div className="flex-1 h-px bg-white/30" />
          </div>

          <p className="text-center text-white/80 text-xs mb-4">分享活動後可領取以下通路折扣碼，享受購物優惠！</p>

          <div className="flex flex-col gap-3 mb-5">
            {/* momo */}
            <button type="button" className="w-full rounded-full py-3.5 text-[15px] font-bold text-white flex items-center justify-center gap-2 disabled:opacity-50" style={{ background: "#c0392b", border: "2px solid #fff" }} onClick={() => handleDiscountClick("momo")} disabled={claiming}>
              <span>🛍</span>
              領取 momo 折扣碼
            </button>

            {/* Shopee */}
            <button type="button" className="w-full rounded-full py-3.5 text-[15px] font-bold text-white flex items-center justify-center gap-2 disabled:opacity-50" style={{ background: "#f26522", border: "2px solid #fff" }} onClick={() => handleDiscountClick("shopee")} disabled={claiming}>
              <span>🦈</span>
              領取蝦皮折扣碼
            </button>

            {/* Watson's */}
            <button type="button" className="w-full rounded-full py-3.5 text-[15px] font-bold text-white flex items-center justify-center gap-2 disabled:opacity-50" style={{ background: "#009bdf", border: "2px solid #fff" }} onClick={() => handleDiscountClick("watsons")} disabled={claiming}>
              <span>💊</span>
              領取屈臣氏折扣碼
            </button>
          </div>

          {claimErr && <p className="text-yellow-300 text-xs text-center -mt-2 mb-3">{claimErr}</p>}

          {/* Vending machine image */}
          <img src={A.picbot} alt="活動機台" className="mx-auto w-[85%] max-w-xs block" />

          {/* Location info */}
          <div className="mt-4 rounded-xl bg-white/10 px-4 py-4 text-white">
            <h3 className="font-bold text-[13px] mb-2 text-center">活動日暨指定地點</h3>
            <p className="text-[12px] leading-relaxed text-white/80 text-center">
              活動地點：全台指定球場 / 皮膚科醫院
              <br />
              詳細地點資訊請掃描 QR Code 查看
            </p>
          </div>

          <p className="mt-4 text-center text-white/50 text-[11px]">★活動期間：2026/7/3 00時00分 至 2026/8/23 23點59分★</p>
        </div>
      </div>

      {/* ── Popups ── */}

      {showSharePopup && <SharePopup onClose={() => setShowSharePopup(false)} onConfirm={() => void handleShare()} sharing={sharing} />}

      {showDiscountPopup === "watsons" && <BarcodePopup code={channelCode ?? "---"} onClose={() => setShowDiscountPopup(null)} />}

      {(showDiscountPopup === "momo" || showDiscountPopup === "shopee") && <TextCodePopup platform={showDiscountPopup} code={channelCode ?? "---"} onClose={() => setShowDiscountPopup(null)} />}
    </div>
  );
}
