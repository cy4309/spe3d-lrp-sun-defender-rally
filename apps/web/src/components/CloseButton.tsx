interface CloseButtonProps {
  onClick: () => void;
  label?: string;
  className?: string;
}

export default function CloseButton({ onClick, label = "關閉", className = "" }: CloseButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className={`flex h-9 w-9 items-center justify-center rounded-full bg-brand-orange text-xl font-bold text-white shadow-md ring-2 ring-white ${className}`}
    >
      ×
    </button>
  );
}
