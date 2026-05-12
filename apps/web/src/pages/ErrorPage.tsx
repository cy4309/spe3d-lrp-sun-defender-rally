import { useLocation, useNavigate } from "react-router-dom";
import Layout from "@/components/Layout";

export default function ErrorPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const message: string =
    (location.state as { message?: string } | null)?.message ?? "發生錯誤，請稍後再試";

  return (
    <Layout>
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 text-center px-4">
        <span className="text-5xl">⚠️</span>
        <h2 className="text-xl font-bold text-brand-blue">哎呀，出了點問題</h2>
        <p className="text-sm text-gray-500 max-w-xs leading-relaxed">{message}</p>
        <button className="btn btn-primary mt-2" onClick={() => navigate("/")}>
          回到首頁
        </button>
      </div>
    </Layout>
  );
}
