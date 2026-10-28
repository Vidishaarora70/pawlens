import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { CheckCircle2, AlertCircle, X } from "lucide-react";
import { api } from "./api";
import { readJSON, writeJSON } from "./storage";
import type { Health } from "./types";

/* ------------------------------------------------------------- theme ---- */
export type ThemePref = "system" | "light" | "dark";
const ThemeCtx = createContext<{ pref: ThemePref; dark: boolean; setPref: (p: ThemePref) => void }>(null!);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [pref, setPrefState] = useState<ThemePref>(() => {
    try { return (localStorage.getItem("pawlens-theme") as ThemePref) || "system"; } catch { return "system"; }
  });
  const [systemDark, setSystemDark] = useState(() => matchMedia("(prefers-color-scheme: dark)").matches);

  useEffect(() => {
    const mq = matchMedia("(prefers-color-scheme: dark)");
    const on = (e: MediaQueryListEvent) => setSystemDark(e.matches);
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);

  const dark = pref === "dark" || (pref === "system" && systemDark);
  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
    document.querySelector('meta[name="theme-color"]')?.setAttribute("content", dark ? "#0F1222" : "#F7F7FB");
  }, [dark]);

  const setPref = useCallback((p: ThemePref) => {
    setPrefState(p);
    try { localStorage.setItem("pawlens-theme", p); } catch { /* ignore */ }
  }, []);

  return <ThemeCtx.Provider value={{ pref, dark, setPref }}>{children}</ThemeCtx.Provider>;
}
export const useTheme = () => useContext(ThemeCtx);

/* ------------------------------------------------------------- toasts --- */
type Toast = { id: number; text: string; kind: "ok" | "error" };
const ToastCtx = createContext<(text: string, kind?: Toast["kind"]) => void>(() => {});

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const next = useRef(1);
  const dismiss = (id: number) => setToasts((t) => t.filter((x) => x.id !== id));
  const show = useCallback((text: string, kind: Toast["kind"] = "ok") => {
    const id = next.current++;
    setToasts((t) => [...t.slice(-2), { id, text, kind }]);
    setTimeout(() => dismiss(id), kind === "error" ? 6000 : 3500);
  }, []);

  return (
    <ToastCtx.Provider value={show}>
      {children}
      <div aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-24 z-50 flex flex-col items-center gap-2 px-4 md:bottom-6">
        <AnimatePresence>
          {toasts.map((t) => (
            <motion.div
              key={t.id}
              initial={{ opacity: 0, y: 16, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8 }}
              className="pointer-events-auto flex max-w-md items-start gap-3 rounded-2xl bg-night px-4 py-3 text-sm text-white shadow-xl ring-1 ring-white/10"
            >
              {t.kind === "ok" ? <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-gate" /> : <AlertCircle className="mt-0.5 size-4 shrink-0 text-danger" />}
              <span>{t.text}</span>
              <button onClick={() => dismiss(t.id)} aria-label="Dismiss" className="ml-1 rounded p-0.5 text-white/60 hover:text-white">
                <X className="size-4" />
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastCtx.Provider>
  );
}
export const useToast = () => useContext(ToastCtx);

/* ------------------------------------------------------------- health --- */
type HealthState = { health: Health | null; offline: boolean; retry: () => void };
const HealthCtx = createContext<HealthState>({ health: null, offline: false, retry: () => {} });

export function HealthProvider({ children }: { children: ReactNode }) {
  const [health, setHealth] = useState<Health | null>(null);
  const [offline, setOffline] = useState(false);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let alive = true;
    let timer: number;
    const poll = async () => {
      try {
        const h = await api.health();
        if (!alive) return;
        setHealth(h);
        setOffline(false);
        timer = window.setTimeout(poll, 30000);
      } catch {
        if (!alive) return;
        setOffline(true);
        timer = window.setTimeout(poll, 4000); // keep retrying while the server starts
      }
    };
    poll();
    return () => { alive = false; clearTimeout(timer); };
  }, [tick]);

  const value = useMemo(() => ({ health, offline, retry: () => setTick((t) => t + 1) }), [health, offline]);
  return <HealthCtx.Provider value={value}>{children}</HealthCtx.Provider>;
}
export const useHealth = () => useContext(HealthCtx);

/* ------------------------------------------- persisted small settings --- */
export function usePersisted<T>(key: string, initial: T) {
  const [v, setV] = useState<T>(() => readJSON(key, initial));
  useEffect(() => { writeJSON(key, v); }, [key, v]);
  return [v, setV] as const;
}
