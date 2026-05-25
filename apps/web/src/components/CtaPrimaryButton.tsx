import { ButtonHTMLAttributes } from "react";

type CtaVariant = "default" | "upload";

const VARIANT_CLASS: Record<CtaVariant, string> = {
  default: "cta-primary w-full py-4 px-6 text-2xl tracking-[0.08em] disabled:cursor-not-allowed disabled:opacity-40",
  /** 上傳頁大按鈕；disabled 樣式由 styles.css `.upload-cta:disabled` 控制 */
  upload: "upload-cta block w-full py-4 px-6 text-2xl tracking-[0.08em] disabled:cursor-not-allowed disabled:opacity-100 disabled:text-white disabled:shadow-[0_2px_8px_rgba(244,122,31,0.15)]",
};

type CtaPrimaryButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: CtaVariant;
  /** 結果頁等：加強陰影 */
  elevated?: boolean;
};

export default function CtaPrimaryButton({ className = "", variant = "default", elevated = false, type = "button", children, ...props }: CtaPrimaryButtonProps) {
  return (
    <button type={type} className={`${VARIANT_CLASS[variant]}${elevated ? " shadow-2xl" : ""} ${className}`.trim()} {...props}>
      {children}
    </button>
  );
}
