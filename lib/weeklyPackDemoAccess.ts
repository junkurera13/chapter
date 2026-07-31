/**
 * The accounts that open Now on a demo pack instead of their own.
 *
 * A real pack is sealed until nine on Saturday morning, which is the right
 * behaviour and the wrong one to film on a Wednesday. These accounts get three
 * sealed sample cards any day of the week. Everything past that first tap is
 * the real interface: the flip, the choice, the day, and the twenty-one day
 * life are all genuine. Only the three cards are samples.
 *
 * This is a demo affordance, not a privacy boundary. It reveals nothing but
 * fixture content, so a hardcoded list is enough and no private pack is ever
 * read for these accounts while it is on.
 */
const DEMO_WEEKLY_PACK_ACCOUNTS = ["parkjundk@gmail.com"];

export function showsDemoWeeklyPack(email: string | undefined) {
  const account = email?.trim().toLowerCase();
  return Boolean(account && DEMO_WEEKLY_PACK_ACCOUNTS.includes(account));
}
