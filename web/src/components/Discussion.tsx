"use client";

import { Mic, Reply, SendHorizontal, Square, Trash2, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { Avatar } from "@/components/Avatar";
import { ReportButton } from "@/components/ReportButton";
import { formatDuration, MAX_RECORDING_MS, useVoiceRecorder, VoicePlayer } from "@/components/voice";
import { messageTime, shortTime } from "@/lib/format";
import { deleteMessage, sendMessage } from "@/server/message-actions";
import type { ChatMessage } from "@/server/messages";

type Props = {
  postId: string;
  postTitle: string;
  intro: React.ReactNode;
  initialMessages: ChatMessage[];
  currentUserId: string;
  canPost: boolean;
  canModerate: boolean;
};

type Status = "connecting" | "live" | "reconnecting";

const GROUP_WINDOW_MS = 7 * 60_000;

export function Discussion({ postId, postTitle, intro, initialMessages, currentUserId, canPost, canModerate }: Props) {
  const [messages, setMessages] = useState(initialMessages);
  const [status, setStatus] = useState<Status>("connecting");
  const [replyTo, setReplyTo] = useState<ChatMessage | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const nearBottom = useRef(false);
  const scrollOnNext = useRef(false);

  const upsert = useCallback((incoming: ChatMessage[]) => {
    setMessages((prev) => {
      const byId = new Map(prev.map((m) => [m.id, m]));
      for (const m of incoming) byId.set(m.id, m);
      return [...byId.values()].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    });
  }, []);

  const markDeleted = useCallback((id: string) => {
    setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, deleted: true, body: "" } : m)));
  }, []);

  useEffect(() => {
    const events = new EventSource(`/api/posts/${postId}/events`);
    // "ready" fires on every (re)connect; refetch to catch anything sent while we weren't listening.
    events.addEventListener("ready", async () => {
      setStatus("live");
      const res = await fetch(`/api/posts/${postId}/messages`);
      if (res.ok) upsert(await res.json());
    });
    events.addEventListener("message.created", (e) => upsert([JSON.parse(e.data).message]));
    events.addEventListener("message.deleted", (e) => markDeleted(JSON.parse(e.data).messageId));
    // EventSource reconnects automatically.
    events.onerror = () => setStatus("reconnecting");
    return () => events.close();
  }, [postId, upsert, markDeleted]);

  const visible = messages.filter((m) => !m.deleted);
  const byId = new Map(messages.map((m) => [m.id, m]));

  // Follow new messages when the reader is already at the bottom, or just sent one.
  useEffect(() => {
    const el = scrollRef.current;
    if (el && (scrollOnNext.current || nearBottom.current)) el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
    scrollOnNext.current = false;
  }, [visible.length]);

  function jumpTo(id: string) {
    const el = document.getElementById(`msg-${id}`);
    if (!el) return;
    el.scrollIntoView({ block: "center", behavior: "smooth" });
    el.classList.remove("flash");
    void el.offsetWidth; // restart the animation
    el.classList.add("flash");
  }

  return (
    <div className="flex min-w-0 flex-1 flex-col">
      <div
        ref={scrollRef}
        onScroll={(e) => {
          const el = e.currentTarget;
          nearBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 150;
        }}
        className="scroll-thin min-h-0 flex-1 overflow-y-auto pb-4"
      >
        {intro}

        <div className="mx-4 my-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-subtle">
          <span className="h-px flex-1 bg-line" />
          Discussion · {visible.length} {visible.length === 1 ? "message" : "messages"}
          <span className="h-px flex-1 bg-line" />
        </div>

        {visible.length === 0 ? (
          <p className="px-4 py-6 text-center text-sm text-subtle">No messages yet. Start the discussion!</p>
        ) : (
          <ol aria-label="Messages">
            {visible.map((m, i) => {
              const prev = visible[i - 1];
              const grouped =
                !!prev &&
                !m.parentId &&
                prev.authorId === m.authorId &&
                Date.parse(m.createdAt) - Date.parse(prev.createdAt) < GROUP_WINDOW_MS;
              return (
                <MessageRow
                  key={m.id}
                  message={m}
                  grouped={grouped}
                  parent={m.parentId ? (byId.get(m.parentId) ?? null) : undefined}
                  canReply={canPost}
                  canReport={m.authorId !== currentUserId}
                  canDelete={m.authorId === currentUserId || canModerate}
                  onReply={() => setReplyTo(m)}
                  onJump={jumpTo}
                  onDeleted={markDeleted}
                />
              );
            })}
          </ol>
        )}
      </div>

      <div className="shrink-0 px-4 pb-4">
        {canPost ? (
          <Composer
            key={replyTo?.id ?? "root"}
            postId={postId}
            placeholder={`Message #${postTitle.length > 40 ? `${postTitle.slice(0, 40)}…` : postTitle}`}
            replyTo={replyTo}
            onCancelReply={() => setReplyTo(null)}
            onSent={(sent) => {
              scrollOnNext.current = true;
              upsert([sent]);
              setReplyTo(null);
            }}
          />
        ) : (
          <p className="rounded-lg bg-input px-4 py-3 text-sm text-muted">Join this community to take part in the discussion.</p>
        )}
        <div className="mt-1 flex items-center justify-between text-xs text-subtle">
          <span className="flex items-center gap-1.5" aria-live="polite">
            <span className={`h-2 w-2 rounded-full ${status === "live" ? "bg-success" : "bg-amber-400"}`} />
            {status === "live" ? "Live" : status === "connecting" ? "Connecting…" : "Reconnecting…"}
          </span>
          {canPost && <span className="hidden sm:inline">Enter to send · Shift+Enter for a new line</span>}
        </div>
      </div>
    </div>
  );
}

