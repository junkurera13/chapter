"use client";

import { useClerk, useUser } from "@clerk/nextjs";
import { useMutation } from "convex/react";
import {
  useEffect,
  useId,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
} from "react";

import { api } from "../convex/_generated/api";
import styles from "./ChapterProfileMenu.module.css";

type ProfileView = "menu" | "edit" | "billing";

function displayName(user: {
  fullName: string | null;
  firstName: string | null;
}) {
  return user.fullName ?? user.firstName ?? "Chapter member";
}

function clerkErrorMessage(cause: unknown) {
  if (cause && typeof cause === "object" && "errors" in cause) {
    const errors = (cause as { errors?: Array<{ longMessage?: string; message?: string }> }).errors;
    const first = errors?.[0];
    if (first?.longMessage || first?.message) {
      return first.longMessage ?? first.message ?? "That change could not be saved.";
    }
  }
  return cause instanceof Error ? cause.message : "That change could not be saved.";
}

export default function ChapterProfileMenu() {
  const { user, isLoaded } = useUser();
  const { signOut } = useClerk();
  const ensureCurrent = useMutation(api.accounts.ensureCurrent);
  const rootRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const panelId = useId();
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<ProfileView>("menu");
  const [name, setName] = useState("");
  const [photo, setPhoto] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;

    function closeOnOutsidePress(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    document.addEventListener("pointerdown", closeOnOutsidePress);
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutsidePress);
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  useEffect(
    () => () => {
      if (photoPreview) URL.revokeObjectURL(photoPreview);
    },
    [photoPreview],
  );

  if (!isLoaded || !user) {
    return <span className={styles.placeholder} aria-hidden="true" />;
  }

  function closeMenu() {
    setOpen(false);
    setView("menu");
    setError(null);
  }

  function openEditor() {
    if (!user) return;
    setName(displayName(user));
    setPhoto(null);
    setPhotoPreview(null);
    setError(null);
    setView("edit");
  }

  function choosePhoto(event: ChangeEvent<HTMLInputElement>) {
    const nextPhoto = event.target.files?.[0] ?? null;
    event.target.value = "";
    if (!nextPhoto) return;
    if (!nextPhoto.type.startsWith("image/")) {
      setError("Choose an image file.");
      return;
    }
    if (nextPhoto.size > 10 * 1024 * 1024) {
      setError("Choose an image smaller than 10 MB.");
      return;
    }
    if (photoPreview) URL.revokeObjectURL(photoPreview);
    setPhoto(nextPhoto);
    setPhotoPreview(URL.createObjectURL(nextPhoto));
    setError(null);
  }

  async function updateProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!user || saving) return;
    const normalizedName = name.trim().replace(/\s+/g, " ");
    if (!normalizedName) {
      setError("Add your name.");
      return;
    }

    const [firstName, ...remainingName] = normalizedName.split(" ");
    setSaving(true);
    setError(null);
    try {
      const updatedUser = await user.update({
        firstName,
        lastName: remainingName.length > 0 ? remainingName.join(" ") : null,
      });
      if (photo) await updatedUser.setProfileImage({ file: photo });
      const refreshedUser = await updatedUser.reload();
      await ensureCurrent({
        displayName: displayName(refreshedUser),
        imageUrl: refreshedUser.imageUrl,
      });
      setPhoto(null);
      setPhotoPreview(null);
      setView("menu");
    } catch (cause) {
      setError(clerkErrorMessage(cause));
    } finally {
      setSaving(false);
    }
  }

  async function logOut() {
    if (signingOut) return;
    setSigningOut(true);
    setError(null);
    try {
      await signOut({ redirectUrl: "/" });
    } catch (cause) {
      setError(clerkErrorMessage(cause));
      setSigningOut(false);
    }
  }

  const activeImage = photoPreview ?? user.imageUrl;

  return (
    <div className={styles.root} ref={rootRef}>
      <button
        className={styles.trigger}
        type="button"
        aria-label="Open profile menu"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        onClick={() => {
          if (open) {
            closeMenu();
          } else {
            setView("menu");
            setError(null);
            setOpen(true);
          }
        }}
      >
        {/* Clerk profile images are dynamic remote URLs. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={user.imageUrl} alt="" />
      </button>

      {open ? (
        <section className={styles.panel} id={panelId} role="dialog" aria-label="Profile">
          {view === "menu" ? (
            <div className={styles.view} key="menu">
              <header className={styles.identity}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={user.imageUrl} alt="" />
                <strong>{displayName(user)}</strong>
              </header>

              <div className={styles.menu}>
                <button type="button" onClick={openEditor}>
                  <span>Update profile</span>
                  <span className={styles.chevron} aria-hidden="true">›</span>
                </button>
                <a href="mailto:support@usechapter.xyz">
                  <span>Support</span>
                  <span className={styles.chevron} aria-hidden="true">›</span>
                </a>
                <button type="button" onClick={() => setView("billing")}>
                  <span>Billing</span>
                  <span className={styles.chevron} aria-hidden="true">›</span>
                </button>
              </div>

              <div className={styles.logoutSection}>
                <button className={styles.logout} type="button" disabled={signingOut} onClick={logOut}>
                  <svg aria-hidden="true" viewBox="0 0 20 20" fill="none">
                    <path d="M8 4.5H5.5A1.5 1.5 0 0 0 4 6v8a1.5 1.5 0 0 0 1.5 1.5H8" />
                    <path d="M11.5 6.5 15 10l-3.5 3.5M7.5 10H15" />
                  </svg>
                  <span>{signingOut ? "Logging out…" : "Log out"}</span>
                </button>
              </div>
              {error ? <p className={styles.error} role="alert">{error}</p> : null}
            </div>
          ) : view === "edit" ? (
            <form className={styles.view} key="edit" onSubmit={updateProfile}>
              <header className={styles.viewHeader}>
                <button type="button" aria-label="Back to profile" onClick={() => setView("menu")}>←</button>
                <strong>Update profile</strong>
              </header>

              <button
                className={styles.photoEditor}
                type="button"
                aria-label="Choose a new profile picture"
                onClick={() => fileInputRef.current?.click()}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={activeImage} alt="" />
                <span>Change</span>
              </button>
              <input
                ref={fileInputRef}
                className={styles.fileInput}
                type="file"
                accept="image/*"
                onChange={choosePhoto}
              />

              <label className={styles.field}>
                <span>Name</span>
                <input
                  value={name}
                  maxLength={80}
                  autoComplete="name"
                  disabled={saving}
                  onChange={(event) => setName(event.target.value)}
                />
              </label>

              {error ? <p className={styles.error} role="alert">{error}</p> : null}
              <button className={styles.save} type="submit" disabled={saving}>
                {saving ? "Saving…" : "Save"}
              </button>
            </form>
          ) : (
            <div className={styles.view} key="billing">
              <header className={styles.viewHeader}>
                <button type="button" aria-label="Back to profile" onClick={() => setView("menu")}>←</button>
                <strong>Billing</strong>
              </header>
              <div className={styles.billingState}>
                <strong>Nothing to manage yet.</strong>
                <p>Chapter is currently free during private access.</p>
              </div>
            </div>
          )}
        </section>
      ) : null}
    </div>
  );
}
