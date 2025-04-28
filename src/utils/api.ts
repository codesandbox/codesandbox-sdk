import { RateLimitError } from "./rate-limit";

export type HandledResponse<D, E> = {
  data?: {
    data?: D;
  };
  error?: E;
  response: Response;
};

export function getBaseUrl(token: string) {
  if (token.startsWith("csb_")) {
    return "https://api.codesandbox.io";
  }

  return "https://api.together.ai/csb/sdk";
}

export function handleResponse<D, E>(
  result: Awaited<{ data?: { data?: D }; error?: E; response: Response }>,
  errorPrefix: string
): D {
  if (result.response.status === 429 && "error" in result) {
    const error = (result.error as { errors: string[] }).errors[0];
    throw RateLimitError.fromResponse(result.response, errorPrefix, error);
  }

  if (result.response.status === 404) {
    throw new Error(errorPrefix + ": Sandbox not found");
  }

  if (result.response.status === 403) {
    throw new Error(errorPrefix + ": Unauthorized");
  }

  if (result.response.status === 502) {
    throw new Error(errorPrefix + ": Bad gateway");
  }

  if ("error" in result) {
    const error = (result.error as { errors: string[] }).errors[0];
    throw new Error(errorPrefix + ": " + error);
  }

  if (!result.data || !result.data.data) {
    throw new Error(errorPrefix + ": No data returned");
  }

  return result.data.data;
}
