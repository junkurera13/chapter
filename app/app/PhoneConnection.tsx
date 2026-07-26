"use client";

import { getAccessToken } from "@base44/sdk";
import {
  AsYouType,
  parsePhoneNumberFromString,
  type CountryCode,
} from "libphonenumber-js";
import { useMemo, useState } from "react";

import {
  signOutOfChapter,
  type AuthenticatedViewer,
} from "@/lib/base44Auth";

import styles from "./PhoneConnection.module.css";

const PREFILLED_MESSAGE = "Hey";

type CountryEntry = {
  code: CountryCode;
  name: string;
  dial: string;
  flag: string;
  placeholder: string;
};

const COUNTRIES: CountryEntry[] = [
  { code: "KR", name: "South Korea", dial: "+82", flag: "🇰🇷", placeholder: "010 0000 0000" },
  { code: "US", name: "United States", dial: "+1", flag: "🇺🇸", placeholder: "(000) 000-0000" },
  { code: "CA", name: "Canada", dial: "+1", flag: "🇨🇦", placeholder: "(000) 000-0000" },
  { code: "GB", name: "United Kingdom", dial: "+44", flag: "🇬🇧", placeholder: "07000 000000" },
  { code: "JP", name: "Japan", dial: "+81", flag: "🇯🇵", placeholder: "090-0000-0000" },
  { code: "AU", name: "Australia", dial: "+61", flag: "🇦🇺", placeholder: "0400 000 000" },
  { code: "DE", name: "Germany", dial: "+49", flag: "🇩🇪", placeholder: "0151 00000000" },
  { code: "FR", name: "France", dial: "+33", flag: "🇫🇷", placeholder: "06 00 00 00 00" },
  { code: "IN", name: "India", dial: "+91", flag: "🇮🇳", placeholder: "00000 00000" },
  { code: "ID", name: "Indonesia", dial: "+62", flag: "🇮🇩", placeholder: "0812-0000-0000" },
  { code: "IT", name: "Italy", dial: "+39", flag: "🇮🇹", placeholder: "333 000 0000" },
  { code: "MX", name: "Mexico", dial: "+52", flag: "🇲🇽", placeholder: "55 0000 0000" },
  { code: "NL", name: "Netherlands", dial: "+31", flag: "🇳🇱", placeholder: "06 00000000" },
  { code: "NZ", name: "New Zealand", dial: "+64", flag: "🇳🇿", placeholder: "021 000 0000" },
  { code: "PH", name: "Philippines", dial: "+63", flag: "🇵🇭", placeholder: "0917 000 0000" },
  { code: "SG", name: "Singapore", dial: "+65", flag: "🇸🇬", placeholder: "0000 0000" },
  { code: "ES", name: "Spain", dial: "+34", flag: "🇪🇸", placeholder: "600 00 00 00" },
  { code: "LK", name: "Sri Lanka", dial: "+94", flag: "🇱🇰", placeholder: "071 234 5678" },
  { code: "SE", name: "Sweden", dial: "+46", flag: "🇸🇪", placeholder: "070-000 00 00" },
  { code: "TH", name: "Thailand", dial: "+66", flag: "🇹🇭", placeholder: "081 000 0000" },
  { code: "VN", name: "Vietnam", dial: "+84", flag: "🇻🇳", placeholder: "091 000 00 00" },
];

function smsHref(phone: string) {
  return `sms:${phone}?&body=${encodeURIComponent(PREFILLED_MESSAGE)}`;
}

