import { SessionData } from "../sessions";

export function getSessionUrl(session: SessionData) {
  const url = new URL(session.pitcher_url);

  url.protocol = "https";
  url.pathname = `/${session.id}`;
  url.search = `token=${session.pitcher_token}`;

  return url.toString();
}
