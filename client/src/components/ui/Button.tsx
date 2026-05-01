import type { ButtonHTMLAttributes, ReactNode } from "react";

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "ghost" | "solid" | "danger";
  size?: "sm" | "md";
  children: ReactNode;
}

export function Button({
  variant = "ghost",
  size = "md",
  children,
  className = "",
  ...props
}: Props) {
  const base =
    "font-headline uppercase tracking-widest text-xs transition-all active:scale-95 duration-150 flex items-center justify-center gap-2";

  const variants = {
    ghost:
      "border border-cyan/30 text-cyan hover:bg-cyan/10 cyan-bloom-sm",
    solid:
      "bg-cyan/10 border border-cyan/50 text-cyan hover:bg-cyan/20 cyan-bloom",
    danger:
      "border border-error/30 text-error hover:bg-error/10",
  };

  const sizes = {
    sm: "px-3 py-1.5",
    md: "px-4 py-2",
  };

  return (
    <button
      className={`${base} ${variants[variant]} ${sizes[size]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}
