import type { Metadata } from "next";
import {
  DM_Sans,
  Newsreader,
  Pixelify_Sans,
  VT323,
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

const pixelifySans = Pixelify_Sans({
  variable: "--font-pixelify-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const vt323 = VT323({
  variable: "--font-vt323",
  subsets: ["latin"],
  weight: "400",
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
      className={`${sidequestSans.variable} ${sidequestSerif.variable} ${pixelifySans.variable} ${vt323.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col bg-[#f3efe7] font-[family-name:var(--font-sidequest-sans)] text-[#1c1c19]">
        {children}
      </body>
    </html>
  );
}
