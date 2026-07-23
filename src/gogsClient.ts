const GOGS_URL = (process.env.GOGS_URL ?? "").replace(/\/+$/, "");
const GOGS_TOKEN = process.env.GOGS_TOKEN;
const GOGS_USERNAME = process.env.GOGS_USERNAME;
const GOGS_PASSWORD = process.env.GOGS_PASSWORD;

if (!GOGS_URL) {
  console.error("[gogs-mcp] Warning: GOGS_URL is not set. Gogs API calls will fail.");
}

if (!GOGS_TOKEN && !(GOGS_USERNAME && GOGS_PASSWORD)) {
  console.error(
    "[gogs-mcp] Warning: neither GOGS_TOKEN nor GOGS_USERNAME/GOGS_PASSWORD are set. " +
      "Gogs API calls will fail authentication."
  );
}

export class GogsApiError extends Error {
  constructor(
    public status: number,
    public body: unknown
  ) {
    super(`Gogs API error ${status}: ${JSON.stringify(body)}`);
  }
}

function authHeaders(): Record<string, string> {
  if (GOGS_TOKEN) {
    return { Authorization: `token ${GOGS_TOKEN}` };
  }
  if (GOGS_USERNAME && GOGS_PASSWORD) {
    const basic = Buffer.from(`${GOGS_USERNAME}:${GOGS_PASSWORD}`).toString("base64");
    return { Authorization: `Basic ${basic}` };
  }
  return {};
}

export async function gogsRequest<T = unknown>(
  method: "GET" | "POST" | "PATCH" | "DELETE",
  path: string,
  body?: unknown
): Promise<T> {
  const url = `${GOGS_URL}/api/v1${path}`;
  const res = await fetch(url, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  const text = await res.text();
  const data = text ? safeJsonParse(text) : undefined;

  if (!res.ok) {
    throw new GogsApiError(res.status, data ?? text);
  }
  return data as T;
}

function safeJsonParse(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}
