export interface Sender {
  send(json: string): void;
}

export interface AgentConnection {
  ownerKey: string;
  userId: string;
  agentId: string;
  sender: Sender;
}

/** One authenticated local browser agent may be connected per user. */
export class AgentRegistry {
  private agents = new Map<string, AgentConnection>();
  private senderAgents = new Map<Sender, AgentConnection>();

  register(
    ownerKey: string,
    userId: string,
    agentId: string,
    sender: Sender
  ): void {
    const connection = { ownerKey, userId, agentId, sender };
    const previous = this.agents.get(ownerKey);
    if (previous) this.senderAgents.delete(previous.sender);
    this.agents.set(ownerKey, connection);
    this.senderAgents.set(sender, connection);
  }

  get(ownerKey: string): AgentConnection | null {
    return this.agents.get(ownerKey) ?? null;
  }

  forSender(sender: Sender): AgentConnection | null {
    return this.senderAgents.get(sender) ?? null;
  }

  unregister(sender: Sender): AgentConnection | null {
    const connection = this.senderAgents.get(sender);
    if (!connection) return null;
    this.senderAgents.delete(sender);
    if (this.agents.get(connection.ownerKey)?.sender === sender) {
      this.agents.delete(connection.ownerKey);
    }
    return connection;
  }

  unregisterOwner(ownerKey: string): void {
    const connection = this.agents.get(ownerKey);
    if (!connection) return;
    this.senderAgents.delete(connection.sender);
    this.agents.delete(ownerKey);
  }

  isConnected(ownerKey: string): boolean {
    return this.agents.has(ownerKey);
  }

  send(ownerKey: string, message: unknown): boolean {
    const connection = this.agents.get(ownerKey);
    if (!connection) return false;
    connection.sender.send(JSON.stringify(message));
    return true;
  }
}
