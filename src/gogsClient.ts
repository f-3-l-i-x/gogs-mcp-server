import { logError } from "./logger.js";

const GOGS_URL = (process.env.GOGS_URL ?? "").replace(/\/+$/, "");
const GOGS_TOKEN = process.env.GOGS_TOKEN;

if (!GOGS_URL) {
  logError("[gogs-mcp] Warning: GOGS_URL is not set. Gogs API calls will fail.");
}

if (!GOGS_TOKEN) {
  logError("[gogs-mcp] Warning: GOGS_TOKEN is not set. Gogs API calls will fail authentication.");
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
  return {};
}

export async function gogsRequest<T = unknown>(
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE",
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
