import {
  completeMemory,
  prepareMemory,
} from "../../lib/sidequestAgentBackend";

export function callerIdentity(attributes: Readonly<
  Record<string, string | readonly string[]>
>) {
  const value = (key: string) => {
    const item = attributes[key];
    return typeof item === "string" ? item.trim() : "";
  };
  const authUserId = value("authUserId");
  const phone = value("phone");
  if (!authUserId && !phone) {
    throw new Error("This Eve session is not linked to a Chapter user.");
  }
  return { authUserId, phone };
}

export { completeMemory, prepareMemory };
