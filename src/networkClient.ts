import type { Identity, SceneToken, WallEdgeType } from "./types";

export type ConnectionStatus = "offline" | "connecting" | "online";

export type NetworkIdentity = Identity | { type: "lobby"; id: "lobby"; name: "身份选择中" };

export type RemoteClient = {
  clientId: string;
  identity: NetworkIdentity;
  latencyMs: number | null;
  connectedAt: number;
  lastSeenAt: number;
};

export type NetworkSnapshot = {
  status: ConnectionStatus;
  clients: RemoteClient[];
  error: string | null;
};

export type SceneSnapshot = {
  tokens: SceneToken[];
  blockedVerticalEdges: string[];
  blockedHorizontalEdges: string[];
};

type NetworkMessage =
  | {
      type: "ready" | "hello";
      clientId: string;
      serverTime: number;
    }
  | {
      type: "ping";
      sentAt: number;
    }
  | {
      type: "clients";
      clients: RemoteClient[];
      serverTime: number;
    }
  | {
      type: "scene:snapshot";
      tokens: SceneToken[];
      blockedVerticalEdges?: string[];
      blockedHorizontalEdges?: string[];
      serverTime: number;
    };

const serverUrl =
  import.meta.env.VITE_TRPG_SERVER_URL ??
  `${window.location.protocol === "https:" ? "wss" : "ws"}://${window.location.hostname}:8787`;

const LOBBY_IDENTITY: NetworkIdentity = { type: "lobby", id: "lobby", name: "身份选择中" };

export class NetworkClient {
  private socket: WebSocket | null = null;
  private identity: NetworkIdentity | null = null;
  private reconnectTimer: number | null = null;
  private status: ConnectionStatus = "offline";
  private clients: RemoteClient[] = [];
  private error: string | null = null;

  constructor(
    private readonly onChange: (snapshot: NetworkSnapshot) => void,
    private readonly onSceneChange: (snapshot: SceneSnapshot) => void,
  ) {}

  connect(identity: NetworkIdentity | null = null): void {
    this.identity = identity ?? LOBBY_IDENTITY;
    this.clients = [];
    this.clearReconnectTimer();
    this.openSocket();
  }

  sendTokenAdded(token: SceneToken): void {
    this.send({
      type: "scene:token-add",
      token,
    });
  }

  sendTokenMoved(token: SceneToken): void {
    this.send({
      type: "scene:token-move",
      tokenId: token.id,
      cell: token.cell,
    });
  }

  sendBlockedEdgeChanged(type: WallEdgeType, x: number, y: number, blocked: boolean): void {
    this.send({
      type: "scene:blocked-edge-set",
      edge: { type, x, y },
      blocked,
    });
  }

  sendBlockedEdgesCleared(): void {
    this.send({
      type: "scene:blocked-edges-clear",
    });
  }

  disconnect(): void {
    this.identity = null;
    this.clients = [];
    this.clearReconnectTimer();
    this.socket?.close();
    this.socket = null;
    this.setStatus("offline");
  }

  private openSocket(): void {
    if (!this.identity) {
      return;
    }

    this.socket?.close();
    const socket = new WebSocket(serverUrl);
    this.socket = socket;
    this.setStatus("connecting");

    socket.addEventListener("open", () => {
      this.error = null;
      this.send({
        type: "hello",
        identity: this.identity,
      });
      this.setStatus("online");
    });

    socket.addEventListener("message", (event) => {
      this.handleMessage(event.data);
    });

    socket.addEventListener("close", () => {
      if (this.socket !== socket) {
        return;
      }

      this.socket = null;
      this.clients = [];
      this.setStatus(this.identity ? "connecting" : "offline");
      this.scheduleReconnect();
    });

    socket.addEventListener("error", () => {
      if (this.socket !== socket) {
        return;
      }

      this.error = `无法连接 ${serverUrl}`;
      this.emitChange();
    });
  }

  private handleMessage(rawData: unknown): void {
    if (typeof rawData !== "string") {
      return;
    }

    let message: NetworkMessage;
    try {
      message = JSON.parse(rawData) as NetworkMessage;
    } catch {
      return;
    }

    if (message.type === "ping") {
      this.send({
        type: "pong",
        sentAt: message.sentAt,
      });
      return;
    }

    if (message.type === "clients") {
      this.clients = message.clients;
      this.emitChange();
      return;
    }

    if (message.type === "scene:snapshot") {
      this.onSceneChange({
        tokens: message.tokens,
        blockedVerticalEdges: message.blockedVerticalEdges ?? [],
        blockedHorizontalEdges: message.blockedHorizontalEdges ?? [],
      });
    }
  }

  private scheduleReconnect(): void {
    if (!this.identity || this.reconnectTimer !== null) {
      return;
    }

    this.reconnectTimer = window.setTimeout(() => {
      this.reconnectTimer = null;
      this.openSocket();
    }, 1500);
  }

  private clearReconnectTimer(): void {
    if (this.reconnectTimer === null) {
      return;
    }

    window.clearTimeout(this.reconnectTimer);
    this.reconnectTimer = null;
  }

  private send(payload: object): void {
    if (this.socket?.readyState !== WebSocket.OPEN) {
      return;
    }

    this.socket.send(JSON.stringify(payload));
  }

  private setStatus(status: ConnectionStatus): void {
    this.status = status;
    this.emitChange();
  }

  private emitChange(): void {
    this.onChange({
      status: this.status,
      clients: this.clients,
      error: this.error,
    });
  }
}