function MessageRow({
  message,
  grouped,
  parent,
  canReply,
  canReport,
  canDelete,
  onReply,
  onJump,
  onDeleted,
}: {
  message: ChatMessage;
  grouped: boolean;
  /** undefined: not a reply. null: replied-to message isn't available. */
  parent: ChatMessage | null | undefined;
  canReply: boolean;
  canReport: boolean;
  canDelete: boolean;
  onReply: () => void;
  onJump: (id: string) => void;
  onDeleted: (id: string) => void;
}) {
  const [pending, startTransition] = useTransition();
  // Touch screens have no hover: tapping a message toggles its actions instead.
  const [showActions, setShowActions] = useState(false);
  const created = new Date(message.createdAt);

  function remove() {
    if (!window.confirm("Delete this message?")) return;
    startTransition(async () => {
      const result = await deleteMessage(message.id);
      if (result.error) window.alert(result.error);
      else onDeleted(message.id);
    });
  }

  return (
    <li
      id={`msg-${message.id}`}
      onClick={() => setShowActions((v) => !v)}
      className={`group relative px-4 hover:bg-hover ${grouped ? "py-0.5" : "mt-3 pb-0.5 pt-1"} ${pending ? "opacity-50" : ""} ${
        showActions ? "bg-hover" : ""
      }`}
    >
      {parent !== undefined && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            if (parent) onJump(parent.id);
          }}
          className="relative mb-1 flex w-full min-w-0 items-center gap-1.5 pl-14 text-left text-sm text-subtle hover:text-fg"
        >
          <span aria-hidden className="absolute left-5 top-1/2 h-3 w-8 rounded-tl-md border-l-2 border-t-2 border-selected" />
          {parent && !parent.deleted ? (
            <>
              <span className="sr-only">Replying to</span>
              <Avatar name={parent.authorName} seed={parent.authorId} size="xs" />
              <span className="shrink-0 font-medium text-muted">@{parent.authorName}</span>
              <span className="truncate">{parent.kind === "voice" ? "🎤 Voice note" : parent.body}</span>
            </>
          ) : (
            <span className="italic">Original message was deleted</span>
          )}
        </button>
      )}

      <div className="flex gap-4">
        {grouped ? (
          <time
            dateTime={message.createdAt}
            className="w-10 shrink-0 pt-1 text-right text-[10px] text-subtle opacity-0 group-hover:opacity-100"
            suppressHydrationWarning
          >
            {shortTime(created)}
          </time>
        ) : (
          <Avatar name={message.authorName} seed={message.authorId} />
        )}
        <div className="min-w-0 flex-1">
          {!grouped && (
            <p className="flex items-baseline gap-2">
              <span className="font-semibold">{message.authorName}</span>
              <time dateTime={message.createdAt} className="text-xs text-subtle" suppressHydrationWarning>
                {messageTime(created)}
              </time>
            </p>
          )}
          {message.kind === "voice" && message.audioUrl ? (
            <div className="py-1">
              <VoicePlayer src={message.audioUrl} durationMs={message.audioDurationMs ?? 0} />
            </div>
          ) : (
            <p className="whitespace-pre-wrap break-words text-[15px] leading-relaxed">{message.body}</p>
          )}
        </div>
      </div>

      {(canReply || canReport || canDelete) && (
        <div
          onClick={(e) => e.stopPropagation()}
          // Invisible rather than display:none so keyboard users can still tab to the actions.
          className={`absolute -top-3 right-4 flex overflow-hidden rounded-md border border-line bg-main shadow-sm focus-within:pointer-events-auto focus-within:opacity-100 group-hover:pointer-events-auto group-hover:opacity-100 ${
            showActions ? "opacity-100" : "pointer-events-none opacity-0"
          }`}
        >
          {canReply && (
            <button type="button" onClick={onReply} aria-label="Reply" title="Reply" className="p-1.5 text-muted hover:bg-hover hover:text-fg">
              <Reply className="h-4 w-4" />
            </button>
          )}
          {canReport && <ReportButton targetType="message" targetId={message.id} variant="icon" />}
          {canDelete && (
            <button
              type="button"
              onClick={remove}
              disabled={pending}
              aria-label="Delete message"
              title="Delete"
              className="p-1.5 text-danger hover:bg-hover"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          )}
        </div>
      )}
    </li>
  );
}