export default function PhoneConnection({
  viewer,
  onConnected,
  onSkip,
}: {
  viewer: AuthenticatedViewer;
  onConnected: (viewer: AuthenticatedViewer) => void;
  onSkip: () => void;
}) {
  const [countryCode, setCountryCode] = useState<CountryCode>("KR");
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [connectedViewer, setConnectedViewer] =
    useState<AuthenticatedViewer | null>(null);

  const country = useMemo(
    () => COUNTRIES.find((entry) => entry.code === countryCode) ?? COUNTRIES[0],
    [countryCode],
  );
  const e164 = useMemo(() => {
    if (!phone.trim()) return null;
    const parsed = parsePhoneNumberFromString(phone, countryCode);
    return parsed?.isValid() ? parsed.format("E.164") : null;
  }, [countryCode, phone]);

  function updatePhone(raw: string) {
    setPhone(new AsYouType(countryCode).input(raw));
  }

  async function connect(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (!e164) {
      setError("That doesn’t look like a valid number for this country.");
      return;
    }

    const accessToken = getAccessToken();
    if (!accessToken) {
      window.location.assign("/?auth=1");
      return;
    }

    setLoading(true);
    try {
      const response = await fetch("/api/signup", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ phone: e164 }),
      });
      const payload = (await response.json()) as {
        assignedPhone?: string;
        viewer?: AuthenticatedViewer;
        error?: string;
      };

      if (response.status === 401) {
        window.location.assign("/?auth=1");
        return;
      }
      if (!response.ok || !payload.assignedPhone || !payload.viewer) {
        setError(payload.error ?? "Couldn’t connect your number. Try again.");
        return;
      }

      setConnectedViewer(payload.viewer);
    } catch {
      setError("Network glitch. Try again.");
    } finally {
      setLoading(false);
    }
  }

  const assignedPhone = connectedViewer?.assignedPhone;

  return (
    <main className={styles.page}>
      <button
        className={styles.account}
        type="button"
        onClick={signOutOfChapter}
      >
        <span>{viewer.email}</span>
        <span>Sign out</span>
      </button>

      <section className={styles.content} aria-live="polite">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          className={styles.mark}
          src="/chapter-mark.svg"
          alt=""
          width={124}
          height={124}
        />

        {connectedViewer && assignedPhone ? (
          <div className={styles.connected}>
            <h1>Chapter is in your messages.</h1>
            <p className={styles.support}>
              Text “Hey” once. After that, this app and your conversation will
              remember the same you.
            </p>
            <a className={styles.primary} href={smsHref(assignedPhone)}>
              Text Chapter
            </a>
            <button
              className={styles.secondary}
              type="button"
              onClick={() => onConnected(connectedViewer)}
            >
              Enter your world
            </button>
          </div>
        ) : (
          <div className={styles.formWrap}>
            <h1>Bring Chapter into iMessage.</h1>
            <p className={styles.support}>
              Your number links the conversation in your pocket to the private
              world behind this account.
            </p>

            <form className={styles.form} onSubmit={connect}>
              <div className={styles.phoneField}>
                <label className={styles.countryPicker}>
                  <span className={styles.srOnly}>Country</span>
                  <span aria-hidden="true">{country.flag}</span>
                  <span>{country.dial}</span>
                  <select
                    value={countryCode}
                    onChange={(event) => {
                      setCountryCode(event.target.value as CountryCode);
                      setPhone("");
                    }}
                    disabled={loading}
                    aria-label="Country"
                  >
                    {COUNTRIES.map((entry) => (
                      <option key={entry.code} value={entry.code}>
                        {entry.name} ({entry.dial})
                      </option>
                    ))}
                  </select>
                </label>
                <label className={styles.srOnly} htmlFor="chapter-phone">
                  Phone number
                </label>
                <input
                  id="chapter-phone"
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel-national"
                  placeholder={country.placeholder}
                  value={phone}
                  onChange={(event) => updatePhone(event.target.value)}
                  disabled={loading}
                />
              </div>

              {error ? <p className={styles.error}>{error}</p> : null}

              <button
                className={styles.primary}
                type="submit"
                disabled={loading || !e164}
              >
                {loading ? "Connecting…" : "Connect iMessage"}
              </button>
            </form>

            <button className={styles.secondary} type="button" onClick={onSkip}>
              Use the app for now
            </button>

            <p className={styles.privacy}>
              Your number is private and only used to recognize your Chapter
              conversation.
            </p>
          </div>
        )}
      </section>
    </main>
  );
}
