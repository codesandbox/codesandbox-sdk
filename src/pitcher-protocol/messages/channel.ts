import { ProtocolError, TMessage, TNotification } from "../protocol";
import { PitcherErrorCode } from "..";

export type CommonError =
  | {
      code: PitcherErrorCode.CHANNEL_NOT_FOUND;
      message: string;
    }
  | ProtocolError;

export interface ChannelSubscribeParams {
  name: string;
}

export interface ChannelSubscribeResult {
  subscribers: string[];
}

export type ChannelJoinMessage = TMessage<
  "channel/subscribe",
  ChannelSubscribeParams,
  {
    result: ChannelSubscribeResult;
    error: CommonError;
  }
>;

export interface ChannelUnsubscribeParams {
  name: string;
}

export type ChannelUnsubscribeMessage = TMessage<
  "channel/unsubscribe",
  ChannelUnsubscribeParams,
  {
    result: Record<never, never>;
    error: CommonError;
  }
>;

export type ChannelMessageMessage = TMessage<
  "channel/message",
  {
    name: string;
    /** optional clients, can be undefined for a broadcast */
    clients?: string[];
    data: Record<string, any>;
  },
  {
    result: {
      clients: string[];
    };
    error: CommonError;
  }
>;

export type ChannelMessage =
  | ChannelJoinMessage
  | ChannelUnsubscribeMessage
  | ChannelMessageMessage;

export type ChannelRequest = ChannelMessage["request"];

export type ChannelResponse = ChannelMessage["response"];

export type ChannelSubscribedNotification = TNotification<
  "channel/subscribed",
  {
    name: string;
    clientId: string;
    subscribers: string[];
  }
>;

export type ChannelUnsubscribedNotification = TNotification<
  "channel/unsubscribed",
  {
    name: string;
    clientId: string;
    subscribers: string[];
  }
>;

export type ChannelMessageNotification = TNotification<
  "channel/message",
  {
    name: string;
    /** client that sent the message */
    clientId: string;
    /** If the clientId has same username, meaning it is one of your other clients */
    isUser: boolean;
    data: Record<string, any>;
  }
>;

export type ChannelNotification =
  | ChannelSubscribedNotification
  | ChannelUnsubscribedNotification
  | ChannelMessageNotification;
