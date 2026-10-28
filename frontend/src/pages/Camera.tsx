import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Camera as CamIcon, CameraOff, Focus, SwitchCamera } from "lucide-react";
import { api } from "../lib/api";
import { pct } from "../lib/image";
import type { PredictionResult } from "../lib/types";
import { Analysis } from "../components/Analysis";
import { Button, ErrorNote, PageTitle } from "../components/ui";

const INTERVAL_MS = 500;

export default function Camera() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const busy = useRef(false);
  const [running, setRunning] = useState(false);
  const [facing, setFacing] = useState<"environment" | "user">("environment");
  const [live, setLive] = useState<PredictionResult | null>(null);
  const [rate, setRate] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [snapshot, setSnapshot] = useState<File | null>(null);
  const [multiCam, setMultiCam] = useState(false);

  const stop = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setRunning(false);
    setLive(null);
  }, []);

  const start = useCallback(async (mode = facing) => {
    setError(null);
    if (!navigator.mediaDevices?.getUserMedia) {
      setError("This browser can't open the camera here. Camera access needs HTTPS or localhost.");
      return;
    }
    try {
      streamRef.current?.getTracks().forEach((t) => t.stop());
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: mode, width: { ideal: 1280 } }, audio: false });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setRunning(true);
      const devices = await navigator.mediaDevices.enumerateDevices();
      setMultiCam(devices.filter((d) => d.kind === "videoinput").length > 1);
    } catch (e) {
      const name = (e as DOMException).name;
      setError(
        name === "NotAllowedError" ? "Camera permission was blocked. Allow camera access in your browser's site settings, then press Start camera." :
        name === "NotFoundError" ? "No camera was found on this device." :
        "The camera couldn't be started. Close other apps that use it and try again.",
      );
      stop();
    }
  }, [facing, stop]);

  useEffect(() => stop, [stop]);

  // send a small frame every INTERVAL_MS, skipping if the last one is still in flight
  useEffect(() => {
    if (!running) return;
    const canvas = document.createElement("canvas");
    let sent = 0;
    const started = performance.now();
    const id = window.setInterval(async () => {
      const v = videoRef.current;
      if (!v || busy.current || v.readyState < 2) return;
      busy.current = true;
      const scale = 320 / Math.max(v.videoWidth, v.videoHeight);
      canvas.width = Math.round(v.videoWidth * scale);
      canvas.height = Math.round(v.videoHeight * scale);
      canvas.getContext("2d")!.drawImage(v, 0, 0, canvas.width, canvas.height);
      const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/jpeg", 0.8));
      try {
        if (blob) {
          setLive(await api.predict(blob, { gradcam: false, name: "frame.jpg" }));
          sent++;
          setRate(sent / ((performance.now() - started) / 1000));
        }
      } catch (e) {
        setError((e as Error).message);
      } finally {
        busy.current = false;
      }
    }, INTERVAL_MS);
    return () => clearInterval(id);
  }, [running]);

  const freeze = async () => {
    const v = videoRef.current;
    if (!v) return;
    const c = document.createElement("canvas");
    c.width = v.videoWidth;
    c.height = v.videoHeight;
    c.getContext("2d")!.drawImage(v, 0, 0);
    const blob = await new Promise<Blob | null>((r) => c.toBlob(r, "image/jpeg", 0.92));
    if (blob) {
      setSnapshot(new File([blob], "camera.jpg", { type: "image/jpeg" }));
      stop();
    }
  };

  const flip = () => {
    const next = facing === "user" ? "environment" : "user";
    setFacing(next);
    if (running) start(next);
  };

  const tone = !live ? "" : !live.is_pet ? "bg-gate text-night" : live.species === "cat" ? "bg-cat text-white" : "bg-dog text-night";
  const text = !live ? "" : !live.is_pet ? "No pet in view" : `${live.species === "cat" ? "Cat" : "Dog"} ${pct(live.species_confidence)}`;

  return (
    <section>
      <PageTitle title="Live camera">
        Point your camera at a cat or dog. PawLens checks about two frames a second. Freeze a frame to see the full answer with a heatmap.
      </PageTitle>

      {snapshot ? (
        <div className="space-y-6">
          <div className="flex flex-wrap gap-2">
            <Button variant="primary" icon={<CamIcon className="size-4" />} onClick={() => { setSnapshot(null); start(); }}>Back to camera</Button>
          </div>
          <Analysis file={snapshot} />
        </div>
      ) : (
        <div className="mx-auto max-w-3xl">
          <div className="relative aspect-[4/3] overflow-hidden rounded-[28px] bg-night ring-1 ring-line">
            <video ref={videoRef} playsInline muted className={`h-full w-full object-cover ${facing === "user" ? "-scale-x-100" : ""} ${running ? "" : "opacity-0"}`} />
            {!running && (
              <div className="absolute inset-0 grid place-items-center p-6 text-center text-white/80">
                <div>
                  <CameraOff className="mx-auto mb-3 size-10 text-white/40" />
                  <p className="text-sm">Camera is off</p>
                </div>
              </div>
            )}
            <AnimatePresence>
              {running && live && (
                <motion.div key={text} initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}
                  className={`absolute top-4 left-4 rounded-full px-4 py-2 font-display text-lg font-bold shadow-lg ${tone}`} aria-live="polite">
                  {text}
                </motion.div>
              )}
            </AnimatePresence>
            {running && <span className="num absolute top-4 right-4 rounded-full bg-black/50 px-2.5 py-1 text-xs text-white">{rate.toFixed(1)} checks/s</span>}
            {running && live?.is_pet && live.breeds[0] && (
              <span className="absolute bottom-4 left-4 rounded-full bg-black/55 px-3 py-1.5 text-sm text-white backdrop-blur">{live.breeds[0].name}</span>
            )}
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            {running ? (
              <>
                <Button variant="primary" icon={<Focus className="size-4" />} onClick={freeze}>Freeze and explain</Button>
                <Button icon={<CameraOff className="size-4" />} onClick={stop}>Stop camera</Button>
              </>
            ) : (
              <Button variant="primary" icon={<CamIcon className="size-4" />} onClick={() => start()}>Start camera</Button>
            )}
            {(multiCam || !running) && (
              <Button variant="ghost" icon={<SwitchCamera className="size-4" />} onClick={flip}>
                {facing === "user" ? "Use back camera" : "Use front camera"}
              </Button>
            )}
          </div>
          {error && <div className="mt-4"><ErrorNote>{error}</ErrorNote></div>}
          <p className="mt-4 text-sm text-muted">Frames are sent to your PawLens server only and are not stored.</p>
        </div>
      )}
    </section>
  );
}
