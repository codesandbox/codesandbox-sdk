import { NestedKey } from "./types";
/**
 * If any new subscription is added,
 * make sure you add it for BasePitcherSubscriptions
 */

export interface ClientSubscriptions {
  client?: {
    // Status updates: join, leave, updated
    status?: boolean;
  };
  file?: {
    // Status updates: open, close, join, save
    status?: boolean;
    // Supports user selections
    selection?: boolean;
    // Requires ot updates
    ot?: boolean;
  };
  fs?: {
    // Needs to receive incoming operations
    operations?: boolean;
  };
  git?: {
    // Needs git status updates
    status?: boolean;
    // Wants to be notified of git operations: commit, pull, push, diff, ...
    operations?: boolean;
  };
  port?: {
    // Get updates whenever a port is opened/closed
    status?: boolean;
  };
  setup?: {
    progress?: boolean;
  };
  shell?: {
    // Receive status updates: progress, ...
    status?: boolean;
  };
  system?: {
    metrics?: boolean;
  };
}

export interface BasePitcherSubscriptions {
  client: {
    status?: boolean;
  };
  file: {
    status: boolean;
    selection: boolean;
    ot: boolean;
  };
  fs: {
    operations: boolean;
  };
  git: {
    status: boolean;
    operations: boolean;
  };
  port: {
    status: boolean;
  };
  setup: {
    progress: boolean;
  };
  shell: {
    status?: boolean;
  };
  system: {
    metrics: boolean;
  };
}

export type PitcherSubscriptions = NestedKey<BasePitcherSubscriptions>;
