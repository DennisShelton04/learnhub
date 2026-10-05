"use client";

import { Pause, Play } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

export const MAX_RECORDING_MS = 5 * 60 * 1000;
const MIN_RECORDING_MS = 1000;

// Chrome/Firefox record WebM or Ogg Opus; Safari records MP4/AAC.
const mimeCandidates = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg;codecs=opus"];

export function formatDuration(ms: number) {
  const total = Math.max(0, Math.round(ms / 1000));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}

type Recording = { blob: Blob; durationMs: number };

/** Records audio from the microphone with MediaRecorder. */
export function useVoiceRecorder() {
  const [recording, setRecording] = useState(false);
  const [elapsedMs, setElapsedMs] = useState(0);
  const recorder = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  const startedAt = useRef(0);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const finished = useRef<((r: Recording | null) => void) | null>(null);

  const cleanup = useCallback(() => {
    if (timer.current) clearInterval(timer.current);
    timer.current = null;
    recorder.current?.stream.getTracks().forEach((t) => t.stop());
    recorder.current = null;
    setRecording(false);
    setElapsedMs(0);
  }, []);

  useEffect(() => cleanup, [cleanup]);

  /** Asks for the microphone and starts recording. Throws a user-facing message on failure. */
  const start = useCallback(async () => {
    if (typeof MediaRecorder === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      throw new Error("Voice notes aren't supported in this browser.");
    }
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      throw new Error("Microphone access was blocked. Allow it in your browser settings to record.");
    }
    const mimeType = mimeCandidates.find((t) => MediaRecorder.isTypeSupported(t));
    const rec = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
    chunks.current = [];
    rec.ondataavailable = (e) => e.data.size > 0 && chunks.current.push(e.data);
    rec.onstop = () => {
      const durationMs = Date.now() - startedAt.current;
      const blob = new Blob(chunks.current, { type: rec.mimeType });
      cleanup();
      finished.current?.({ blob, durationMs });
      finished.current = null;
    };
    recorder.current = rec;
    startedAt.current = Date.now();
    rec.start(250);
    setRecording(true);
    timer.current = setInterval(() => {
      const elapsed = Date.now() - startedAt.current;
      setElapsedMs(elapsed);
      if (elapsed >= MAX_RECORDING_MS && rec.state === "recording") rec.stop();
    }, 200);
  }, [cleanup]);

  /** Stops and returns the recording, or null if it was too short. */
  const stop = useCallback(() => {
    return new Promise<Recording | null>((resolve) => {
      const rec = recorder.current;
      if (!rec || rec.state !== "recording") return resolve(null);
      finished.current = (r) => resolve(r && r.durationMs >= MIN_RECORDING_MS ? r : null);
      rec.stop();
    });
  }, []);

  const cancel = useCallback(() => {
    finished.current = null;
    if (recorder.current?.state === "recording") recorder.current.stop();
    else cleanup();
  }, [cleanup]);

  return { recording, elapsedMs, start, stop, cancel };
}

/** Compact audio player for voice notes. */
export function VoicePlayer({ src, durationMs }: { src: string; durationMs: number }) {
  const audio = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [positionMs, setPositionMs] = useState(0);

  function toggle() {
    const el = audio.current;
    if (!el) return;
    if (el.paused) void el.play();
    else el.pause();
  }

  return (
    <div className="flex w-72 max-w-full items-center gap-3 rounded-full bg-sidebar py-1.5 pl-1.5 pr-4" onClick={(e) => e.stopPropagation()}>
      <button
        type="button"
        onClick={toggle}
        aria-label={playing ? "Pause voice note" : "Play voice note"}
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent text-white hover:bg-accent-hover"
      >
        {playing ? <Pause className="h-4 w-4" fill="currentColor" /> : <Play className="ml-0.5 h-4 w-4" fill="currentColor" />}
      </button>
      <input
        type="range"
        min={0}
        max={durationMs}
        step={100}
        value={Math.min(positionMs, durationMs)}
        onChange={(e) => {
          const ms = Number(e.target.value);
          setPositionMs(ms);
          if (audio.current) audio.current.currentTime = ms / 1000;
        }}
        aria-label="Seek voice note"
        className="h-1.5 min-w-0 flex-1 cursor-pointer accent-accent"
      />
      <span className="w-9 shrink-0 text-right text-xs tabular-nums text-muted">
        {formatDuration(playing || positionMs > 0 ? positionMs : durationMs)}
      </span>
      <audio
        ref={audio}
        src={src}
        preload="none"
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => {
          setPlaying(false);
          setPositionMs(0);
        }}
        onTimeUpdate={(e) => setPositionMs(e.currentTarget.currentTime * 1000)}
      />
    </div>
  );
}
