import { TNotification, TMessage, ProtocolError } from "../protocol";
import { Id } from "@codesandbox/pitcher-common";

export type NotificationType = "info" | "warning" | "error";
export type Action = {
  label: string;
};

/**
 * Is sent from Pitcher to the client, to ask the client to show a notification.
 * There's an ID given, this is important, because the client is responsible for
 * using this to send a response back to the notification (either dismiss or one of
 * the actions are clicked, in case there are actions).
 */
export type NotificationNotify = TNotification<
  "notification/notify",
  {
    type: NotificationType;
    notificationId: Id;
    message: string;
    actions?: Action[];
  }
>;

/**
 * Is sent from Pitcher to the client, to dismiss the notification.
 */
export type NotificationDismiss = TNotification<
  "notification/dismiss",
  {
    notificationId: Id;
  }
>;

export type NotificationAckResponse = TMessage<
  "notification/notifyResponse",
  {
    notificationId: Id;
    response: string | null;
  },
  {
    result: void;
    error: ProtocolError;
  }
>;

export type NotificationNotification = NotificationNotify | NotificationDismiss;
export type NotificationMessage = NotificationAckResponse;
export type NotificationRequest = NotificationMessage["request"];
export type NotificationResponse = NotificationMessage["response"];
