import type { Id, IPitcherClient } from "@codesandbox/pitcher-client";
import { listenOnce } from "@codesandbox/pitcher-common/dist/event";

import { Disposable } from "../../utils/disposable";
import { Emitter } from "../../utils/event";

export class Git extends Disposable {
  constructor(private pitcherClient: IPitcherClient) {
    super();
  }
  pull() {
    return this.pitcherClient.clients.git.pull();
  }
}
