import type { Metadata } from "next";
import type { StaticImageData } from "next/image";
import type { ReactNode } from "react";

import beachBasketballImage from "@/app/assets/launch-cards/beach-basketball.png";
import blueHourSwimImage from "@/app/assets/launch-cards/blue-hour-swim.png";
import canalRideImage from "@/app/assets/launch-cards/canal-ride.png";
import nightMarketImage from "@/app/assets/launch-cards/night-market.png";
import romeDinnerImage from "@/app/assets/launch-cards/rome-dinner.png";
import tukTukRideImage from "@/app/assets/launch-cards/tuk-tuk-ride.png";
import {
  CategoryAnchor,
  ChapterMomentCard,
  PlaceAnchor,
} from "@/components/aicanvas/chapter-moment-card";

import styles from "./page.module.css";

export const metadata: Metadata = {
  title: "Launch cards · Chapter",
  robots: { index: false, follow: false },
};

interface LaunchCard {
  alt: string;
  ariaLabel: string;
  copy: ReactNode;
  id: string;
  image: StaticImageData;
  imagePosition?: string;
}

const LAUNCH_CARDS: LaunchCard[] = [
  {
    id: "canal-ride",
    image: canalRideImage,
    imagePosition: "center 54%",
    alt: "Two people riding bicycles together through canal streets at dusk",
    ariaLabel: "Go cycling along Prinsengracht with Maya.",
    copy: (
      <>
        Go <CategoryAnchor category="activity">Cycling</CategoryAnchor> along{" "}
        <PlaceAnchor>Prinsengracht</PlaceAnchor> with{" "}
        <CategoryAnchor category="people">Maya</CategoryAnchor>.
      </>
    ),
  },
  {
    id: "dinner-in-rome",
    image: romeDinnerImage,
    imagePosition: "56% center",
    alt: "Three friends sharing pizza at an outdoor dinner in Rome",
    ariaLabel: "Have dinner at Trattoria Luma in Rome with Sofia and Elena.",
    copy: (
      <>
        Have <CategoryAnchor category="activity">Dinner</CategoryAnchor> at{" "}
        <PlaceAnchor>Trattoria Luma, Rome</PlaceAnchor> with{" "}
        <CategoryAnchor category="people">Sofia &amp; Elena</CategoryAnchor>.
      </>
    ),
  },
  {
    id: "court-by-the-water",
    image: beachBasketballImage,
    imagePosition: "48% center",
    alt: "A group playing basketball on an outdoor court beside the water",
    ariaLabel:
      "Play basketball at Ocean Court in Miami Beach with Marcus, Theo, and Jay.",
    copy: (
      <>
        Play <CategoryAnchor category="activity">Basketball</CategoryAnchor> at{" "}
        <PlaceAnchor>Ocean Court, Miami Beach</PlaceAnchor> with{" "}
        <CategoryAnchor category="people">Marcus, Theo &amp; Jay</CategoryAnchor>.
      </>
    ),
  },
  {
    id: "tuk-tuk-curiosity",
    image: tukTukRideImage,
    imagePosition: "58% center",
    alt: "Two people riding through a neighbourhood in the back of a tuk-tuk",
    ariaLabel: "Take a tuk-tuk along Lotus Road in Colombo with Nina.",
    copy: (
      <>
        Take a <CategoryAnchor category="activity">Tuk-Tuk</CategoryAnchor> along{" "}
        <PlaceAnchor>Lotus Road, Colombo</PlaceAnchor> with{" "}
        <CategoryAnchor category="people">Nina</CategoryAnchor>.
      </>
    ),
  },
  {
    id: "night-market",
    image: nightMarketImage,
    imagePosition: "50% center",
    alt: "Four friends sharing warm drinks at a Japanese night market",
    ariaLabel:
      "Try street food at Nakajima Night Market in Sapporo with Kenji, Luca, and Noah.",
    copy: (
      <>
        Try <CategoryAnchor category="activity">Street Food</CategoryAnchor> at{" "}
        <PlaceAnchor>Nakajima Night Market, Sapporo</PlaceAnchor> with{" "}
        <CategoryAnchor category="people">Kenji, Luca &amp; Noah</CategoryAnchor>.
      </>
    ),
  },
  {
    id: "blue-hour-swim",
    image: blueHourSwimImage,
    imagePosition: "center 52%",
    alt: "Three friends running together into the sea after sunset",
    ariaLabel: "Go night swimming at Moon Bay Beach with Sofia and Mia.",
    copy: (
      <>
        Go <CategoryAnchor category="activity">Night Swimming</CategoryAnchor> at{" "}
        <PlaceAnchor>Moon Bay Beach</PlaceAnchor> with{" "}
        <CategoryAnchor category="people">Sofia &amp; Mia</CategoryAnchor>.
      </>
    ),
  },
];

export default function LaunchCardsPage() {
  return (
    <main className={styles.page} aria-label="Chapter launch cards">
      {LAUNCH_CARDS.map((card, index) => (
        <section className={styles.frame} id={card.id} key={card.id}>
          <ChapterMomentCard
            ariaLabel={card.ariaLabel}
            alt={card.alt}
            copy={card.copy}
            image={card.image.src}
            imageAspectRatio="3 / 2"
            imagePosition={card.imagePosition}
            priority={index === 0}
          />
        </section>
      ))}
    </main>
  );
}
