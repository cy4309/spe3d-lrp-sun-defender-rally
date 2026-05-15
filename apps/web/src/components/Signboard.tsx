import { ReactNode } from "react";

interface SignboardProps {
  children: ReactNode;
  className?: string;
}

/** 活動看板：白底內容 + 橘金漸層外框（Upload / Result 等頁可複用） */
export default function Signboard({ children, className = "" }: SignboardProps) {
  return (
    <div
      className={`rounded-[20px] p-[3px] shadow-[0_8px_32px_rgba(0,0,0,0.28)] ${className}`}
      style={{
        background:
          "linear-gradient(165deg, #f5a623 0%, #f47a1f 38%, #ffca28 72%, #ffe082 100%)",
      }}
    >
      <div className="rounded-[17px] bg-white overflow-hidden">{children}</div>
    </div>
  );
}
