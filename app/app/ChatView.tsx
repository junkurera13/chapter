"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getAccessToken } from "@base44/sdk";

import type { AuthenticatedViewer } from "@/lib/base44Auth";
import type {
  ConversationChannel,
  ConversationMessageRecord,
} from "@/lib/backendTypes";
import styles from "./ChatView.module.css";

type PendingMessage = {
  id: `local:${string}`;
  role: "user";
  text: string;
  createdAt: number;
  channel: ConversationChannel;
  deliveryStatus: "pending";
};

type ChatMessage = ConversationMessageRecord | PendingMessage;

type SendMessageResult = {
  reply: string | null;
  replyId?: string;
  duplicate?: boolean;
  error?: string;
};

const RECONNECT_MS = 2000;

function getBearer() {
  try {
    return getAccessToken();
  } catch {
    return "";
  }
}

export default function ChatView({
  viewer,
  onConnectPhone,
  onConversationAdvanced,
}: {
  viewer: AuthenticatedViewer;
  onConnectPhone: () => void;
  onConversationAdvanced: () => void;
}) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [status, setStatus] = useState<"idle" | "sending">("idle");
  const [error, setError] = useState<string | null>(null);
  const seenIdsRef = useRef<Set<string>>(new Set());
  const cursorRef = useRef<number>(0);
  const scrollRef = useRef<HTMLDivElement>(null);

  const ingest = useCallback(
    (incoming: ConversationMessageRecord) => {
      const seen = seenIdsRef.current;
      if (seen.has(incoming.id)) return;
      seen.add(incoming.id);
      if (incoming.createdAt > cursorRef.current) {
        cursorRef.current = incoming.createdAt;
      }
      setMessages((prev) => {
        const result = [...prev];
        let mockIdx = -1;
        for (let i = result.length - 1; i >= 0; i -= 1) {
          const candidate = result[i];
          if (
            candidate.id.startsWith("local:") &&
            candidate.role === incoming.role &&
            candidate.text === incoming.text
          ) {
            mockIdx = i;
            break;
          }
        }
        if (mockIdx >= 0) {
          result[mockIdx] = incoming;
        } else {
          result.push(incoming);
        }
        result.sort((a, b) => a.createdAt - b.createdAt);
        return result;
      });
      if (incoming.role === "agent" && incoming.text === "I’ve got it.") {
        onConversationAdvanced();
      }
    },
    [onConversationAdvanced],
  );

  useEffect(() => {
    let cancelled = false;
    let controller: AbortController | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

    async function open() {
      if (cancelled) return;
      const token = getBearer();
      if (!token) return;

      controller = new AbortController();
      const decoder = new TextDecoder();
      let buffer = "";

      try {
        const response = await fetch(
          `/api/chat/stream?since=${cursorRef.current}`,
          {
            headers: { Authorization: `Bearer ${token}` },
            signal: controller.signal,
          },
        );
        if (!response.ok || !response.body) {
          console.error("Chapter stream failed:", response.status);
          if (!cancelled) reconnectTimer = setTimeout(open, RECONNECT_MS);
          return;
        }
        const reader = response.body.getReader();
        while (!cancelled) {
          const { value, done } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          let boundary = buffer.indexOf("\n\n");
          while (boundary >= 0) {
            const rawEvent = buffer.slice(0, boundary);
            buffer = buffer.slice(boundary + 2);
            boundary = buffer.indexOf("\n\n");
            let eventName = "message";
            let data = "";
            for (const line of rawEvent.split("\n")) {
              if (line.startsWith("event: ")) {
                eventName = line.slice("event: ".length).trim();
              } else if (line.startsWith("data: ")) {
                data += line.slice("data: ".length);
              }
            }
            if (eventName === "message") {
              try {
                ingest(JSON.parse(data) as ConversationMessageRecord);
              } catch (err) {
                console.error("Could not parse Chapter stream event:", err);
              }
            } else if (eventName === "restart") {
              if (controller) controller.abort();
              if (!cancelled) reconnectTimer = setTimeout(open, RECONNECT_MS);
            }
          }
        }
      } catch (err) {
        if (!cancelled && controller && !controller.signal.aborted) {
          console.error("Chapter stream error:", err);
        }
      }
      if (!cancelled && controller && !controller.signal.aborted) {
        reconnectTimer = setTimeout(open, RECONNECT_MS);
      }
    }

    void open();

    return () => {
      cancelled = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      if (controller) controller.abort();
    };
  }, [ingest]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  async function send(event?: React.FormEvent) {
    event?.preventDefault();
    const text = draft.trim();
    if (!text || status === "sending") return;

    const localId: `local:${string}` = `local:${crypto.randomUUID()}`;
    const mock: PendingMessage = {
      id: localId,
      role: "user",
      text,
      createdAt: Date.now(),
      channel: "web",
      deliveryStatus: "pending",
    };
    setMessages((prev) =>
      [...prev, mock].sort((a, b) => a.createdAt - b.createdAt),
    );
    setDraft("");
    setStatus("sending");
    setError(null);

    const token = getBearer();
    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ text }),
      });
      const payload = (await response.json()) as SendMessageResult;
      if (response.status === 401) {
        window.location.assign("/?auth=1");
        return;
      }
      if (!response.ok) {
        setError(payload.error ?? "Couldn’t send your message.");
        setStatus("idle");
        setMessages((prev) => prev.filter((m) => m.id !== localId));
        return;
      }
      if (payload.reply && payload.replyId) {
        ingest({
          id: payload.replyId,
          role: "agent",
          text: payload.reply,
          channel: "web",
          deliveryStatus: "pending",
          createdAt: Date.now(),
        });
      }
      setStatus("idle");
    } catch (err) {
      console.error("Chapter chat send failed:", err);
      setError("Network glitch. Try again.");
      setStatus("idle");
      setMessages((prev) => prev.filter((m) => m.id !== localId));
    }
  }

  return (
    <div className={styles.chat}>
      <header className={styles.header}>
        <h1 className={styles.title}>Say Hi.</h1>
        <p className={styles.supporting}>
          Tell me about an experience you’ll never forget. Messy and long is perfect.
          {viewer.messagingConnected ? null : (
            <>
              {" "}
              <button
                type="button"
                className={styles.inlineCta}
                onClick={onConnectPhone}
              >
                Bring Chapter into iMessage
              </button>
              {" "}
              if you also want it in your pocket.
            </>
          )}
        </p>
      </header>

      <div className={styles.scroll} ref={scrollRef} aria-live="polite">
        {messages.length === 0 ? (
          <p className={styles.empty}>Chapter is listening.</p>
        ) : null}
        {messages.map((message) => (
          <div
            key={message.id}
            className={styles.bubbleRow}
            data-role={message.role}
          >
            <div className={styles.bubble} data-role={message.role}>
              {message.role === "agent" ? (
                <span className={styles.agentMark} aria-hidden="true">×</span>
              ) : null}
              <span className={styles.bubbleText}>{message.text}</span>
            </div>
          </div>
        ))}
      </div>

      <form className={styles.compose} onSubmit={send}>
        <input
          className={styles.input}
          aria-label="Compose your message"
          placeholder="Speak freely…"
          autoComplete="off"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          disabled={status === "sending"}
        />
        <button
          className={styles.send}
          type="submit"
          disabled={status === "sending" || draft.trim() === ""}
        >
          {status === "sending" ? "…" : "Send"}
        </button>
      </form>
      {error ? <p className={styles.error} role="alert">{error}</p> : null}
    </div>
  );
}
