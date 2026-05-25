import { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import { recordPageView } from "@/lib/api";

/** 各 LIFF 路由進入時上報 page_views（供 PM 統計瀏覽數）。 */
export default function PageViewTracker() {
  const { pathname } = useLocation();
  const lastPath = useRef<string | null>(null);

  useEffect(() => {
    if (pathname === lastPath.current) return;
    lastPath.current = pathname;
    void recordPageView(pathname);
  }, [pathname]);

  return null;
}
