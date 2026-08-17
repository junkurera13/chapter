"use client";

import { useMutation, useQuery } from "convex/react";
import { useMemo, useState, type FormEvent } from "react";
import type { Id } from "../../convex/_generated/dataModel";
import { api } from "../../convex/_generated/api";
import styles from "./TogetherView.module.css";

function createInviteToken() {
  const bytes = new Uint8Array(32);
  window.crypto.getRandomValues(bytes);
  const binary = Array.from(bytes, (byte) => String.fromCharCode(byte)).join("");
  return window
    .btoa(binary)
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replaceAll("=", "");
}

export default function TogetherView() {
  const connections = useQuery(api.connections.listAccepted);
  const people = useQuery(api.people.listMine);
  const pendingInvites = useQuery(api.connections.listPendingInvites);
  const createPerson = useMutation(api.people.create);
  const createInvite = useMutation(api.connections.createInvite);
  const revokeInvite = useMutation(api.connections.revokeInvite);
  const [composerOpen, setComposerOpen] = useState(false);
  const [selectedPersonId, setSelectedPersonId] =
    useState<Id<"personReferences"> | null>(null);
  const [name, setName] = useState("");
  const [relationship, setRelationship] = useState("");
  const [inviteLink, setInviteLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const unconnectedPeople = useMemo(
    () => people?.filter((person) => person.identityAccountId === undefined) ?? [],
    [people],
  );

  function closeComposer() {
    setComposerOpen(false);
    setSelectedPersonId(null);
    setName("");
    setRelationship("");
    setInviteLink(null);
    setCopied(false);
    setError(null);
  }

  async function submitInvite(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const personReferenceId =
        selectedPersonId ??
        (await createPerson({
          displayName: name,
          relationship: relationship || undefined,
        }));
      const token = createInviteToken();
      await createInvite({ personReferenceId, token });
      setInviteLink(`${window.location.origin}/invite/${token}`);
    } catch (cause: unknown) {
      setError(cause instanceof Error ? cause.message : "Could not create invitation");
    } finally {
      setSubmitting(false);
    }
  }

  async function copyInvite() {
    if (!inviteLink) return;
    await navigator.clipboard.writeText(inviteLink);
    setCopied(true);
  }

  const isEmpty = connections !== undefined && connections.length === 0;

  return (
    <div className={styles.view}>
      <div className={styles.atmosphere} aria-hidden="true" />

      {connections === undefined ? (
        <div className={styles.loading} aria-label="Loading connections" />
      ) : isEmpty ? (
        <section className={styles.empty}>
          <div className={styles.emptyOrbits} aria-hidden="true">
            <span />
            <span />
          </div>
          <h1>No one is here yet.</h1>
          <p>Together only begins when someone accepts your invitation.</p>
          <button type="button" onClick={() => setComposerOpen(true)}>
            Invite someone
          </button>
        </section>
      ) : (
        <section className={styles.content}>
          <header>
            <p>{connections.length} together</p>
            <button type="button" onClick={() => setComposerOpen(true)}>
              <span aria-hidden="true">+</span>
              Invite
            </button>
          </header>
          <div className={styles.peopleGrid}>
            {connections.map((connection) => (
              <article className={styles.person} key={connection._id}>
                {connection.person.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={connection.person.imageUrl} alt="" />
                ) : (
                  <div className={styles.initial} aria-hidden="true">
                    {connection.person.displayName.slice(0, 1).toUpperCase()}
                  </div>
                )}
                <h2>{connection.person.displayName}</h2>
              </article>
            ))}
          </div>
        </section>
      )}

      <div
        className={styles.scrim}
        data-open={composerOpen}
        onMouseDown={(event) => {
          if (event.currentTarget === event.target) closeComposer();
        }}
      >
        <section
          className={styles.composer}
          role="dialog"
          aria-modal="true"
          aria-label="Invite someone"
        >
          <button
            type="button"
            className={styles.close}
            onClick={closeComposer}
            aria-label="Close"
          >
            ×
          </button>

          {inviteLink ? (
            <div className={styles.reveal}>
              <div className={styles.seal} aria-hidden="true" />
              <h2>Your invitation is ready.</h2>
              <p>Send this privately. It can only connect one Chapter account.</p>
              <button type="button" className={styles.copy} onClick={copyInvite}>
                {copied ? "Copied" : "Copy invitation"}
              </button>
            </div>
          ) : (
            <form onSubmit={submitInvite}>
              <h2>Who would you like to invite?</h2>

              {unconnectedPeople.length > 0 ? (
                <div className={styles.knownPeople}>
                  {unconnectedPeople.map((person) => (
                    <button
                      type="button"
                      key={person._id}
                      data-selected={selectedPersonId === person._id}
                      onClick={() => {
                        setSelectedPersonId(person._id);
                        setName("");
                        setRelationship("");
                      }}
                    >
                      <span>{person.displayName.slice(0, 1).toUpperCase()}</span>
                      {person.displayName}
                    </button>
                  ))}
                </div>
              ) : null}

              <div className={styles.orDivider} data-visible={unconnectedPeople.length > 0}>
                <span>or add someone new</span>
              </div>

              <label>
                <span>Name</span>
                <input
                  value={name}
                  onChange={(event) => {
                    setName(event.target.value);
                    setSelectedPersonId(null);
                  }}
                  required={selectedPersonId === null}
                  disabled={selectedPersonId !== null}
                  autoFocus={unconnectedPeople.length === 0}
                  placeholder="Their name"
                  maxLength={80}
                />
              </label>
              <label>
                <span>How you know them <em>optional</em></span>
                <input
                  value={relationship}
                  onChange={(event) => setRelationship(event.target.value)}
                  disabled={selectedPersonId !== null}
                  placeholder="Childhood friend, sister, someone I met…"
                  maxLength={80}
                />
              </label>

              {error ? <p className={styles.error}>{error}</p> : null}
              <button
                type="submit"
                className={styles.create}
                disabled={submitting || (selectedPersonId === null && !name.trim())}
              >
                {submitting ? "Making it…" : "Create invitation"}
              </button>

              {pendingInvites && pendingInvites.length > 0 ? (
                <div className={styles.pending}>
                  <span>Waiting</span>
                  {pendingInvites.map((invite) => (
                    <div key={invite._id}>
                      <p>{invite.personName}</p>
                      <button
                        type="button"
                        onClick={() => void revokeInvite({ inviteId: invite._id })}
                      >
                        Revoke
                      </button>
                    </div>
                  ))}
                </div>
              ) : null}
            </form>
          )}
        </section>
      </div>
    </div>
  );
}
