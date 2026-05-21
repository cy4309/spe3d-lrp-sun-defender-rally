import { ReactNode } from "react";

/** 對齊 /assets/upload-gen-page/pic_genAI_frame.png 外框：上橘 → 下藍 */
export const SIGNBOARD_BORDER_GRADIENT =
  "linear-gradient(180deg, #f47a1f 0%, #e86a10 18%, #4a7ab0 52%, #003e89 100%)";

interface SignboardProps {
  children: ReactNode;
  className?: string;
}

/** 活動看板：白底內容 + 橘藍漸層外框（與 pic_genAI_frame 一致） */
export default function Signboard({ children, className = "" }: SignboardProps) {
  return (
    <div
      className={`rounded-[20px] p-[3px] shadow-[0_8px_32px_rgba(0,0,0,0.28)] ${className}`}
      style={{ background: SIGNBOARD_BORDER_GRADIENT }}
    >
      <div className="rounded-[17px] bg-white overflow-hidden">{children}</div>
    </div>
  );
}
