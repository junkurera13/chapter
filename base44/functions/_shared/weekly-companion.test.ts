import { describe, expect, it } from "vitest";

import {
  weeklyCompanyForConnection,
  weeklyCompanionFamiliarity,
  weeklyCardsHaveConcretePeopleAndPlaces,
} from "../../shared/weekly-companion";

describe("weekly social company", () => {
  it("keeps an introduction new until the pair actually meets", () => {
    const company = weeklyCompanyForConnection({
      origin: "introduction",
      status: "accepted",
    });

    expect(company).toBe("new-person");
    expect(weeklyCompanionFamiliarity(company)).toBe("new");
  });

  it("turns the same pair familiar after a lived meeting", () => {
    const company = weeklyCompanyForConnection({
      origin: "introduction",
      status: "accepted",
      met_at: 1_800_000_000_000,
    });

    expect(company).toBe("known-person");
    expect(weeklyCompanionFamiliarity(company)).toBe("known");
  });

  it("treats a named invite as an already-known person", () => {
    expect(
      weeklyCompanyForConnection({
        origin: "invite",
        status: "accepted",
      }),
    ).toBe("known-person");
  });
});

describe("weekly public card boundary", () => {
  const solo = (id: string) => ({
    id,
    company: "self",
    title: "A real experience",
    place: {
      name: "A real place",
      area: "A real area",
      address: "1 Real Street",
    },
  });
  const social = {
    id: "mini",
    company: "new-person",
    title: "Make one bowl with Mina",
    line: "Make one bowl with Mina at Ceradu Ceramics Studio.",
    place: {
      name: "Ceradu Ceramics Studio",
      area: "Yeoksam-dong",
      address: "332 Nonhyeon-ro, Gangnam-gu, Seoul",
    },
    companion: {
      connectionId: "connection-mina",
      userId: "user-mina",
      name: "Mina",
      familiarity: "new",
    },
  };

  it("accepts three concrete cards with the real social person attached", () => {
    expect(
      weeklyCardsHaveConcretePeopleAndPlaces([
        solo("small"),
        social,
        solo("proper"),
      ]),
    ).toBe(true);
  });

  it("rejects an unnamed person or placeholder place", () => {
    expect(
      weeklyCardsHaveConcretePeopleAndPlaces([
        solo("small"),
        {
          ...social,
          line: "Make one bowl beside someone new.",
          companion: undefined,
          place: {
            name: "A researched studio",
            area: "",
            address: "Supplied later",
          },
        },
        solo("proper"),
      ]),
    ).toBe(false);
  });
});
