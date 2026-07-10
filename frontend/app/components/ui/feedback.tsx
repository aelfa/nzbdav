import type { HTMLAttributes, ReactNode } from "react";
import { Icon } from "./icon";

type AlertVariant = "info" | "success" | "warning" | "danger";

const alertVariants: Record<AlertVariant, string> = {
  info: "border-blue-600/50 bg-blue-500/10 text-blue-200",
  success: "border-emerald-600/50 bg-emerald-500/10 text-emerald-200",
  warning: "border-amber-600/50 bg-amber-500/10 text-amber-200",
  danger: "border-red-600/50 bg-red-500/10 text-red-200",
};

export function Alert({
  variant = "info",
  className = "",
  ...props
}: HTMLAttributes<HTMLDivElement> & { variant?: AlertVariant }) {
  return (
    <div
      role="alert"
      className={`rounded border px-3 py-2 text-xs ${alertVariants[variant]} ${className}`}
      {...props}
    />
  );
}

export function Badge({ className = "", ...props }: HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      className={`rounded-full border border-slate-600/60 bg-slate-700/40 px-1.5 py-0.5 text-[10px] text-slate-200 ${className}`}
      {...props}
    />
  );
}

export function Spinner({ className = "", size }: { className?: string; size?: string }) {
  return (
    <Icon
      name="progress_activity"
      className={`animate-spin ${size === "sm" ? "!text-[14px]" : "!text-[18px]"} ${className}`}
    />
  );
}

export function Tooltip({ content, children }: { content: ReactNode; children: ReactNode }) {
  return (
    <span className="group relative inline-flex">
      {children}
      <span
        role="tooltip"
        className="pointer-events-none absolute bottom-full left-1/2 z-50 mb-2 hidden -translate-x-1/2 whitespace-nowrap rounded border border-slate-700 bg-slate-950 px-2 py-1 text-xs text-slate-200 shadow-lg group-hover:block"
      >
        {content}
      </span>
    </span>
  );
}
