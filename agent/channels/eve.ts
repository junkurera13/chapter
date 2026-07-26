import { eveChannel } from "eve/channels/eve";
import {
  type AuthFn,
  localDev,
  vercelOidc,
  verifyHttpBasic,
  withAuthChallenges,
} from "eve/channels/auth";

function sidequestInternalAuth(): AuthFn<Request> {
  return withAuthChallenges(
    (request) => {
      const secret = process.env.SIDEQUEST_INTERNAL_SECRET;
      if (!secret) return null;
      const verified = verifyHttpBasic(
        request.headers.get("authorization"),
        { username: "sidequest", password: secret },
      );
      if (!verified.ok) return null;

      const authUserId =
        request.headers.get("x-sidequest-auth-user-id")?.trim() || "";
      const phone = request.headers.get("x-sidequest-phone")?.trim() || "";
      const channel =
        request.headers.get("x-sidequest-channel")?.trim() || "internal";
      return {
        authenticator: "sidequest-internal",
        principalType: "user",
        principalId: authUserId || phone || "sidequest-internal",
        attributes: { authUserId, phone, channel },
      };
    },
    [{ scheme: "Basic", parameters: { realm: "sidequest" } }],
  );
}

export default eveChannel({
  auth: [sidequestInternalAuth(), vercelOidc(), localDev()],
});
