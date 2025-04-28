import { SandboxSessionData } from "../sessions";

export function getSessionUrl(session: SandboxSessionData) {
  const url = new URL(session.pitcher_url);

  url.protocol = "https";
  url.pathname = `/${session.id}`;
  url.search = `token=${session.pitcher_token}`;

  return url.toString();
}
