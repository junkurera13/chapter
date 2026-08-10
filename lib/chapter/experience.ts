import { z } from "zod";

export const experienceKindSchema = z.enum(["andy", "marco"]);

export type ExperienceKind = z.infer<typeof experienceKindSchema>;

const experienceStopSchema = z.object({
  name: z.string().trim().min(1).max(100),
  address: z.string().trim().min(1).max(180),
  activity: z.string().trim().min(1).max(240),
  hours: z.string().trim().min(1).max(180),
  price: z.string().trim().min(1).max(120),
});

const experienceSourceSchema = z.object({
  label: z.string().trim().min(1).max(100),
  url: z.url(),
});

export const chapterExperienceSchema = z
  .object({
    kind: experienceKindSchema,
    title: z.string().trim().min(1).max(80),
    summary: z.string().trim().min(1).max(240),
    durationMinutes: z.number().int(),
    stops: z.array(experienceStopSchema).min(1).max(3),
    gettingThere: z.string().trim().min(1).max(240),
    booking: z.string().trim().min(1).max(180).optional(),
    whatToBring: z.string().trim().min(1).max(180).optional(),
    whyThisFits: z.string().trim().min(1).max(240),
    sources: z.array(experienceSourceSchema).min(2).max(6),
    verifiedAt: z.iso.datetime(),
  })
  .superRefine((experience, context) => {
    const [minimum, maximum] =
      experience.kind === "andy" ? [45, 90] : [120, 240];

    if (
      experience.durationMinutes < minimum ||
      experience.durationMinutes > maximum
    ) {
      context.addIssue({
        code: "custom",
        path: ["durationMinutes"],
        message: `${experience.kind} experiences must last ${minimum}-${maximum} minutes.`,
      });
    }
  });

export type ChapterExperience = z.infer<typeof chapterExperienceSchema>;

export function formatExperienceForImessage(experience: ChapterExperience) {
  const kind = experience.kind === "andy" ? "Andy" : "Marco";
  const duration = formatDuration(experience.durationMinutes);
  const stops = experience.stops
    .map(
      (stop, index) =>
        `${index + 1}. ${stop.name}\n${stop.activity}\n${stop.address}\n${stop.hours} · ${stop.price}`,
    )
    .join("\n\n");
  const optionalDetails = [
    experience.booking ? `Booking: ${experience.booking}` : null,
    experience.whatToBring ? `Bring: ${experience.whatToBring}` : null,
  ].filter((value): value is string => value !== null);

  return [
    `${kind} · ${duration}`,
    experience.title,
    experience.summary,
    stops,
    `Getting there: ${experience.gettingThere}`,
    ...optionalDetails,
    `Why this one: ${experience.whyThisFits}`,
  ].join("\n\n");
}

function formatDuration(totalMinutes: number) {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours === 0) return `${minutes} min`;
  if (minutes === 0) return `${hours} hr`;
  return `${hours} hr ${minutes} min`;
}
