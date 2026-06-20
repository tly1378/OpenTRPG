export type ConnectionStatus = "offline" | "connecting" | "online";

export type NetworkIdentity =
  | {
      type: "admin";
      id: "host";
      name: "主持人";
    }
  | {
      type: "player";
      id: string;
      name: string;
    };

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
    };

const serverUrl =
  import.meta.env.VITE_TRPG_SERVER_URL ??
  `${window.location.protocol === "https:" ? "wss" : "ws"}://${window.location.hostname}:8787`;

export class NetworkClient {
  private socket: WebSocket | null = null;
  private identity: NetworkIdentity | null = null;
  private reconnectTimer: number | null = null;
  private status: ConnectionStatus = "offline";
  private clients: RemoteClient[] = [];
  private error: string | null = null;

  constructor(private readonly onChange: (snapshot: NetworkSnapshot) => void) {}

  connect(identity: NetworkIdentity): void {
    this.identity = identity;
    this.clients = [];
    this.clearReconnectTimer();
    this.openSocket();
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
    this.socket = new WebSocket(serverUrl);
    this.setStatus("connecting");

    this.socket.addEventListener("open", () => {
      this.error = null;
      this.send({
        type: "hello",
        identity: this.identity,
      });
      this.setStatus("online");
    });

    this.socket.addEventListener("message", (event) => {
      this.handleMessage(event.data);
    });

    this.socket.addEventListener("close", () => {
      this.socket = null;
      this.clients = [];
      this.setStatus(this.identity ? "connecting" : "offline");
      this.scheduleReconnect();
    });

    this.socket.addEventListener("error", () => {
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
