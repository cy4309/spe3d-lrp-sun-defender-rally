import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import Layout from "@/components/Layout";
import { useAuth } from "@/contexts/AuthContext";
import { ApiError, apiPostForm } from "@/lib/api";

const MAX_BYTES = 10 * 1024 * 1024;
const MIN_EDGE_PX = 720;

async function validateImage(file: File): Promise<string | null> {
  if (!["image/jpeg", "image/png"].includes(file.type)) return "請上傳 JPG 或 PNG 圖片";
  if (file.size > MAX_BYTES) return "圖片過大（上限 10 MB），請重新選擇";
  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const min = Math.min(img.naturalWidth, img.naturalHeight);
      resolve(min < MIN_EDGE_PX ? `請上傳至少 ${MIN_EDGE_PX}px 的圖片（目前最短邊：${min}px）` : null);
    };
    img.onerror = () => { URL.revokeObjectURL(url); resolve("無法讀取圖片，請換一張"); };
    img.src = url;
  });
}

export default function UploadPage() {
  const auth = useAuth();
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const isMock = auth.phase === "mock";
  const userCampaignId = auth.phase === "ready" ? auth.userCampaign.id : "mock-uc-id";

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setError(null);
    const err = await validateImage(f);
    if (err) { setError(err); return; }
    setFile(f);
    setPreview(URL.createObjectURL(f));
  }

  function clearFile() {
    if (preview) URL.revokeObjectURL(preview);
    setFile(null); setPreview(null); setError(null);
    if (inputRef.current) inputRef.current.value = "";
  }

  async function handleUpload() {
    if (!file) return;
    setUploading(true);
    try {
      if (isMock) {
        await new Promise((r) => setTimeout(r, 800));
        navigate("/processing/mock-job-id");
        return;
      }
      const form = new FormData();
      form.append("image", file);
      form.append("user_campaign_id", userCampaignId);
      const data = await apiPostForm<{ job_id: string }>("/api/v1/jobs", form);
      navigate(`/processing/${data.job_id}`);
    } catch (e) {
      if (e instanceof ApiError && e.code === "job_already_in_progress") { navigate("/result"); return; }
      setError(e instanceof ApiError ? e.message : "上傳失敗，請稍後再試");
    } finally {
      setUploading(false);
    }
  }

  function open(capture?: boolean) {
    if (!inputRef.current) return;
    capture
      ? inputRef.current.setAttribute("capture", "environment")
      : inputRef.current.removeAttribute("capture");
    inputRef.current.click();
  }

  return (
    <Layout
      cta={
        file ? (
          <button className="btn btn-primary btn-block" onClick={handleUpload} disabled={uploading}>
            {uploading ? "上傳中…" : "開始生成應援照"}
          </button>
        ) : (
          <div className="flex gap-3">
            <button className="btn btn-outline flex-1" onClick={() => open(true)}>拍照</button>
            <button className="btn btn-primary flex-1" onClick={() => open(false)}>從相簿選擇</button>
          </div>
        )
      }
    >
      <input ref={inputRef} type="file" accept="image/jpeg,image/png"
        className="hidden" onChange={handleFileChange} />

      <h2 className="text-xl font-bold text-brand-blue mb-1">上傳你的照片</h2>
      <p className="text-sm text-gray-500 mb-5">建議使用正面、光線充足的清晰人像照</p>

      <div
        onClick={() => !preview && open(false)}
        className={`relative flex flex-col items-center justify-center min-h-60 rounded-xl border-2 mb-4 overflow-hidden transition-colors
          ${preview ? "border-gray-200 cursor-default" : "border-dashed border-gray-300 cursor-pointer hover:border-brand-blue"}`}
      >
        {preview ? (
          <>
            <img src={preview} alt="預覽" className="w-full h-full object-cover block" />
            <button
              onClick={(e) => { e.stopPropagation(); clearFile(); }}
              className="absolute bottom-3 right-3 bg-black/50 text-white text-xs rounded-full px-3 py-1.5"
            >
              重新選擇
            </button>
          </>
        ) : (
          <div className="text-center text-gray-400 p-6">
            <div className="text-4xl mb-2">📷</div>
            <p className="text-sm">點此選擇照片</p>
            <p className="text-xs mt-1">支援 JPG / PNG，10 MB 以內，最短邊 ≥ 720px</p>
          </div>
        )}
      </div>

      {error && <p className="text-red-500 text-sm mt-1">{error}</p>}
    </Layout>
  );
}
