import type { Id } from "@codesandbox/pitcher-common";

import { ProtocolError, TMessage, TNotification } from "../protocol";
import { PitcherErrorCode } from "../errors";

export type CommonError =
  | ProtocolError
  | {
      code: PitcherErrorCode.AI_NOT_AVAILABLE;
      message: string;
    };

export type SuggestCommitMessage = TMessage<
  "ai/suggestCommit",
  {
    /**
     * Ability to pass a model for a/b testing
     * will be removed in the future
     **/
    model?: "gpt-3.5-turbo" | "gpt-4";
    files: string[];
    temperature?: number;
  },
  {
    result: {
      commit: string;
    };
    error: CommonError;
  }
>;

export type RawMessage = TMessage<
  "ai/raw",
  {
    /**
     * Ability to pass a model for a/b testing
     * will be removed in the future
     **/
    model?: "gpt-3.5-turbo" | "gpt-4" | "gpt-4-1106-preview";
    messages: Array<{
      role: "system" | "user" | "assistant";
      content: string;
    }>;
    /**
     * The maximum number of tokens allowed for the generated answer. By default, the number of tokens the model can return will be (4096 - prompt tokens).
     */
    max_tokens?: number;
    /**
     * What sampling temperature to use, between 0 and 2. Higher values like 0.8 will make the output more random, while lower values like 0.2 will make it more focused and deterministic.  We generally recommend altering this or `top_p` but not both.
     */
    temperature?: number;
    /**
     * An alternative to sampling with temperature, called nucleus sampling, where the model considers the results of the tokens with top_p probability mass. So 0.1 means only the tokens comprising the top 10% probability mass are considered.  We generally recommend altering this or `temperature` but not both.
     */
    top_p?: number;
    /**
     * Number between -2.0 and 2.0. Positive values penalize new tokens based on whether they appear in the text so far, increasing the model\'s likelihood to talk about new topics.  [See more information about frequency and presence penalties.](/docs/api-reference/parameter-details)
     */
    presence_penalty?: number;
    /**
     * Number between -2.0 and 2.0. Positive values penalize new tokens based on their existing frequency in the text so far, decreasing the model\'s likelihood to repeat the same line verbatim.  [See more information about frequency and presence penalties.](/docs/api-reference/parameter-details)
     */
    frequency_penalty?: number;
    /**
     * a token to force the completion to end.
     */
    stop?: string | string[];
  },
  {
    result: {
      reply: string;
    };
    error: CommonError;
  }
>;

export type StreamMessage = TMessage<
  "ai/stream",
  {
    /**
     * Ability to pass a model for a/b testing
     * will be removed in the future
     **/
    model?: "gpt-3.5-turbo" | "gpt-4";
    messages: Array<{
      role: "system" | "user" | "assistant";
      content: string;
    }>;
    /**
     * The maximum number of tokens allowed for the generated answer. By default, the number of tokens the model can return will be (4096 - prompt tokens).
     */
    max_tokens?: number;
    /**
     * What sampling temperature to use, between 0 and 2. Higher values like 0.8 will make the output more random, while lower values like 0.2 will make it more focused and deterministic.  We generally recommend altering this or `top_p` but not both.
     */
    temperature?: number;
    /**
     * An alternative to sampling with temperature, called nucleus sampling, where the model considers the results of the tokens with top_p probability mass. So 0.1 means only the tokens comprising the top 10% probability mass are considered.  We generally recommend altering this or `temperature` but not both.
     */
    top_p?: number;
    /**
     * Number between -2.0 and 2.0. Positive values penalize new tokens based on whether they appear in the text so far, increasing the model\'s likelihood to talk about new topics.  [See more information about frequency and presence penalties.](/docs/api-reference/parameter-details)
     */
    presence_penalty?: number;
    /**
     * Number between -2.0 and 2.0. Positive values penalize new tokens based on their existing frequency in the text so far, decreasing the model\'s likelihood to repeat the same line verbatim.  [See more information about frequency and presence penalties.](/docs/api-reference/parameter-details)
     */
    frequency_penalty?: number;
    /**
     * a token to force the completion to end.
     */
    stop?: string | string[];
  },
  {
    result: {
      messageId: Id;
    };
    error: CommonError;
  }
