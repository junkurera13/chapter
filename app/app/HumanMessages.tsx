"use client";

import { useState } from "react";

import type { HumanConversationRecord } from "../../lib/introductionSchema";
import styles from "./TogetherView.module.css";

export default function HumanMessages({
  conversations,
  initialConnectionId,
  busy,
  notice,
  onClose,
  onSend,
}: {
  conversations: readonly HumanConversationRecord[];
  initialConnectionId?: string;
  busy: boolean;
  notice: string;
  onClose: () => void;
  onSend: (connectionId: string, message: string) => Promise<boolean>;
}) {
  const [selectedId, setSelectedId] = useState(
    initialConnectionId ?? conversations[0]?.connectionId ?? "",
  );
  const [draft, setDraft] = useState("");

  const conversation = conversations.find(
    (one) => one.connectionId === selectedId,
  );

  return (
    <section className={styles.messages} aria-label="Messages">
      <header className={styles.messagesHead}>
        <button type="button" className={styles.backButton} onClick={onClose}>
          Back
        </button>
        <h1>{conversation?.partnerName ?? "Messages"}</h1>
      </header>

      {!conversation ? (
        <div className={styles.conversationList}>
          {conversations.length === 0 ? (
            <p className={styles.noMessages}>No conversations yet.</p>
          ) : (
            conversations.map((one) => (
              <button
                type="button"
                key={one.connectionId}
                onClick={() => setSelectedId(one.connectionId)}
              >
                <span>{one.partnerName}</span>
                <span>{one.messages.at(-1)?.text}</span>
              </button>
            ))
          )}
        </div>
      ) : (
        <>
          {conversations.length > 1 ? (
            <nav className={styles.conversationTabs} aria-label="Conversations">
              {conversations.map((one) => (
                <button
                  type="button"
                  key={one.connectionId}
                  aria-current={one.connectionId === selectedId || undefined}
                  onClick={() => setSelectedId(one.connectionId)}
                >
                  {one.partnerName}
                </button>
              ))}
            </nav>
          ) : null}

          <div className={styles.messageThread}>
            {conversation.messages.map((message) => (
              <p
                key={message.id}
                className={message.sender === "me"
                  ? styles.messageMine
                  : styles.messageTheirs}
              >
                {message.text}
              </p>
            ))}
          </div>

          <form
            className={styles.threadComposer}
            onSubmit={async (event) => {
              event.preventDefault();
              const message = draft.trim();
              if (!message) return;
              if (await onSend(conversation.connectionId, message)) setDraft("");
            }}
          >
            <textarea
              value={draft}
              rows={2}
              maxLength={1_000}
              placeholder={`Message ${conversation.partnerName}`}
              aria-label={`Message ${conversation.partnerName}`}
              onChange={(event) => setDraft(event.target.value)}
            />
            <button type="submit" disabled={busy || !draft.trim()}>
              Send
            </button>
          </form>
        </>
      )}

      {notice ? <p className={styles.notice}>{notice}</p> : null}
    </section>
  );
}
