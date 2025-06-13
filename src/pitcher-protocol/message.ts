import {
  encode as msgpackEncode,
  decode as msgpackDecode,
} from "@msgpack/msgpack";
import { PitcherResponseStatus } from "./index";

export interface PitcherRequestPayload {
  id: number;
  method: string;
  params: unknown;
}

export interface PitcherNotificationPayload {
  method: string;
  params: unknown;
}

export interface PitcherResponsePayload {
  id: number;
  method: string;
  status: PitcherResponseStatus.RESOLVED;
  result: unknown;
}

export interface PitcherErrorPayload {
  id: number;
  status: PitcherResponseStatus.REJECTED;
  error: {
    code: number;
    data?: unknown;
    message: string;
  };
}

export function encodeMessage(message: any): Uint8Array {
  return msgpackEncode(message);
}

export function decodeMessage(blob: Uint8Array): any {
  return msgpackDecode(blob);
}

export function isNotificationPayload(
  payload: any,
): payload is PitcherNotificationPayload {
  return !("id" in payload) && "params" in payload;
}

export function isErrorPayload(payload: any): payload is PitcherErrorPayload {
  return "error" in payload;
}

export function isResultPayload(
  payload: any,
): payload is PitcherResponsePayload {
  return "result" in payload;
}

export function createNotificationPayload(
  payload: PitcherNotificationPayload,
): Uint8Array {
  return encodeMessage(payload);
}

export function createRequestPayload(
  payload: PitcherRequestPayload,
): Uint8Array {
  return encodeMessage(payload);
}

export function createResponsePayload(
  payload: PitcherResponsePayload | PitcherErrorPayload,
): Uint8Array {
  return encodeMessage(payload);
}