function Composer({
  postId,
  placeholder,
  replyTo,
  onCancelReply,
  onSent,
}: {
  postId: string;
  placeholder: string;
  replyTo: ChatMessage | null;
  onCancelReply: () => void;
  onSent: (message: ChatMessage) => void;
}) {
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const [uploading, setUploading] = useState(false);
  const voice = useVoiceRecorder();
  const lines = Math.min(8, text.split("\n").length);

  async function startRecording() {
    setError(null);
    try {
      await voice.start();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function sendRecording() {
    const recording = await voice.stop();
    if (!recording) {
      setError("That recording was too short. Hold on for at least a second.");
      return;
    }
    setUploading(true);
    try {
      const form = new FormData();
      const ext = recording.blob.type.includes("mp4") ? "m4a" : recording.blob.type.includes("ogg") ? "ogg" : "webm";
      form.append("audio", recording.blob, `voice.${ext}`);
      form.append("durationMs", String(recording.durationMs));
      if (replyTo) form.append("parentId", replyTo.id);
      const res = await fetch(`/api/posts/${postId}/voice`, { method: "POST", body: form });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) setError(data.error ?? "Couldn't send your voice note. Please try again.");
      else onSent(data.message);
    } catch {
      setError("Couldn't send your voice note. Check your connection and try again.");
    } finally {
      setUploading(false);
    }
  }

  function submit() {
    const body = text;
    if (!body.trim()) return;
    setError(null);
    // Clear right away so the next message can be typed while this one sends.
    setText("");
    startTransition(async () => {
      const result = await sendMessage(postId, body, replyTo?.id ?? null);
      if ("error" in result) {
        setError(result.error);
        // Give the text back unless something new was typed meanwhile.
        setText((current) => current || body);
        return;
      }
      onSent(result.message);
    });
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      {error && (
        <p role="alert" className="mb-1 text-sm text-danger">
          {error}
        </p>
      )}
      {replyTo && (
        <div className="flex items-center justify-between rounded-t-lg bg-sidebar px-4 py-2 text-sm text-muted">
          <span className="truncate">
            Replying to <span className="font-semibold text-fg">{replyTo.authorName}</span>
            {replyTo.kind === "voice" && " · 🎤 voice note"}
          </span>
          <button type="button" onClick={onCancelReply} aria-label="Cancel reply" className="rounded-full p-0.5 hover:bg-hover hover:text-fg">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}
      <div className={`flex items-end gap-2 bg-input px-4 py-2 ${replyTo ? "rounded-b-lg" : "rounded-lg"}`}>
        {voice.recording || uploading ? (
          <div className="flex min-w-0 flex-1 items-center gap-3 py-1" aria-live="polite">
            <span className={`h-2.5 w-2.5 shrink-0 rounded-full bg-danger ${uploading ? "" : "animate-pulse"}`} />
            <span className="text-[15px] tabular-nums">
              {uploading ? "Sending voice note…" : `Recording ${formatDuration(voice.elapsedMs)}`}
            </span>
            <span className="hidden text-xs text-subtle sm:inline">max {formatDuration(MAX_RECORDING_MS)}</span>
            <div className="ml-auto flex items-center gap-1">
              <button
                type="button"
                onClick={voice.cancel}
                disabled={uploading}
                aria-label="Discard recording"
                className="rounded p-1 text-muted hover:text-danger disabled:opacity-40"
              >
                <Trash2 className="h-5 w-5" />
              </button>
              <button
                type="button"
                onClick={sendRecording}
                disabled={uploading}
                aria-label="Send voice note"
                className="flex items-center gap-1 rounded bg-accent px-2 py-1 text-sm font-medium text-white hover:bg-accent-hover disabled:opacity-60"
              >
                <Square className="h-3.5 w-3.5" fill="currentColor" /> Send
              </button>
            </div>
          </div>
        ) : (
          <>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                  e.preventDefault();
                  submit();
                }
                if (e.key === "Escape" && replyTo) onCancelReply();
              }}
              placeholder={placeholder}
              aria-label={replyTo ? `Reply to ${replyTo.authorName}` : "Message"}
              maxLength={2000}
              rows={lines}
              autoFocus={replyTo !== null}
              className="max-h-60 min-w-0 flex-1 resize-none bg-transparent py-1 text-[15px] text-fg outline-none placeholder:text-subtle"
            />
            <button
              type="button"
              onClick={startRecording}
              aria-label="Record voice note"
              title="Record voice note"
              className="mb-0.5 rounded p-1 text-muted hover:text-accent"
            >
              <Mic className="h-5 w-5" />
            </button>
            <button
              type="submit"
              disabled={!text.trim()}
              aria-label="Send"
              className="mb-0.5 rounded p-1 text-muted hover:text-accent disabled:opacity-40 disabled:hover:text-muted"
            >
              <SendHorizontal className="h-5 w-5" />
            </button>
          </>
        )}
      </div>
    </form>
  );
}
