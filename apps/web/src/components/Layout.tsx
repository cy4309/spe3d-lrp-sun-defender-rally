import { ReactNode } from "react";

interface LayoutProps {
  children: ReactNode;
  cta?: ReactNode;
}

export default function Layout({ children, cta }: LayoutProps) {
  return (
    <div className="flex flex-col min-h-dvh max-w-mobile mx-auto bg-white">
      <header className="flex flex-col items-center px-5 py-3.5 bg-brand-blue text-white shrink-0">
        <span className="text-[11px] tracking-widest uppercase opacity-75">La Roche-Posay</span>
        <span className="mt-0.5 text-[17px] font-bold">安得利防曬應援</span>
      </header>

      <main className="flex-1 overflow-y-auto px-5 pt-6 pb-4">{children}</main>

      {cta && (
        <footer className="shrink-0 px-5 pt-3 pb-6 bg-white border-t border-gray-100">
          {cta}
        </footer>
      )}
    </div>
  );
}
