import { useEffect } from "react";
import type { ReactNode } from "react";
import { Button } from "./button";
import { Icon } from "./icon";

export type ModalProps = {
  open: boolean;
  title: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  onClose: () => void;
  className?: string;
};

export function Modal({ open, title, children, footer, onClose, className = "" }: ModalProps) {
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/80 p-4"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        className={`max-h-[90dvh] w-full max-w-xl overflow-y-auto rounded border border-slate-700 bg-slate-900 shadow-xl ${className}`}
      >
        <header className="flex items-center justify-between border-b border-slate-700 px-4 py-3">
          <h2 className="text-lg font-semibold text-white">{title}</h2>
          <Button variant="ghost" size="xsmall" aria-label="Close" onClick={onClose}>
            <Icon name="close" className="!text-[20px]" />
          </Button>
        </header>
        <div className="p-4">{children}</div>
        {footer && (
          <footer className="flex justify-end gap-2 border-t border-slate-700 px-4 py-3">
            {footer}
          </footer>
        )}
      </section>
    </div>
  );
}
