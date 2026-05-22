import { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";

/** 需後端 session 的頁面：未登入／已過期時導回首頁（顯示重新登入） */
export default function RequireAuth({ children }: { children: ReactNode }) {
  const auth = useAuth();

  if (auth.phase === "loading") {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-brand-blue">
        <div className="spinner h-10 w-10" />
      </div>
    );
  }

  if (auth.phase === "error") {
    return <Navigate to="/" replace />;
  }

  if (auth.phase === "mock") {
    return <>{children}</>;
  }

  return <>{children}</>;
}
