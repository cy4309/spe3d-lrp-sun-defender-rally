import { ReactNode } from "react";
import ModalOverlay from "@/components/ModalOverlay";
import SlantedBorder from "@/components/SlantedBorder";

type LegalTextPopupProps = {
  title: string;
  onClose: () => void;
  children?: ReactNode;
};

/** 隱私權政策／使用條款等文字彈窗（殼層與 ActivityRulesPopup 一致） */
export default function LegalTextPopup({ title, onClose, children }: LegalTextPopupProps) {
  return (
    <ModalOverlay onClose={onClose}>
      <div className="flex max-h-[min(80vh,560px)] flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex-1 overflow-y-auto px-5 py-5">
          <h2 className="mb-1 text-center text-xl font-black text-brand-blue">{title}</h2>
          <SlantedBorder className="mb-4" />
          <div className="text-left">
            {children ?? (
              <p className="py-6 text-center text-[12px] leading-relaxed text-gray-500">內容待補</p>
            )}
          </div>
        </div>
        <div className="shrink-0 border-t border-gray-100 px-5 py-4">
          <button type="button" className="btn btn-primary btn-block py-3 text-sm" onClick={onClose}>
            確認
          </button>
        </div>
      </div>
    </ModalOverlay>
  );
}
