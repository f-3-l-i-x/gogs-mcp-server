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
