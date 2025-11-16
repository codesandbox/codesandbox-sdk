import { IAgentClientSystem } from "../agent-client-interface";
import { Client } from "../api-clients/pint/client";
import { system } from "../pitcher-protocol";
import { Emitter } from "../utils/event";

export class PintClientSystem implements IAgentClientSystem {
  private onInitStatusUpdateEmitter = new Emitter<system.InitStatus>();
  onInitStatusUpdate = this.onInitStatusUpdateEmitter.event;

  constructor(private apiClient: Client) {}

  async update(): Promise<Record<string, undefined>> {
    return {};
  }
}