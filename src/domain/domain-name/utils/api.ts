import env from "../../../env.js";

export function getHeaders(): Record<string, string> {
  const headers: Record<string, string> = {};

  headers["example"] = env.API.headers.Example;

  return headers;
}