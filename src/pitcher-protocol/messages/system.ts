import { ProtocolError, TMessage, TNotification } from "../protocol";
export type SystemError = ProtocolError;

export interface SystemMetricsStatus {
  cpu: {
    cores: number;
    used: number;
    configured: number;
  };
  memory: {
    used: number;
    total: number;
    configured: number;
  };
  storage: {
    used: number;
    total: number;
    configured: number;
  };
}

export interface InitStatus {
  message: string;
  isError?: boolean;
  // 0 - 100
  progress: number;
  // 0 - 100
  nextProgress: number;
  stdout?: string;
}

export type SystemUpdate = TMessage<
  "system/update",
  Record<string, undefined>,
  {
    result: Record<string, undefined>;
    error: SystemError;
  }
>;

export type SystemHibernate = TMessage<
  "system/hibernate",
  Record<string, undefined>,
  { result: null; error: SystemError }
>;

export type SystemMetrics = TMessage<
  "system/metrics",
  Record<string, undefined>,
  {
    result: SystemMetricsStatus;
    error: SystemError;
  }
>;

export type SystemMessage = SystemUpdate | SystemHibernate | SystemMetrics;

export type SystemRequest = SystemMessage["request"];

export type SystemResponse = SystemMessage["response"];

export type HibernationNotification = TNotification<
  "system/hibernate",
  Record<string, unknown>
>;

export type SystemMetricsNotification = TNotification<
  "system/metrics",
  SystemMetricsStatus
>;

/**
 * Allows clients to listen to the status of pitcher when it is Initializing
 * git clone, creating folders, setting up node, ...
 */
export type InitStatusNotification = TNotification<
  "system/initStatus",
  InitStatus
>;

export type SystemNotification =
  | HibernationNotification
  | SystemMetricsNotification
  | InitStatusNotification;