>;

export type IChatContextFragment =
  | {
      type: "text" | "logs";
      content: string;
    }
  | {
      type: "code";
      content: string;
      filepath: string;
      startLine: number;
      endLine: number;
    };

export type AIChatMessageMessage = TMessage<
  "ai/chatMessage",
  {
    chatId: Id;
    message: string;
    messageId: Id;
    context: IChatContextFragment[];
  },
  {
    result: {
      chatId: Id;
      title: string;
    };
    error: CommonError;
  }
>;

export type AIChatCreatedNotification = TNotification<
  "ai/chatCreated",
  {
    chatId: Id;
    title: string;
    entries: IChatHistoryEntry[];
  }
>;

export type AIChatMessageNotification = TNotification<
  "ai/chatMessage",
  {
    chatId: Id;
    /**
     * idx, indicating the order of the messages, ensures we can resync if a message goes missing
     **/
    idx: number;
    /**
     * User is manual input by a user
     * System is intermediate messages, status, errors
     * Assistant is the AI responding
     **/
    role: "user" | "system" | "assistant";
    username?: string;
    /**
     * messageId is a unique identifier for the message used to listen for streaming progress
     */
    messageId: Id;
    message: string;
    context: IChatContextFragment[];
    isFinished: boolean;
  }
>;

export type AIMessageProgressNotification = TNotification<
  "ai/messageProgress",
  {
    messageId: Id;
    chunk: string;
    isFinished: boolean;
  }
>;

export interface IChatHistoryEntry {
  /**
   * idx, indicating the order of the messages, ensures we can resync if a message goes missing
   **/
  idx: number;
  /**
   * User is manual input by a user
   * System is intermediate messages, status, errors
   * Assistant is the AI responding
   **/
  role: "user" | "system" | "assistant";
  username?: string;
  /**
   * messageId is a unique identifier for the message used to listen for streaming progress
   */
  messageId: Id;
  message: string;
  context: IChatContextFragment[];
  isFinished: boolean;
}

export type AIChatsMessage = TMessage<
  "ai/chats",
  Record<never, never>,
  {
    result: {
      chats: Array<{
        chatId: Id;
        title: string;
      }>;
    };
    error: CommonError;
  }
>;

export type AiChatHistoryMessage = TMessage<
  "ai/chatHistory",
  {
    chatId: Id;
  },
  {
    result: {
      entries: IChatHistoryEntry[];
    };
    error: CommonError;
  }
>;

export type AiMessageStateMessage = TMessage<
  "ai/messageState",
  {
    messageId: Id;
  },
  {
    result: {
      content: string;
      isFinished: boolean;
    };
    error: CommonError;
  }
>;

export interface IEmbeddingRecord {
  filepath: string;
  filetype: "code" | "manifest" | "doc";
  content: string;
  startLine: number;
  endLine: number;
  /** cosine distance between vector and question */
  distance: number;
}

export type AIEmbeddingsMessage = TMessage<
  "ai/embeddings",
  {
    query: string;
  },
  {
    result: {
      matches: IEmbeddingRecord[];
    };
    error: CommonError;
  }
>;

export type AiMessage =
  | SuggestCommitMessage
  | RawMessage
  | StreamMessage
  | AIChatMessageMessage
  | AIChatsMessage
  | AiChatHistoryMessage
  | AIEmbeddingsMessage
  | AiMessageStateMessage;

export type AiRequest = AiMessage["request"];

export type AiResponse = AiMessage["response"];

export type AiNotification =
  | AIChatCreatedNotification
  | AIChatMessageNotification
  | AIMessageProgressNotification;
