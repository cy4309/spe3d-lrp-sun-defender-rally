import { ReactNode } from "react";
import AuthErrorScreen from "@/components/AuthErrorScreen";
import { useAuth } from "@/contexts/AuthContext";

/** 全站認證狀態：初始化中／錯誤時攔截，避免各頁重複實作 */
export default function AuthGate({ children }: { children: ReactNode }) {
  const auth = useAuth();

  if (auth.phase === "loading") {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-[#1361b5]">
        <div className="spinner h-10 w-10" />
      </div>
    );
  }

  if (auth.phase === "error") {
    return <AuthErrorScreen message={auth.message} />;
  }

  return <>{children}</>;
}
