type PhotonUserResponse = {
  succeed?: boolean;
  data?: {
    assignedPhoneNumber?: string;
  } | null;
  code?: string;
  message?: string;
  error?: {
    message?: string;
  };
};

type CreateSharedPhotonUserOptions = {
  projectId: string;
  projectSecret: string;
  phoneNumber: string;
  fetchImpl?: typeof fetch;
  sleep?: (ms: number) => Promise<void>;
};

const RETRY_DELAYS_MS = [500, 1200];

export class PhotonSignupError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code: string | undefined,
    readonly body: PhotonUserResponse,
  ) {
    super(message);
    this.name = "PhotonSignupError";
  }
}

function defaultSleep(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

function photonMessage(body: PhotonUserResponse) {
  return body.error?.message ?? body.message;
}

function isRateLimited(status: number, body: PhotonUserResponse) {
  return status === 429 || body.code === "RATE_LIMITED";
}

export async function createSharedPhotonUser({
  projectId,
  projectSecret,
  phoneNumber,
  fetchImpl = fetch,
  sleep = defaultSleep,
}: CreateSharedPhotonUserOptions) {
  const auth = Buffer.from(`${projectId}:${projectSecret}`).toString("base64");
  const url = `https://spectrum.photon.codes/projects/${projectId}/users/`;

  for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt += 1) {
    const res = await fetchImpl(url, {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        type: "shared",
        phoneNumber,
      }),
    });

    const body = (await res.json().catch(() => ({}))) as PhotonUserResponse;

    if (res.ok) {
      const assigned = body.data?.assignedPhoneNumber;
      if (!assigned) {
        throw new PhotonSignupError(
          "messaging service returned an unexpected response.",
          res.status,
          body.code,
          body,
        );
      }

      return assigned;
    }

    if (isRateLimited(res.status, body) && attempt < RETRY_DELAYS_MS.length) {
      await sleep(RETRY_DELAYS_MS[attempt]);
      continue;
    }

    throw new PhotonSignupError(
      photonMessage(body) ?? "messaging service signup failed.",
      res.status,
      body.code,
      body,
    );
  }

  throw new Error("unreachable photon signup retry state");
}
