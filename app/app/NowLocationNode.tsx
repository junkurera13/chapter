"use client";

import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";

import {
  loadNow,
  saveHomeCity,
  searchPlaceSuggestions,
  type PlaceSuggestion,
} from "@/lib/nowClient";

import { categoryOrbGradient } from "./categoryAppearance";
import styles from "./NowLocationNode.module.css";

export default function NowLocationNode() {
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const suggestionsId = useId();
  const [homeCity, setHomeCity] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [open, setOpen] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [suggestions, setSuggestions] = useState<PlaceSuggestion[]>([]);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [error, setError] = useState("");
  const [announcement, setAnnouncement] = useState("");

  useEffect(() => {
    let active = true;

    void loadNow()
      .then((now) => {
        if (!active) return;
        setHomeCity(now.homeCity);
        setDraft((current) => current || now.homeCity);
      })
      .catch(() => {
        if (active) setHomeCity("");
      });

    return () => {
      active = false;
    };
  }, []);

  const close = useCallback(() => {
    setOpen(false);
    setDirty(false);
    setSuggestions([]);
    setActiveIndex(-1);
    setError("");
    setDraft(homeCity ?? "");
  }, [homeCity]);

  useEffect(() => {
    if (!open) return;

    const frame = window.requestAnimationFrame(() => inputRef.current?.focus());
    const closeFromOutside = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) close();
    };
    const closeFromEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };

    document.addEventListener("pointerdown", closeFromOutside);
    window.addEventListener("keydown", closeFromEscape);
    return () => {
      window.cancelAnimationFrame(frame);
      document.removeEventListener("pointerdown", closeFromOutside);
      window.removeEventListener("keydown", closeFromEscape);
    };
  }, [close, open]);

  useEffect(() => {
    const query = draft.trim();
    if (!open || !dirty || query.length < 2) return;

    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      void searchPlaceSuggestions(query, { signal: controller.signal })
        .then((places) => {
          setSuggestions(places);
          setActiveIndex(-1);
        })
        .catch(() => {
          // A failed place lookup never prevents someone saving what they typed.
        });
    }, 260);

    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [dirty, draft, open]);

  function choose(place: PlaceSuggestion) {
    setDraft(place.label);
    setDirty(true);
    setSuggestions([]);
    setActiveIndex(-1);
    inputRef.current?.focus();
  }

  async function submit() {
    const nextHomeCity = draft.trim();
    if (nextHomeCity.length < 2 || saving) return;

    setSaving(true);
    setError("");
    try {
      const saved = await saveHomeCity(nextHomeCity);
      setHomeCity(saved.homeCity);
      setDraft(saved.homeCity);
      setAnnouncement(`Location saved as ${saved.homeCity}.`);
      setOpen(false);
      setDirty(false);
      setSuggestions([]);
      setActiveIndex(-1);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Chapter couldn’t save that location.",
      );
    } finally {
      setSaving(false);
    }
  }

  const nodeLabel =
    homeCity === null ? "Location" : homeCity || "Set your location";

  return (
    <div className={styles.root} ref={rootRef}>
      <button
        type="button"
        className={styles.node}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => {
          if (open) {
            close();
            return;
          }
          setDraft(homeCity ?? "");
          setError("");
          setOpen(true);
        }}
      >
        <span
          className={styles.orb}
          style={{ background: categoryOrbGradient("place") }}
          aria-hidden="true"
        />
        <span className={styles.nodeLabel}>{nodeLabel}</span>
      </button>

      {open ? (
        <div
          className={styles.picker}
          role="dialog"
          aria-label="Choose your location"
        >
          <form
            onSubmit={(event) => {
              event.preventDefault();
              void submit();
            }}
          >
            <div className={styles.pickerHeading}>
              <h2>Where are you based?</h2>
              <button
                type="button"
                className={styles.close}
                aria-label="Close location picker"
                onClick={close}
              >
                <svg aria-hidden="true" viewBox="0 0 16 16">
                  <path d="m4 4 8 8m0-8-8 8" />
                </svg>
              </button>
            </div>

            <label className={styles.field}>
              <span className={styles.fieldLabel}>Location</span>
              <input
                ref={inputRef}
                type="text"
                value={draft}
                placeholder="Bangbae-dong, Seoul"
                autoComplete="off"
                autoCapitalize="words"
                spellCheck={false}
                maxLength={80}
                role="combobox"
                aria-expanded={suggestions.length > 0}
                aria-controls={suggestionsId}
                aria-autocomplete="list"
                aria-activedescendant={
                  activeIndex >= 0
                    ? `${suggestionsId}-option-${activeIndex}`
                    : undefined
                }
                onChange={(event) => {
                  const nextDraft = event.target.value;
                  setDraft(nextDraft);
                  setDirty(true);
                  setError("");
                  if (nextDraft.trim().length < 2) {
                    setSuggestions([]);
                    setActiveIndex(-1);
                  }
                }}
                onKeyDown={(event) => {
                  if (suggestions.length === 0) return;
                  if (event.key === "ArrowDown") {
                    event.preventDefault();
                    setActiveIndex(
                      (index) => (index + 1) % suggestions.length,
                    );
                  } else if (event.key === "ArrowUp") {
                    event.preventDefault();
                    setActiveIndex((index) =>
                      index <= 0 ? suggestions.length - 1 : index - 1,
                    );
                  } else if (event.key === "Enter" && activeIndex >= 0) {
                    event.preventDefault();
                    choose(suggestions[activeIndex]);
                  }
                }}
              />
            </label>

            <ul
              className={styles.suggestions}
              id={suggestionsId}
              role="listbox"
              aria-label="Places"
            >
              {suggestions.map((place, index) => (
                <li key={place.id}>
                  <button
                    type="button"
                    id={`${suggestionsId}-option-${index}`}
                    role="option"
                    aria-selected={index === activeIndex}
                    data-active={index === activeIndex}
                    onMouseEnter={() => setActiveIndex(index)}
                    onClick={() => choose(place)}
                  >
                    <span>{place.name}</span>
                    {place.context ? <small>{place.context}</small> : null}
                  </button>
                </li>
              ))}
            </ul>

            {error ? (
              <p className={styles.error} role="alert">
                {error}
              </p>
            ) : null}

            <button
              type="submit"
              className={styles.save}
              disabled={draft.trim().length < 2 || saving}
            >
              {saving ? "Saving" : "Save location"}
            </button>
          </form>
        </div>
      ) : null}

      <p className={styles.announcement} aria-live="polite">
        {announcement}
      </p>
    </div>
  );
}
