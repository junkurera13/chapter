import { getBase44BrowserClient } from "./base44BrowserClient";
import type { ExperienceGraphRecord } from "./backendTypes";

type MyGraphResponse = {
  value: ExperienceGraphRecord;
};

export async function loadMyExperienceGraph() {
  const client = getBase44BrowserClient();
  const response = await client.functions.invoke("sidequest-data", {
    action: "getMyGraph",
  });

  return (response.data as MyGraphResponse).value;
}
