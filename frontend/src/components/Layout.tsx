import type { ReactNode } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { motion } from "framer-motion";
import { BookOpen, Camera, ChartColumn, History, Images, Moon, ScanSearch, SlidersHorizontal, Sun, SunMoon } from "lucide-react";
import { useHealth, useTheme, type ThemePref } from "../lib/context";
import { cx } from "./ui";

const NAV = [
  { to: "/", label: "Classify", icon: ScanSearch },
  { to: "/camera", label: "Camera", icon: Camera },
  { to: "/batch", label: "Batch", icon: Images },
  { to: "/stress", label: "Stress Lab", icon: SlidersHorizontal },
  { to: "/models", label: "Models", icon: ChartColumn },
];
const EXTRA = [
  { to: "/history", label: "History", icon: History },
  { to: "/about", label: "About", icon: BookOpen },
];

export function Logo() {
  return (
    <NavLink to="/" className="flex items-center gap-2.5 rounded-lg" aria-label="PawLens home">
      <svg viewBox="0 0 64 64" className="size-8" aria-hidden>
        <rect width="64" height="64" rx="16" className="fill-night dark:fill-surface-2" />
        <circle cx="32" cy="38" r="11" fill="#FF7A45" />
        <circle cx="18" cy="24" r="6" fill="#FF7A45" />
        <circle cx="46" cy="24" r="6" fill="#FF7A45" />
        <circle cx="26" cy="14" r="5" fill="#9B5DE5" />
        <circle cx="38" cy="14" r="5" fill="#9B5DE5" />
      </svg>
      <span className="font-display text-xl font-bold tracking-tight">PawLens</span>
    </NavLink>
  );
}

function ThemeButton() {
  const { pref, setPref } = useTheme();
  const order: ThemePref[] = ["system", "light", "dark"];
  const Icon = pref === "light" ? Sun : pref === "dark" ? Moon : SunMoon;
  const next = order[(order.indexOf(pref) + 1) % 3];
  return (
    <button
      onClick={() => setPref(next)}
      className="grid size-10 place-items-center rounded-full text-muted hover:bg-surface-2 hover:text-ink"
      aria-label={`Theme: ${pref}. Switch to ${next}`}
      title={`Theme: ${pref}`}
    >
      <Icon className="size-5" />
    </button>
  );
}

function ServerStatus() {
  const { health, offline } = useHealth();
  const state = offline ? "offline" : !health ? "connecting" : health.demo_mode ? "demo" : "ready";
  const text = { offline: "Server offline", connecting: "Connecting", demo: "Demo mode", ready: "Models ready" }[state];
  return (
    <span className="hidden items-center gap-2 rounded-full bg-surface-2 px-3 py-1.5 text-xs font-medium text-muted lg:inline-flex" title={text}>
      <span className={cx("size-2 rounded-full", state === "ready" && "bg-gate", state === "demo" && "bg-[#FFC857]", state === "offline" && "bg-danger", state === "connecting" && "animate-pulse bg-muted")} />
      {text}
    </span>
  );
}

function Banner() {
  const { health, offline, retry } = useHealth();
  if (offline)
    return (
      <div className="bg-danger/10 px-4 py-2.5 text-center text-sm text-danger-ink">
        Can't reach the PawLens server. Start it with <code className="num rounded bg-surface px-1.5 py-0.5 text-xs">uvicorn app.main:app --port 8000</code> in the backend folder.{" "}
        <button onClick={retry} className="font-semibold underline underline-offset-2">Retry now</button>
      </div>
    );
  if (health?.demo_mode)
    return (
      <div className="bg-[#FFC857]/20 px-4 py-2.5 text-center text-sm text-ink">
        Demo mode: no trained PawLens models found, so answers come from the ImageNet model only. Train in Colab and copy the files into <code className="num text-xs">backend/models</code>.
      </div>
    );
  return null;
}

export function Layout({ children }: { children: ReactNode }) {
  const loc = useLocation();
  return (
    <div className="flex min-h-dvh flex-col">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-surface focus:px-4 focus:py-2">
        Skip to content
      </a>
      <Banner />
      <header className="sticky top-0 z-30 border-b border-line/70 bg-bg/85 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-4 px-4 md:px-6">
          <Logo />
          <nav aria-label="Main" className="ml-6 hidden items-center gap-1 md:flex">
            {[...NAV, ...EXTRA].map((n) => (
              <NavLink
                key={n.to}
                to={n.to}
                end={n.to === "/"}
                className={({ isActive }) =>
                  cx("relative rounded-full px-3 py-2 text-sm font-medium transition", isActive ? "text-ink" : "text-muted hover:text-ink")
                }
              >
                {({ isActive }) => (
                  <>
                    {isActive && <motion.span layoutId="nav-pill" className="absolute inset-0 rounded-full bg-surface-2" transition={{ type: "spring", bounce: 0.2, duration: 0.45 }} />}
                    <span className="relative">{n.label}</span>
                  </>
                )}
              </NavLink>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-1">
            <ServerStatus />
            {EXTRA.map((n) => (
              <NavLink key={n.to} to={n.to} aria-label={n.label} className={({ isActive }) => cx("grid size-10 place-items-center rounded-full md:hidden", isActive ? "bg-surface-2 text-ink" : "text-muted")}>
                <n.icon className="size-5" />
              </NavLink>
            ))}
            <ThemeButton />
          </div>
        </div>
      </header>

      <main id="main" className="mx-auto w-full max-w-6xl flex-1 px-4 pb-28 pt-6 md:px-6 md:pb-16 md:pt-10">
        <motion.div key={loc.pathname} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }}>
          {children}
        </motion.div>
      </main>

      <nav aria-label="Main" className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-md md:hidden">
        <ul className="grid grid-cols-5">
          {NAV.map((n) => (
            <li key={n.to}>
              <NavLink to={n.to} end={n.to === "/"} className={({ isActive }) => cx("flex h-16 flex-col items-center justify-center gap-1 text-[11px] font-medium", isActive ? "text-dog-ink" : "text-muted")}>
                <n.icon className="size-5" />
                {n.label === "Stress Lab" ? "Stress" : n.label}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}
