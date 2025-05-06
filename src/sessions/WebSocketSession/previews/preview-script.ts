import type {
  BaseMessageToPreview,
  BaseMessageFromPreview,
  InjectFunction,
  PreviewProtocolType,
} from "./types";

/**
 * Be very, very careful when editing this function.
 * Before it is called, this function is stringified, then evaled inside the Preview iFrame.
 * Referencing ANY variables outside of this function will not work.
 */
export const injectAndInvokeInsidePreview: InjectFunction<
  BaseMessageToPreview,
  BaseMessageFromPreview
> = ({ previewWindow, previewProtocol }) => {
  // #region history logic

  // @ts-expect-error please ignore __proto__ :)
  const origHistoryProto = window.history.__proto__; // eslint-disable-line no-proto
  const historyList: Array<{ url: string; state: unknown }> = [];
  let historyPosition = -1;
  let disableNextHashChange = false;

  function pushHistory(url: string, state: unknown) {
    // remove "future" locations
    historyList.splice(historyPosition + 1);
    historyList.push({ url, state });
    historyPosition = historyList.length - 1;
  }

  function pathWithHash(location: Location) {
    return `${location.pathname}${location.hash}`;
  }

  function setupHistoryListeners(
    previewProtocol: PreviewProtocolType<
      BaseMessageToPreview,
      BaseMessageFromPreview
    >
  ) {
    const existingState = window.history.state;

    Object.assign(window.history, {
      go(delta: number) {
        const newPos = historyPosition + delta;
        if (newPos >= 0 && newPos <= historyList.length - 1) {
          historyPosition = newPos;
          const { url, state } = historyList[historyPosition]!;
          const oldURL = document.location.href;
          origHistoryProto.replaceState.call(window.history, state, "", url);
          const newURL = document.location.href;
          window.dispatchEvent(new PopStateEvent("popstate", { state }));
          if (newURL.indexOf("#") !== -1) {
            disableNextHashChange = true;
            window.dispatchEvent(
              new HashChangeEvent("hashchange", { oldURL, newURL })
            );
          }
        }
      },

      back() {
        window.history.go(-1);
      },

      forward() {
        window.history.go(1);
      },

      pushState(state: unknown, title: string, url: string) {
        origHistoryProto.replaceState.call(window.history, state, title, url);
        pushHistory(url, state);
      },

      replaceState(state: unknown, title: string, url: string) {
        origHistoryProto.replaceState.call(window.history, state, title, url);
        historyList[historyPosition] = { state, url };
      },
    });

    Object.defineProperties(window.history, {
      length: {
        get() {
          return historyList.length;
        },
      },

      state: {
        get() {
          return historyList[historyPosition]!.state;
        },
      },
    });

    window.addEventListener("hashchange", () => {
      if (!disableNextHashChange) {
        const url = pathWithHash(document.location);
        pushHistory(url, null);
      } else {
        disableNextHashChange = false;
      }
    });

    pushHistory(pathWithHash(document.location), existingState);
  }

  setupHistoryListeners(previewProtocol);
  let lastSentUrl: string | undefined = undefined;

  /**
   * Send the URL to the parent frame whenever it changes.
   * This approach might create a bit of a performance overhead with multiple previews.
   * Prior art rewrote the history object, but didn't handle cases like client-side routing.
   * */
  const syncHref = () => {
    if (!lastSentUrl || previewWindow.location.href !== lastSentUrl) {
      const url = previewWindow.location.href;
      lastSentUrl = url;
      previewProtocol.sendMessage({
        type: "SET_URL",
        url,
        back: historyPosition > 0,
        forward: historyPosition < historyList.length - 1,
      });
    }
    previewWindow.requestAnimationFrame(syncHref);
  };
  previewWindow.requestAnimationFrame(syncHref);
  previewProtocol.addListener("GO_BACK", () => {
    previewWindow.history.back();
  });
  previewProtocol.addListener("GO_FORWARD", () => {
    previewWindow.history.forward();
  });

  // #endregion history logic

  window.onbeforeunload = function () {
    previewProtocol.sendMessage({
      type: "RELOAD",
    });
  };

  previewProtocol.addListener("REFRESH", () => {
    previewWindow.location.reload();
  });
};
