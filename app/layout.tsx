import type { Metadata } from "next";
import {
  DM_Sans,
  Instrument_Sans,
  Newsreader,
} from "next/font/google";
import "./globals.css";

const sidequestSans = DM_Sans({
  variable: "--font-sidequest-sans",
  subsets: ["latin"],
});

const sidequestSerif = Newsreader({
  variable: "--font-sidequest-serif",
  subsets: ["latin"],
  style: ["normal", "italic"],
});

const sidequestInstrument = Instrument_Sans({
  variable: "--font-sidequest-instrument",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Sidequest",
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
      className={`${sidequestSans.variable} ${sidequestSerif.variable} ${sidequestInstrument.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col bg-white font-[family-name:var(--font-sidequest-sans)] text-[#1c1c19]">
        {children}
      </body>
    </html>
  );
}
