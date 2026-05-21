import { ModalCloseButton } from "@/components/CloseButton";

type ModalOverlayProps = {
  onClose: () => void;
  children: React.ReactNode;
  showClose?: boolean;
  closeLabel?: string;
  /** 覆寫 ModalCloseButton 定位（例：範例照 popup 用 -right-3 -top-3） */
  closeClassName?: string;
};

/** 全螢幕遮罩 + 置中面板（關閉鈕由 ModalCloseButton 負責） */
export default function ModalOverlay({
  onClose,
  children,
  showClose = true,
  closeLabel = "關閉",
  closeClassName,
}: ModalOverlayProps) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-5"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="relative w-full max-w-sm"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        {showClose && (
          <ModalCloseButton onClick={onClose} label={closeLabel} className={closeClassName} />
        )}
        {children}
      </div>
    </div>
  );
}
