"use client";

import { Crown, Headphones, LogOut, Mic, MicOff } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Avatar } from "@/components/Avatar";
import { buttonStyles } from "@/components/styles";
import type { RoomPlayback, RoomSignal } from "@/server/realtime";
import type { RoomState } from "@/server/rooms";

const ICE_SERVERS: RTCIceServer[] = [{ urls: "stun:stun.l.google.com:19302" }];
const HEARTBEAT_MS = 15_000;
const HOST_SYNC_MS = 5_000;
const DRIFT_TOLERANCE_SEC = 1.5;

type Peer = { pc: RTCPeerConnection; pendingIce: RTCIceCandidateInit[] };

export function StudyRoom({ postId, videoId, currentUserId }: { postId: string; videoId: string | null; currentUserId: string }) {
  const [room, setRoom] = useState<RoomState | null>(null);
  const [joined, setJoined] = useState(false);
  const [joining, setJoining] = useState(false);
  const [muted, setMuted] = useState(false);
  const [listenOnly, setListenOnly] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [connections, setConnections] = useState<Record<string, RTCPeerConnectionState>>({});
  const [streams, setStreams] = useState<Record<string, MediaStream>>({});
  const localStream = useRef<MediaStream | null>(null);
  const peers = useRef(new Map<string, Peer>());
  const clockOffset = useRef(0);

  const api = useCallback(
    (action: string, body: unknown = {}) =>
      fetch(`/api/rooms/${postId}/${action}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }),
    [postId],
  );

  const refresh = useCallback(async () => {
    const res = await fetch(`/api/rooms/${postId}`, { cache: "no-store" });
    if (!res.ok) return;
    const next = (await res.json()) as RoomState;
    clockOffset.current = Date.parse(next.serverNow) - Date.now();
    setRoom(next);
  }, [postId]);

  // ---------- WebRTC mesh: one connection per other participant ----------

  const closePeer = useCallback((userId: string) => {
    peers.current.get(userId)?.pc.close();
    peers.current.delete(userId);
    setConnections((c) => without(c, userId));
    setStreams((s) => without(s, userId));
  }, []);

  const getPeer = useCallback(
    (userId: string) => {
      const existing = peers.current.get(userId);
      if (existing) return existing;
      const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
      const peer: Peer = { pc, pendingIce: [] };
      peers.current.set(userId, peer);
      if (localStream.current) {
        for (const track of localStream.current.getTracks()) pc.addTrack(track, localStream.current);
      } else {
        pc.addTransceiver("audio", { direction: "recvonly" });
      }
      pc.onicecandidate = (e) => {
        if (e.candidate) void api("signal", { to: userId, kind: "ice", payload: e.candidate.toJSON() });
      };
      pc.ontrack = (e) => setStreams((s) => ({ ...s, [userId]: e.streams[0] ?? new MediaStream([e.track]) }));
      pc.onconnectionstatechange = () => setConnections((c) => ({ ...c, [userId]: pc.connectionState }));
      return peer;
    },
    [api],
  );

  const callPeer = useCallback(
    async (userId: string) => {
      const { pc } = getPeer(userId);
      await pc.setLocalDescription(await pc.createOffer());
      await api("signal", { to: userId, kind: "offer", payload: pc.localDescription });
    },
    [api, getPeer],
  );

  const onSignal = useCallback(
    async (signal: RoomSignal) => {
      const peer = getPeer(signal.from);
      const { pc } = peer;
      if (signal.kind === "offer") {
        await pc.setRemoteDescription(signal.payload as RTCSessionDescriptionInit);
        await pc.setLocalDescription(await pc.createAnswer());
        await api("signal", { to: signal.from, kind: "answer", payload: pc.localDescription });
      } else if (signal.kind === "answer") {
        await pc.setRemoteDescription(signal.payload as RTCSessionDescriptionInit);
      } else {
        // ICE can arrive before the description it belongs to; hold it until then.
        if (!pc.remoteDescription) peer.pendingIce.push(signal.payload as RTCIceCandidateInit);
        else await pc.addIceCandidate(signal.payload as RTCIceCandidateInit).catch(() => {});
      }
      if (pc.remoteDescription && peer.pendingIce.length) {
        for (const c of peer.pendingIce.splice(0)) await pc.addIceCandidate(c).catch(() => {});
      }
    },
    [api, getPeer],
  );

  // ---------- Shared video ----------

  const player = useRef<YT.Player | null>(null);
  const playerHost = useRef<HTMLDivElement>(null);
  const [playerState, setPlayerState] = useState<number>(-1);
  const isHost = room?.hostId === currentUserId;
  const isHostRef = useRef(isHost);
  useEffect(() => {
    isHostRef.current = isHost;
  }, [isHost]);

  const applyPlayback = useCallback((pb: RoomPlayback) => {
    const p = player.current;
    if (!p || isHostRef.current || typeof p.getCurrentTime !== "function") return;
    const elapsed = pb.playing ? (Date.now() + clockOffset.current - Date.parse(pb.updatedAt)) / 1000 : 0;
    const target = pb.positionSec + Math.max(0, elapsed);
    if (Math.abs(p.getCurrentTime() - target) > DRIFT_TOLERANCE_SEC) p.seekTo(target, true);
    const state = p.getPlayerState();
    if (pb.playing && state !== YT.PlayerState.PLAYING) p.playVideo();
    if (!pb.playing && state === YT.PlayerState.PLAYING) p.pauseVideo();
  }, []);

  const sendPlayback = useCallback(() => {
    const p = player.current;
    if (!p || !isHostRef.current || typeof p.getCurrentTime !== "function") return;
    void api("playback", { playing: p.getPlayerState() === YT.PlayerState.PLAYING, positionSec: p.getCurrentTime() });
  }, [api]);

  // Create the YouTube player after joining (joining is a click, which lets the video play).
  useEffect(() => {
    if (!joined || !videoId || player.current) return;
    let cancelled = false;
    loadYouTubeApi().then(() => {
      if (cancelled || !playerHost.current) return;
      player.current = new YT.Player(playerHost.current, {
        videoId,
        host: "https://www.youtube-nocookie.com",
        playerVars: { playsinline: 1, rel: 0 },
        events: {
          onReady: () => void refresh(),
          onStateChange: (e) => {
            setPlayerState(e.data);
            if (e.data === YT.PlayerState.PLAYING || e.data === YT.PlayerState.PAUSED) sendPlayback();
          },
        },
      });
    });
    return () => {
      cancelled = true;
    };
  }, [joined, videoId, refresh, sendPlayback]);

  // Host re-broadcasts position while playing so followers correct drift.
  useEffect(() => {
    if (!joined || !isHost || !videoId) return;
    const t = setInterval(() => {
      if (player.current?.getPlayerState?.() === YT.PlayerState.PLAYING) sendPlayback();
    }, HOST_SYNC_MS);
    return () => clearInterval(t);
  }, [joined, isHost, videoId, sendPlayback]);

  useEffect(() => {
    if (joined && room) applyPlayback(room.playback);
  }, [joined, room, applyPlayback]);

  // ---------- Presence, events, lifecycle ----------

  useEffect(() => {
    const events = new EventSource(`/api/rooms/${postId}/events`);
    events.addEventListener("ready", refresh);
    events.addEventListener("room.updated", refresh);
    events.addEventListener("room.playback", (e) => {
      const pb = JSON.parse(e.data).data as RoomPlayback;
      setRoom((r) => (r ? { ...r, playback: pb } : r));
    });
    events.addEventListener("room.signal", (e) => void onSignal(JSON.parse(e.data).data as RoomSignal));
    return () => events.close();
  }, [postId, refresh, onSignal]);

  // Close connections to people who left.
  useEffect(() => {
    if (!room) return;
    const present = new Set(room.participants.map((p) => p.userId));
    for (const id of peers.current.keys()) if (!present.has(id)) closePeer(id);
  }, [room, closePeer]);

  const leave = useCallback(() => {
    for (const id of [...peers.current.keys()]) closePeer(id);
    localStream.current?.getTracks().forEach((t) => t.stop());
    localStream.current = null;
    player.current?.destroy();
    player.current = null;
    setJoined(false);
    void api("leave").then(refresh);
  }, [api, closePeer, refresh]);

  useEffect(() => {
    if (!joined) return;
    const beat = setInterval(() => void api("heartbeat"), HEARTBEAT_MS);
    // Best effort when the tab closes; heartbeats time out otherwise.
    const onHide = () => navigator.sendBeacon(`/api/rooms/${postId}/leave`, new Blob(["{}"], { type: "application/json" }));
    window.addEventListener("pagehide", onHide);
    return () => {
      clearInterval(beat);
      window.removeEventListener("pagehide", onHide);
    };
  }, [joined, api, postId]);

  // Leave when navigating away inside the app.
  const leaveRef = useRef(leave);
  useEffect(() => {
    leaveRef.current = leave;
  }, [leave]);
  const joinedRef = useRef(joined);
  useEffect(() => {
    joinedRef.current = joined;
  }, [joined]);
  useEffect(
    () => () => {
      if (joinedRef.current) leaveRef.current();
    },
    [],
  );

  async function join() {
    setError(null);
    setJoining(true);
    try {
      localStream.current = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
      setListenOnly(false);
    } catch {
      localStream.current = null;
      setListenOnly(true);
    }
    const res = await api("join");
    if (!res.ok) {
      setError((await res.json().catch(() => ({}))).error ?? "Couldn't join the room.");
      localStream.current?.getTracks().forEach((t) => t.stop());
      setJoining(false);
      return;
    }
    setJoined(true);
    setJoining(false);
    // Newcomers call everyone already here; existing members answer.
    const state = (await (await fetch(`/api/rooms/${postId}`, { cache: "no-store" })).json()) as RoomState;
    setRoom(state);
    for (const p of state.participants) if (p.userId !== currentUserId) void callPeer(p.userId);
  }

  function toggleMute() {
    const next = !muted;
    localStream.current?.getAudioTracks().forEach((t) => (t.enabled = !next));
    setMuted(next);
    void api("heartbeat", { muted: next });
  }

  const participants = room?.participants ?? [];
  const host = participants.find((p) => p.userId === room?.hostId);

  return (
    <div className="flex flex-col gap-4">
      {videoId && (
        <div className="aspect-video w-full overflow-hidden rounded-lg bg-black" data-player-state={playerState}>
          {joined ? (
            <div ref={playerHost} className="h-full w-full" />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element -- static YouTube thumbnail
            <img src={`https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`} alt="" className="h-full w-full object-cover opacity-60" />
          )}
        </div>
      )}

      <section aria-label="Voice" className="flex flex-col gap-3 rounded-lg bg-sidebar p-4">
        <div className="flex flex-wrap items-center gap-2">
          <Headphones className="h-5 w-5 text-accent" />
          <h2 className="font-semibold">Voice</h2>
          <span className="text-sm text-subtle">
            {participants.length} {participants.length === 1 ? "person" : "people"} here
          </span>
          <div className="ml-auto flex gap-2">
            {joined ? (
              <>
                {!listenOnly && (
                  <button onClick={toggleMute} aria-pressed={muted} className={muted ? buttonStyles.danger : buttonStyles.secondary}>
                    {muted ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                    {muted ? "Unmute" : "Mute"}
                  </button>
                )}
                <button onClick={leave} className={buttonStyles.secondary}>
                  <LogOut className="h-4 w-4" /> Leave
                </button>
              </>
            ) : (
              <button onClick={join} disabled={joining} className={buttonStyles.primary}>
                {joining ? "Joining…" : "Join study room"}
              </button>
            )}
          </div>
        </div>

        {listenOnly && joined && (
          <p className="text-sm text-amber-500">Microphone unavailable — you&apos;re in listen-only mode.</p>
        )}
        {error && (
          <p role="alert" className="text-sm text-danger">
            {error}
          </p>
        )}

        {participants.length === 0 ? (
          <p className="text-sm text-subtle">Nobody is here yet. Join to start studying together.</p>
        ) : (
          <ul className="flex flex-wrap gap-2" aria-live="polite">
            {participants.map((p) => {
              const conn = p.userId === currentUserId ? "self" : connections[p.userId] ?? (joined ? "new" : "idle");
              return (
                <li
                  key={p.userId}
                  data-user={p.userId}
                  data-connection={conn}
                  className="flex items-center gap-2 rounded-full bg-main py-1 pl-1 pr-3 text-sm"
                >
                  <Avatar name={p.name} seed={p.userId} size="sm" />
                  <span className="font-medium">
                    {p.name}
                    {p.userId === currentUserId && <span className="font-normal text-subtle"> (you)</span>}
                  </span>
                  {p.userId === room?.hostId && <Crown className="h-4 w-4 text-amber-400" aria-label="Video host" />}
                  {p.muted && <MicOff className="h-4 w-4 text-danger" aria-label="Muted" />}
                  {joined && conn !== "self" && conn !== "connected" && (
                    <span className="text-xs text-subtle">{conn === "failed" ? "can't connect" : "connecting…"}</span>
                  )}
                </li>
              );
            })}
          </ul>
        )}
        {videoId && joined && (
          <p className="text-xs text-subtle">
            {isHost ? "You control the video for everyone." : `The video follows ${host?.name ?? "the host"}.`}
          </p>
        )}
      </section>

      {/* Remote audio */}
      {Object.entries(streams).map(([userId, stream]) => (
        <PeerAudio key={userId} stream={stream} />
      ))}
    </div>
  );
}

function PeerAudio({ stream }: { stream: MediaStream }) {
  const ref = useRef<HTMLAudioElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.srcObject = stream;
  }, [stream]);
  return <audio ref={ref} autoPlay data-peer-audio />;
}

function without<T>(record: Record<string, T>, key: string) {
  const next = { ...record };
  delete next[key];
  return next;
}

let youtubeApi: Promise<void> | null = null;
function loadYouTubeApi() {
  youtubeApi ??= new Promise<void>((resolve) => {
    if (window.YT?.Player) return resolve();
    const previous = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      previous?.();
      resolve();
    };
    const script = document.createElement("script");
    script.src = "https://www.youtube.com/iframe_api";
    document.head.appendChild(script);
  });
  return youtubeApi;
}
