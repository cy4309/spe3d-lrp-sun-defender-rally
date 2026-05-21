type CloseButtonProps = {
  onClick: () => void;
  label?: string;
  className?: string;
  /** default：僅按鈕本體；modal：彈窗面板右上角定位 */
  variant?: "default" | "modal";
};

const BASE =
  "flex h-9 w-9 items-center justify-center rounded-full bg-brand-blue text-xl font-bold text-white shadow-md ring-2 ring-white";

const VARIANT_CLASS: Record<NonNullable<CloseButtonProps["variant"]>, string> = {
  default: "",
  modal: "absolute -right-2 -top-2 z-10",
};

export default function CloseButton({
  onClick,
  label = "關閉",
  className = "",
  variant = "default",
}: CloseButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className={`${BASE} ${VARIANT_CLASS[variant]} ${className}`.trim()}
    >
      ×
    </button>
  );
}

/** 彈窗／Modal 專用關閉鈕（等同 variant="modal"） */
export function ModalCloseButton(props: Omit<CloseButtonProps, "variant">) {
  return <CloseButton {...props} variant="modal" />;
}
