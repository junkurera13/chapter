"use client";

import { useEffect, useId, useRef, useState } from "react";

import {
  saveHomeCity,
  searchPlaceSuggestions,
  type PlaceSuggestion,
} from "@/lib/nowClient";

import styles from "./HomeCityForm.module.css";

/**
 * The one place a home city is asked for.
 *
 * It lives in the corner node for someone changing their mind, and inline on
 * Now for someone who has never given one. Somebody arriving for the first
 * time should not have to find a small control in a corner to start the thing
 * the screen is asking them for.
 */
export default function HomeCityForm({
  initialValue = "",
  onSaved,
  autoFocus = false,
  variant = "popover",
}: {
  initialValue?: string;
  onSaved?: (homeCity: string) => void;
  autoFocus?: boolean;
  variant?: "popover" | "inline";
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const suggestionsId = useId();
  const [draft, setDraft] = useState(initialValue);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [suggestions, setSuggestions] = useState<PlaceSuggestion[]>([]);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!autoFocus) return;
    const frame = window.requestAnimationFrame(() => inputRef.current?.focus());
    return () => window.cancelAnimationFrame(frame);
  }, [autoFocus]);

  useEffect(() => {
    const query = draft.trim();
    if (!dirty || query.length < 2) return;

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
  }, [dirty, draft]);

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
      setDraft(saved.homeCity);
      setDirty(false);
      setSuggestions([]);
      setActiveIndex(-1);
      onSaved?.(saved.homeCity);
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

  return (
    <form
      className={styles.form}
      data-variant={variant}
      onSubmit={(event) => {
        event.preventDefault();
        void submit();
      }}
    >
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
              setActiveIndex((index) => (index + 1) % suggestions.length);
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
  );
}
