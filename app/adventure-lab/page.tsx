import { notFound } from "next/navigation";

import AdventureLab from "./AdventureLab";

export default function AdventureLabPage() {
  if (process.env.NODE_ENV !== "development") notFound();

  return <AdventureLab />;
}
