import { notFound } from "next/navigation";

import ExperienceGeneratorHarness from "./ExperienceGeneratorHarness";

export default function ExperienceGeneratorPage() {
  if (process.env.NODE_ENV !== "development") notFound();

  return <ExperienceGeneratorHarness />;
}
