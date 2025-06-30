import { ProtocolError, TMessage, TNotification } from "../protocol";

export type CommonError = ProtocolError;

export interface ILanguageConfig {
  id: string;
  /** @deprecated in favor of globs, everything listed in extensions is listed in glob form as well */
  extensions: string[];
  /** something/*.json, *.js, *.ts */
  globs: string[];
  hasLanguageServer: boolean;
  languageServerIds: string[];
}

// List available languages
export type ListLanguagesMessage = TMessage<
  "language/list",
  Record<string, never>,
  {
    result: {
      languages: ILanguageConfig[];
    };
    error: CommonError;
  }
>;

export interface LSPResponseError {
  /**
   * A number indicating the error type that occurred.
   */
  code: number;

  /**
   * A string providing a short description of the error.
   */
  message: string;

  /**
   * A primitive or structured value that contains additional
   * information about the error. Can be omitted.
   */
  data?: unknown;
}

// Send an LSP Request
export type LSPRequestMessage = TMessage<
  "language/lspRequest",
  {
    languageId: string;
    serverId: string;
    message: {
      method: string;
      // Params can be anything as lsp isn't really an exhaustive spec...
      params?: unknown;
    };
  },
  {
    // Result can be anything as lsp isn't really an exhaustive spec...
    result: unknown;
    error: CommonError | LSPResponseError;
  }
>;

export type LanguageLspNotification = TNotification<
  "language/lspNotification",
  {
    languageId: string;
    serverId: string;
    message: {
      method: string;
      // Params can be anything as lsp isn't really an exhaustive spec...
      params?: unknown;
    };
  }
>;

/**
 * Used for requests from the server to the client
 */
export type LanguageLspServerRequest = TNotification<
  "language/lspServerRequest",
  {
    languageId: string;
    serverId: string;
    message: {
      id: number | string;
      method: string;
      // Params can be anything as lsp isn't really an exhaustive spec...
      params?: unknown;
    };
  }
>;

/**
 * Used for responses from the client to the server on a request
 */
export type LanguageLspServerResponse = TMessage<
  "language/lspServerResponse",
  {
    languageId: string;
    serverId: string;
    message: {
      id: number | string;
      result?: string | number | boolean | Record<string, unknown> | null;
      error?: CommonError | LSPResponseError;
    };
  },
  {
    result: unknown;
    error: CommonError | LSPResponseError;
  }
>;

export type LanguageMessage =
  | ListLanguagesMessage
  | LSPRequestMessage
  | LanguageLspServerResponse;

export type LanguageRequest = LanguageMessage["request"];

export type LanguageResponse = LanguageMessage["response"];

export type LanguageNotification =
  | LanguageLspNotification
  | LanguageLspServerRequest;
