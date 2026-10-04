"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Camera passthrough AR view.
 *
 * This is deliberately the simplest AR tier that exists: a `getUserMedia`
 * video feed with a DOM overlay — no WebGL, no 3D assets, no marker, no
 * WebXR. It works on every phone that can open a camera, which is exactly
 * what a live demo needs. `getUserMedia` requires a secure context (HTTPS or
 * localhost), so the app must be served over HTTPS.
 *
 * The overlay does two jobs at once: it shows the user where to point, and it
 * is the capture surface for step verification.
 */

export interface CameraArHandle {
  /** Grab the current frame as a JPEG data URL. */
  capture: () => string | null;
}

interface CameraArProps {
  /** Text shown in the overlay for the current step. */
  hint: string;
  stepIndex: number;
  stepTitle: string;
  /** Rendered inside the overlay above the video. */
  children?: React.ReactNode;
  onReady?: (handle: CameraArHandle) => void;
  className?: string;
}

export function CameraAr({
  hint,
  stepIndex,
  stepTitle,
  children,
  onReady,
  className,
}: CameraArProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [active, setActive] = useState(false);
  const [busy, setBusy] = useState(false);

  const stop = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setActive(false);
  }, []);

  const start = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
        throw new Error(
          "This browser can't open the camera. On phones the page must be served over HTTPS.",
        );
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: "environment" },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      });

      streamRef.current = stream;
      const video = videoRef.current;
      if (video) {
        video.srcObject = stream;
        await video.play().catch(() => {});
      }
      setActive(true);
    } catch (e) {
      const message =
        e instanceof Error && e.name === "NotAllowedError"
          ? "Camera permission was denied. Allow camera access and try again."
          : e instanceof Error
            ? e.message
            : "Could not open the camera.";
      setError(message);
      setActive(false);
    } finally {
      setBusy(false);
    }
  }, []);

  const capture = useCallback((): string | null => {
    const video = videoRef.current;
    if (!video || !active) return null;
    const width = video.videoWidth;
    const height = video.videoHeight;
    if (!width || !height) return null;

    // Downscale before sending: fewer image tokens means fewer free-tier rate
    // limits, and the verifier still sees every crease at this size.
    const maxEdge = 640;
    const scale = Math.min(1, maxEdge / Math.max(width, height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(width * scale);
    canvas.height = Math.round(height * scale);

    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    try {
      return canvas.toDataURL("image/jpeg", 0.68);
    } catch {
      return null;
    }
  }, [active]);

  useEffect(() => {
    if (onReady) onReady({ capture });
  }, [onReady, capture]);

  useEffect(() => stop, [stop]);

  return (
    <div className={className}>
      <div
        style={{
          position: "relative",
          width: "100%",
          aspectRatio: "4 / 3",
          background: "#05080f",
          borderRadius: 14,
          overflow: "hidden",
          border: "1px solid var(--line)",
        }}
      >
        <video
          ref={videoRef}
          playsInline
          muted
          autoPlay
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
            display: active ? "block" : "none",
          }}
        />

        {!active && (
          <div
            style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: 12,
              padding: 20,
              textAlign: "center",
            }}
          >
            <div style={{ fontSize: "2rem" }} aria-hidden>
              📷
            </div>
            <div style={{ fontWeight: 700 }}>Camera AR guide</div>
            <p style={{ color: "var(--muted)", fontSize: "0.9rem", margin: 0, maxWidth: 420 }}>
              {error ??
                "Open the camera to see the next action pinned over your real work, and to let Step by Step verify each step."}
            </p>
            <button className="btn btn-primary" onClick={start} disabled={busy}>
              {busy ? "Opening…" : "Open camera"}
            </button>
          </div>
        )}

        {active && (
          <>
            <div className="ar-overlay" aria-hidden>
              {/* The "point here" marker: bobs over the centre of frame. */}
              <div
                className="ar-arrow"
                style={{ left: "calc(50% - 22px)", top: "38%" }}
              />
              <div
                style={{
                  position: "absolute",
                  left: 12,
                  top: 12,
                  background: "rgba(11,16,32,0.78)",
                  border: "1px solid var(--line)",
                  borderRadius: 10,
                  padding: "8px 12px",
                  maxWidth: "70%",
                }}
              >
                <div style={{ fontSize: "0.7rem", color: "var(--muted)", fontWeight: 700 }}>
                  STEP {stepIndex}
                </div>
                <div style={{ fontWeight: 700, fontSize: "0.95rem" }}>{stepTitle}</div>
                <div style={{ fontSize: "0.8rem", color: "var(--muted)", marginTop: 2 }}>
                  {hint}
                </div>
              </div>
            </div>

            <div
              style={{
                position: "absolute",
                left: 0,
                right: 0,
                bottom: 0,
                padding: 12,
                display: "flex",
                gap: 8,
                justifyContent: "center",
                background:
                  "linear-gradient(to top, rgba(5,8,15,0.85), rgba(5,8,15,0))",
              }}
            >
              {children}
              <button className="btn btn-ghost" onClick={stop}>
                Close camera
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}