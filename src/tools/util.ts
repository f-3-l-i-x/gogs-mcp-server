import { GogsApiError } from "../gogsClient.js";

const EMPTY_REPO_HINT =
  "Hint: repositories with zero commits (e.g. created with auto_init: false) often cause " +
  "this generic error on Gogs' contents/branches endpoints - Gogs cannot create the first " +
  "commit or list branches via this API on such a repository. Initialize it with a README " +
  "(auto_init: true) or push an initial commit via git first.";

export async function withEmptyRepoHint<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    if (err instanceof GogsApiError && err.status === 500) {
      throw new Error(`${err.message}\n\n${EMPTY_REPO_HINT}`);
    }
    throw err;
  }
}

export function textResult(data: unknown) {
  return {
    content: [
      {
        type: "text" as const,
        text: typeof data === "string" ? data : JSON.stringify(data, null, 2),
      },
    ],
  };
}

export function errorResult(err: unknown) {
  const message = err instanceof Error ? err.message : String(err);
  return {
    content: [{ type: "text" as const, text: message }],
    isError: true,
  };
}

export function safe<Args extends unknown[]>(
  fn: (...args: Args) => Promise<ReturnType<typeof textResult>>
) {
  return async (...args: Args) => {
    try {
      return await fn(...args);
    } catch (err) {
      return errorResult(err);
    }
  };
}
