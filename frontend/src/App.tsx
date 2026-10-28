import { lazy, Suspense } from "react";
import { BrowserRouter, Link, Route, Routes } from "react-router-dom";
import { MotionConfig } from "framer-motion";
import { Layout } from "./components/Layout";
import { HealthProvider, ThemeProvider, ToastProvider } from "./lib/context";
import Classify from "./pages/Classify";

// Pages with charts are loaded only when opened, so the first page loads fast.
const Camera = lazy(() => import("./pages/Camera"));
const Batch = lazy(() => import("./pages/Batch"));
const StressLab = lazy(() => import("./pages/StressLab"));
const ModelLab = lazy(() => import("./pages/ModelLab"));
const History = lazy(() => import("./pages/History"));
const About = lazy(() => import("./pages/About"));

function NotFound() {
  return (
    <div className="py-20 text-center">
      <h1 className="text-4xl font-bold">Page not found</h1>
      <p className="mt-2 text-muted">This address doesn't exist in PawLens.</p>
      <Link to="/" className="mt-6 inline-flex h-11 items-center rounded-full bg-dog px-5 text-sm font-semibold text-night">Go to Classify</Link>
    </div>
  );
}

export default function App() {
  return (
    <MotionConfig reducedMotion="user">
      <ThemeProvider>
        <ToastProvider>
          <HealthProvider>
            <BrowserRouter>
              <Layout>
                <Suspense fallback={<div className="h-64 animate-pulse rounded-3xl bg-surface-2" />}>
                  <Routes>
                    <Route path="/" element={<Classify />} />
                    <Route path="/camera" element={<Camera />} />
                    <Route path="/batch" element={<Batch />} />
                    <Route path="/stress" element={<StressLab />} />
                    <Route path="/models" element={<ModelLab />} />
                    <Route path="/history" element={<History />} />
                    <Route path="/about" element={<About />} />
                    <Route path="*" element={<NotFound />} />
                  </Routes>
                </Suspense>
              </Layout>
            </BrowserRouter>
          </HealthProvider>
        </ToastProvider>
      </ThemeProvider>
    </MotionConfig>
  );
}
