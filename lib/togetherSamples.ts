import "server-only";

import type { TogetherGist } from "./togetherGistSchema";

/**
 * Accounts that get sample gists alongside whatever is real. The tab is the
 * hardest thing in Chapter to demo — it needs two graphs that overlap — so one
 * account is allowed to see the shape of it before the pool exists.
 *
 * The allowlist is server-only. The browser learns only whether the API
 * returned samples; it never receives the email addresses that enable them.
 */
export function demoAccounts(): string[] {
  return (process.env.CHAPTER_DEMO_ACCOUNTS ?? "")
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
 *
 * Written in the voice of the cards at the top of the landing page, which is
 * the voice a gist has to earn: name the specific thing, not the feeling about
 * it. "Both know the patience film photography asks for" is a sentence about
 * nobody. "You each have rolls sitting undeveloped since spring" is two people.
 * The detail is what makes a stranger recognisable, so every line carries one
 * a person could only have if the thing actually happened — a time of day, a
 * route, a season — and stops before explaining what it means.
 */
export function demoGists(): TogetherGist[] {
  return [
    {
      connectionId: "demo:samuel",
      partnerName: "Samuel",
      line: "Samuel goes cycling around Mojiko the long way you do — the waterfront, after the ferries stop. He has ridden it alone every weekend since March.",
      anchors: [
        { label: "cycling", category: "activity", nodeId: "demo:cycling" },
        { label: "Mojiko", category: "place", nodeId: "demo:mojiko" },
      ],
      demo: true,
    },
    {
      connectionId: "demo:daniel",
      partnerName: "Daniel",
      line: "You and Daniel both order naengmyeon in Ojangdong in the middle of winter. Neither of you has ever explained why.",
      anchors: [
        {
          label: "naengmyeon",
          category: "interest",
          nodeId: "demo:naengmyeon",
        },
        { label: "Ojangdong", category: "place", nodeId: "demo:ojangdong" },
      ],
      demo: true,
    },
    {
      connectionId: "demo:aron",
      partnerName: "Aron",
      line: "Aron picked up film photography the same winter you did. You have both photographed the same stretch of Yeonnam, a year apart.",
      anchors: [
        {
          label: "film photography",
          category: "interest",
          nodeId: "demo:film",
        },
        { label: "Yeonnam", category: "place", nodeId: "demo:yeonnam" },
      ],
      demo: true,
    },
    {
      connectionId: "demo:mina",
      partnerName: "Mina",
      line: "Mina takes the slow line to Nagasaki rather than the shinkansen. You were both on that train ride the same Friday in May.",
      anchors: [
        { label: "train ride", category: "activity", nodeId: "demo:train" },
        { label: "Nagasaki", category: "place", nodeId: "demo:nagasaki" },
      ],
      demo: true,
    },
  ];
}
