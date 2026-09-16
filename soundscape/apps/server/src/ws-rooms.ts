export interface Sender {
  send(json: string): void;
}

export interface AgentConnection {
  tokenHash: string;
  agentId: string;
  sender: Sender;
}

/** One authenticated local browser agent may be connected per pairing token. */
export class AgentRegistry {
  private agents = new Map<string, AgentConnection>();
  private senderAgents = new Map<Sender, AgentConnection>();

  register(tokenHash: string, agentId: string, sender: Sender): void {
    const connection = { tokenHash, agentId, sender };
    const previous = this.agents.get(tokenHash);
    if (previous) this.senderAgents.delete(previous.sender);
    this.agents.set(tokenHash, connection);
    this.senderAgents.set(sender, connection);
  }

  get(tokenHash: string): AgentConnection | null {
    return this.agents.get(tokenHash) ?? null;
  }

  forSender(sender: Sender): AgentConnection | null {
    return this.senderAgents.get(sender) ?? null;
  }

  unregister(sender: Sender): AgentConnection | null {
    const connection = this.senderAgents.get(sender);
    if (!connection) return null;
    this.senderAgents.delete(sender);
    if (this.agents.get(connection.tokenHash)?.sender === sender) {
      this.agents.delete(connection.tokenHash);
    }
    return connection;
  }

  send(tokenHash: string, message: unknown): boolean {
    const connection = this.agents.get(tokenHash);
    if (!connection) return false;
    connection.sender.send(JSON.stringify(message));
    return true;
  }
}
