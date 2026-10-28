import type { ButtonHTMLAttributes, ReactNode } from "react";
import { motion } from "framer-motion";

const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(" ");
export { cx };

type BtnProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost";
  size?: "md" | "sm";
  icon?: ReactNode;
};

export function Button({ variant = "secondary", size = "md", icon, className, children, ...rest }: BtnProps) {
  return (
    <button
      {...rest}
      className={cx(
        "inline-flex items-center justify-center gap-2 rounded-full font-semibold transition active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50",
        size === "md" ? "h-11 px-5 text-sm" : "h-9 px-3.5 text-[13px]",
        variant === "primary" && "bg-dog text-night hover:brightness-105",
        variant === "secondary" && "bg-surface text-ink ring-1 ring-line hover:bg-surface-2",
        variant === "ghost" && "text-muted hover:bg-surface-2 hover:text-ink",
        className,
      )}
    >
      {icon}
      {children}
    </button>
  );
}

export function Segmented<T extends string>({
  value, options, onChange, label,
}: { value: T; options: { value: T; label: string; count?: number; disabled?: boolean }[]; onChange: (v: T) => void; label: string }) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex max-w-full gap-1 overflow-x-auto rounded-full bg-surface-2 p-1">
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            role="radio"
            aria-checked={active}
            disabled={o.disabled}
            onClick={() => onChange(o.value)}
            className={cx(
              "relative shrink-0 rounded-full px-3.5 py-1.5 text-[13px] font-medium transition disabled:opacity-40",
              active ? "text-ink" : "text-muted hover:text-ink",
            )}
          >
            {active && (
              <motion.span layoutId={`seg-${label}`} className="absolute inset-0 rounded-full bg-surface shadow-sm ring-1 ring-line" transition={{ type: "spring", bounce: 0.2, duration: 0.4 }} />
            )}
            <span className="relative">
              {o.label}
              {o.count != null && <span className="num ml-1.5 text-[11px] text-muted">{o.count}</span>}
            </span>
          </button>
        );
      })}
    </div>
  );
}

export function Badge({ tone, children }: { tone: "cat" | "dog" | "gate" | "warn" | "plain"; children: ReactNode }) {
  return (
    <span
      className={cx(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold",
        tone === "cat" && "bg-cat/15 text-cat-ink",
        tone === "dog" && "bg-dog/15 text-dog-ink",
        tone === "gate" && "bg-gate/15 text-gate-ink",
        tone === "warn" && "bg-[#FFC857]/25 text-ink",
        tone === "plain" && "bg-surface-2 text-muted",
      )}
    >
      {children}
    </span>
  );
}

export function PageTitle({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <header className="mb-6 md:mb-8">
      <h1 className="text-3xl font-bold md:text-4xl">{title}</h1>
      {children && <p className="mt-2 max-w-2xl text-[15px] leading-relaxed text-muted">{children}</p>}
    </header>
  );
}

export function Empty({ icon, title, children, action }: { icon: ReactNode; title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center rounded-3xl border border-dashed border-line px-6 py-14 text-center">
      <div className="mb-4 grid size-14 place-items-center rounded-2xl bg-surface-2 text-muted">{icon}</div>
      <h2 className="text-xl font-bold">{title}</h2>
      {children && <div className="mt-2 max-w-md text-sm leading-relaxed text-muted">{children}</div>}
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}

export function ErrorNote({ children }: { children: ReactNode }) {
  return (
    <div role="alert" className="rounded-2xl bg-danger/10 px-4 py-3 text-sm text-danger-ink ring-1 ring-danger/25">
      {children}
    </div>
  );
}
