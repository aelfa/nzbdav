import { forwardRef } from "react";
import type { ButtonHTMLAttributes } from "react";

type ButtonVariant = "primary" | "success" | "danger" | "warning" | "secondary" | "ghost";
type ButtonSize = "xsmall" | "small" | "medium" | "large" | "rounded";

const variants: Record<ButtonVariant, string> = {
  primary: "bg-blue-600 text-white hover:bg-blue-700",
  success: "bg-emerald-600 text-white hover:bg-emerald-500",
  danger: "bg-red-600 text-white hover:bg-red-500",
  warning: "bg-amber-500 text-slate-950 hover:bg-amber-400",
  secondary: "border border-slate-50/20 bg-white/5 text-slate-200 hover:bg-white/10",
  ghost: "bg-transparent text-slate-300 hover:bg-white/10 hover:text-white",
};

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "primary", size = "small", className = "", type = "button", ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      className={`button-base button-${size} ${variants[variant]} ${className}`}
      {...props}
    />
  );
});
