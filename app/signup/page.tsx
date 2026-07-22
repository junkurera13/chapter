"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  AsYouType,
  parsePhoneNumberFromString,
  type CountryCode,
} from "libphonenumber-js";

const PREFILLED_MESSAGE = "hey";

type CountryEntry = {
  code: CountryCode;
  name: string;
  dial: string;
  flag: string;
  placeholder: string;
};

// Hand-picked list — covers most early Sidequest users without overwhelming
// the dropdown. KR sits at the top since most of the early friends are in Seoul.
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

function buildSmsHref(phone: string) {
  return `sms:${phone}?&body=${encodeURIComponent(PREFILLED_MESSAGE)}`;
}

export default function SignupPage() {
  const [countryCode, setCountryCode] = useState<CountryCode>("KR");
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const country = useMemo(
    () => COUNTRIES.find((c) => c.code === countryCode) ?? COUNTRIES[0],
    [countryCode],
  );

  const e164 = useMemo(() => {
    if (!phone.trim()) return null;
    const parsed = parsePhoneNumberFromString(phone, countryCode);
    return parsed?.isValid() ? parsed.format("E.164") : null;
  }, [phone, countryCode]);

  function handlePhoneChange(raw: string) {
    // Format as user types so they see e.g. "010 5896 4319" growing nicely.
    const formatter = new AsYouType(countryCode);
    setPhone(formatter.input(raw));
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (!e164) {
      setError("that doesn't look like a valid number for that country.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: e164 }),
      });

      const data = (await res.json()) as {
        assignedPhone?: string;
        error?: string;
      };

      if (!res.ok || !data.assignedPhone) {
        setError(data.error ?? "something broke. try again.");
        setLoading(false);
        return;
      }

      window.location.href = buildSmsHref(data.assignedPhone);
    } catch {
      setError("network glitch. try again.");
      setLoading(false);
    }
  }

  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center bg-pixel-yellow px-6 pb-24 pt-12 sm:px-10">
      <Link
        href="/"
        className="absolute left-6 top-6 font-[family-name:var(--font-vt323)] text-lg uppercase tracking-[0.3em] text-black underline decoration-2 underline-offset-4 sm:left-10 sm:top-10 sm:text-xl"
      >
        ← back
      </Link>

      <div className="flex w-full max-w-sm -translate-y-10 flex-col items-center text-center sm:-translate-y-16">
        <div className="relative h-20 w-20 sm:h-24 sm:w-24">
          {/* The SVG has ~19% transparent padding at the bottom, so we shift
              the image down by that much to anchor the visible glyph (not the
              canvas) to the wrapper's bottom edge. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/logo-mark.svg"
            alt="sidequest"
            width={448}
            height={448}
            className="image-pixelated absolute bottom-0 left-1/2 h-72 w-72 -translate-x-1/2 translate-y-[30%] sm:h-96 sm:w-96"
          />
        </div>

        <h1 className="mt-8 font-[family-name:var(--font-pixelify-sans)] text-3xl font-bold leading-tight tracking-tight text-pixel-pink sm:text-4xl">
          welcome to sidequest
        </h1>

        <p className="mt-2 font-[family-name:var(--font-pixelify-sans)] text-xl font-bold leading-tight text-black sm:text-2xl">
          what&apos;s ur number?
        </p>

        <form
          onSubmit={handleSubmit}
          className="mt-8 flex w-full flex-col items-stretch gap-4"
        >
          <div className="flex w-full items-center gap-3 rounded-2xl bg-zinc-900 px-4 py-5 sm:py-6">
            <label htmlFor="country" className="sr-only">
              country
            </label>
            <div className="relative flex items-center gap-1.5">
              <svg
                aria-hidden
                viewBox="0 0 24 32"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="h-5 w-4 text-zinc-400"
              >
                <polyline points="6 12 12 6 18 12" />
                <polyline points="6 20 12 26 18 20" />
              </svg>
              <span className="text-3xl leading-none" aria-hidden>
                {country.flag}
              </span>
              <select
                id="country"
                value={countryCode}
                onChange={(e) => setCountryCode(e.target.value as CountryCode)}
                disabled={loading}
                className="absolute inset-0 cursor-pointer appearance-none opacity-0"
                aria-label="country code"
              >
                {COUNTRIES.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.flag} {c.name} ({c.dial})
                  </option>
                ))}
              </select>
            </div>

            <input
              id="phone"
              type="tel"
              inputMode="tel"
              autoComplete="tel-national"
              placeholder={country.placeholder}
              value={phone}
              onChange={(e) => handlePhoneChange(e.target.value)}
              disabled={loading}
              autoFocus
              className="min-w-0 flex-1 bg-transparent font-[family-name:var(--font-pixelify-sans)] text-2xl text-white outline-none placeholder:text-zinc-500 sm:text-3xl"
            />
          </div>

          {error && (
            <p className="font-[family-name:var(--font-pixelify-sans)] text-base leading-snug text-pixel-pink">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading || !e164}
            className="w-full border-4 border-black bg-pixel-pink px-6 py-4 font-[family-name:var(--font-pixelify-sans)] text-2xl font-bold uppercase tracking-wider text-black transition-transform disabled:opacity-50 sm:text-3xl pixel-shadow-black"
          >
            {loading ? "setting up..." : "continue with phone"}
          </button>
        </form>
      </div>

      <p className="absolute bottom-6 left-1/2 max-w-xs -translate-x-1/2 px-6 text-center font-[family-name:var(--font-vt323)] text-base leading-snug text-black sm:bottom-10 sm:text-lg">
        By continuing, you agree to our{" "}
        <Link
          href="/terms"
          className="underline decoration-2 underline-offset-2"
        >
          Terms of Service
        </Link>{" "}
        and{" "}
        <Link
          href="/privacy"
          className="underline decoration-2 underline-offset-2"
        >
          Privacy Policy
        </Link>
        .
      </p>
    </main>
  );
}
