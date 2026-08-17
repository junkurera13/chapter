import { ClerkProvider } from "@clerk/nextjs";
import type { Metadata } from "next";
import {
  DM_Sans,
  Instrument_Sans,
} from "next/font/google";
import ConvexClientProvider from "./ConvexClientProvider";
import { ClerkCaptcha } from "@/components/auth/ClerkCaptcha";
import "./globals.css";

const chapterSans = DM_Sans({
  variable: "--font-chapter-sans",
  subsets: ["latin"],
});

const chapterInstrument = Instrument_Sans({
  variable: "--font-chapter-instrument",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Chapter",
  description:
    "Experiences that feel strangely meant for you.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${chapterSans.variable} ${chapterInstrument.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col bg-[#f3efe7] font-[family-name:var(--font-chapter-sans)] text-[#1c1c19]">
        <ClerkProvider>
          <ConvexClientProvider>{children}</ConvexClientProvider>
          <ClerkCaptcha />
        </ClerkProvider>
      </body>
    </html>
  );
}
