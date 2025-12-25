const API_KEY_HEADER = "x-api-key";

export function validateApiKey(req: Request): Response | null {
  const apiAuthKey = process.env.API_AUTH_KEY;

  // If no API key is configured, skip validation
  if (!apiAuthKey) {
    return null;
  }

  const providedKey = req.headers.get(API_KEY_HEADER);

  if (!providedKey) {
    return Response.json(
      { error: "Missing API key. Please provide x-api-key header." },
      { status: 401 }
    );
  }

  if (providedKey !== apiAuthKey) {
    return Response.json(
      { error: "Invalid API key." },
      { status: 401 }
    );
  }

  return null;
}
