import { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";

/** 需後端 session 的頁面：未登入時導回首頁（錯誤／載入由 AuthGate 全站處理） */
export default function RequireAuth({ children }: { children: ReactNode }) {
  const auth = useAuth();

  if (auth.phase === "mock" || auth.phase === "ready") {
    return <>{children}</>;
  }

  return <Navigate to="/" replace />;
}
