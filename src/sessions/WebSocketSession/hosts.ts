import { IPitcherClient } from "@codesandbox/pitcher-client";
import { HostToken } from "../../Hosts";

export class Hosts {
  constructor(
    private pitcherClient: IPitcherClient,
    private hostToken?: HostToken
  ) {}
  /**
   * If private Sandbox this will return a URL with a host token.
   */
  getUrl(port: number, protocol: string = "https") {
    return `${protocol}://${this.pitcherClient.instanceId}-${port}.csb.app${
      this.hostToken ? `?preview_token=${this.hostToken.token}` : ""
    }`;
  }

  /**
   * If private Sandbox this will return headers with a host token.
   */
  getHeaders() {
    if (!this.hostToken) {
      return {};
    }

    return {
      "csb-preview-token": this.hostToken.token,
    };
  }

  /**
   * If private Sandbox this will return cookies with a host token.
   */
  getCookies() {
    if (!this.hostToken) {
      return {};
    }

    return {
      csb_preview_token: this.hostToken.token,
    };
  }
}
