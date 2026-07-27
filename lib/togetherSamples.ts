import type { TogetherGist } from "./togetherGistSchema";

/**
 * Accounts that get sample gists alongside whatever is real. The tab is the
 * hardest thing in Chapter to demo — it needs two graphs that overlap — so one
 * account is allowed to see the shape of it before the pool exists.
 *
 * Deliberately readable from the browser as well as the server. A sample is a
 * constant, and a constant that has to be fetched is a constant that arrives
 * five seconds late. The server keeps its own variable so the list can be
 * changed in production without a rebuild; the browser falls back to the same
 * default the server ships with.
 */
export function demoAccounts(): string[] {
  return (
    process.env.CHAPTER_DEMO_ACCOUNTS ??
    process.env.NEXT_PUBLIC_CHAPTER_DEMO_ACCOUNTS ??
    "parkjundk@gmail.com"
  )
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

export function isDemoAccount(email: string | undefined) {
  return Boolean(email && demoAccounts().includes(email.trim().toLowerCase()));
}

/**
 * Four sample gists from the Fukuoka crew, written the way the model writes
 * them. The anchors carry ids so they render as orbs — the point of a sample
 * is to show what a real one looks like — but the connection ids are marked,
 * so nothing downstream can mistake one for a person you can actually plan with.
 */
export function demoGists(): TogetherGist[] {
  return [
    {
      connectionId: "demo:samuel",
      partnerName: "Samuel",
      line: "You and Samuel both know the feeling of cycling around Mojiko.",
      anchors: [
        { label: "cycling", category: "activity", nodeId: "demo:cycling" },
        { label: "Mojiko", category: "place", nodeId: "demo:mojiko" },
      ],
      demo: true,
    },
    {
      connectionId: "demo:daniel",
      partnerName: "Daniel",
      line: "You and Daniel both treat ramen in Hakata as the end of a night, never the start.",
      anchors: [
        { label: "ramen", category: "interest", nodeId: "demo:ramen" },
        { label: "Hakata", category: "place", nodeId: "demo:hakata" },
      ],
      demo: true,
    },
    {
      connectionId: "demo:aron",
      partnerName: "Aron",
      line: "You and Aron both know the patience film photography asks for.",
      anchors: [
        {
          label: "film photography",
          category: "interest",
          nodeId: "demo:film",
        },
      ],
      demo: true,
    },
    {
      connectionId: "demo:mina",
      partnerName: "Mina",
      line: "You and Mina both go quiet in the same way on a long train ride.",
      anchors: [
        { label: "train ride", category: "activity", nodeId: "demo:train" },
      ],
      demo: true,
    },
  ];
}
