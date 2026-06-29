import type { MenubarPresenceMsg } from '@soundscape/types';

export interface Sender {
  send(json: string): void;
}

interface Room {
  webs: Set<Sender>;
  menubar: Sender | null;
}

export class Rooms {
  private rooms = new Map<string, Room>();
  private senderToken = new Map<Sender, string>();

  private getOrCreate(token: string): Room {
    let room = this.rooms.get(token);
    if (!room) {
      room = { webs: new Set(), menubar: null };
      this.rooms.set(token, room);
    }
    return room;
  }

  registerWeb(token: string, sender: Sender): void {
    const room = this.getOrCreate(token);
    room.webs.add(sender);
    this.senderToken.set(sender, token);
  }

  registerMenubar(token: string, sender: Sender): void {
    const room = this.getOrCreate(token);
    room.menubar = sender;
    this.senderToken.set(sender, token);
    const presence: MenubarPresenceMsg = { type: 'menubar_presence', online: true };
    const json = JSON.stringify(presence);
    for (const web of room.webs) {
      web.send(json);
    }
  }

  unregister(sender: Sender): void {
    const token = this.senderToken.get(sender);
    if (token == null) return;
    this.senderToken.delete(sender);
    const room = this.rooms.get(token);
    if (!room) return;
    if (room.menubar === sender) {
      room.menubar = null;
      const presence: MenubarPresenceMsg = { type: 'menubar_presence', online: false };
      const json = JSON.stringify(presence);
      for (const web of room.webs) {
        web.send(json);
      }
    } else {
      room.webs.delete(sender);
    }
  }

  menubarFor(token: string): Sender | null {
    return this.rooms.get(token)?.menubar ?? null;
  }

  websFor(token: string): Sender[] {
    return [...(this.rooms.get(token)?.webs ?? [])];
  }

  sendToWebs(token: string, msg: unknown): void {
    const json = JSON.stringify(msg);
    for (const web of this.rooms.get(token)?.webs ?? []) {
      web.send(json);
    }
  }

  sendToMenubar(token: string, msg: unknown): boolean {
    const mb = this.rooms.get(token)?.menubar;
    if (!mb) return false;
    mb.send(JSON.stringify(msg));
    return true;
  }
}
