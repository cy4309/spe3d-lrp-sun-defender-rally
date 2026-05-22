import LegalTextPopup from "@/components/LegalTextPopup";
import privacyPolicyEn from "@/content/privacy-policy-en.txt?raw";
import privacyPolicyZh from "@/content/privacy-policy-zh.txt?raw";

const BODY_CLASS =
  "whitespace-pre-wrap font-sans text-[11px] leading-relaxed text-gray-700";

/** 原文顯示，不改寫、不重新分段（內容見 src/content/privacy-policy-*.txt） */
export default function PrivacyPolicyPopup({ onClose }: { onClose: () => void }) {
  return (
    <LegalTextPopup title="隱私權政策" onClose={onClose}>
      <p className={`${BODY_CLASS} mb-4`}>{privacyPolicyZh}</p>
      <details className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
        <summary className="cursor-pointer text-[12px] font-bold text-brand-blue">English</summary>
        <p className={`${BODY_CLASS} mt-3`}>{privacyPolicyEn}</p>
      </details>
    </LegalTextPopup>
  );
}
