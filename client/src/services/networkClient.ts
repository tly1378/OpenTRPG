import type {
  Cell,
  ChatMessage,
  DiceChatMessage,
  Identity,
  SceneCharacter,
  SceneDoor,
  SceneImageSnapshot,
  SceneItemDefinition,
  SceneItemInstance,
  SceneBackpackItem,
  SceneRoom,
  SceneToken,
  WallEdgeType,
} from "../core/types";

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
  images: SceneImageSnapshot[];
  characters: SceneCharacter[];
  tokens: SceneToken[];
  itemDefinitions: SceneItemDefinition[];
  itemInstances: SceneItemInstance[];
  backpackItems: SceneBackpackItem[];
  blockedVerticalEdges: string[];
  blockedHorizontalEdges: string[];
  doors: SceneDoor[];
  rooms: SceneRoom[];
};

type BlockedEdgeChange = {
  key: string;
  blocked: boolean;
};

type DoorEdgeRef = {
  type: WallEdgeType;
  x: number;
  y: number;
};

export type ScenePatch = {
  imageUpserts?: SceneImageSnapshot[];
  imageDeletes?: string[];
  characterUpserts?: SceneCharacter[];
  characterDeletes?: string[];
  tokenUpserts?: SceneToken[];
  tokenDeletes?: string[];
  itemDefinitionUpserts?: SceneItemDefinition[];
  itemDefinitionDeletes?: string[];
  itemInstanceUpserts?: SceneItemInstance[];
  itemInstanceDeletes?: string[];
  backpackItemUpserts?: SceneBackpackItem[];
  backpackItemDeletes?: string[];
  blockedVerticalEdges?: BlockedEdgeChange[];
  blockedHorizontalEdges?: BlockedEdgeChange[];
  blockedEdgesClear?: boolean;
  doorUpserts?: SceneDoor[];
  doorDeletes?: DoorEdgeRef[];
  roomUpserts?: SceneRoom[];
  roomDeletes?: string[];
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
      images?: SceneImageSnapshot[];
      characters?: SceneCharacter[];
      tokens: SceneToken[];
      itemDefinitions?: SceneItemDefinition[];
      itemInstances?: SceneItemInstance[];
      backpackItems?: SceneBackpackItem[];
      blockedVerticalEdges?: string[];
      blockedHorizontalEdges?: string[];
      doors?: SceneDoor[];
      rooms?: SceneRoom[];
      serverTime: number;
    }
  | {
      type: "scene:patch";
      serverTime: number;
    } & ScenePatch
  | {
      type: "chat:history";
      messages: ChatMessage[];
      serverTime: number;
    }
  | {
      type: "chat:message";
      message: ChatMessage;
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
    private readonly onSceneSnapshot: (snapshot: SceneSnapshot) => void,
    private readonly onScenePatch: (patch: ScenePatch) => void,
    private readonly onChatMessages: (messages: ChatMessage[], mode: "replace" | "append") => void,
  ) {}

  connect(identity: NetworkIdentity | null = null): void {
    this.identity = identity ?? LOBBY_IDENTITY;
    this.clients = [];
    this.clearReconnectTimer();
    this.openSocket();
  }

  updateIdentity(identity: NetworkIdentity): void {
    this.identity = identity;
  }

  sendTokenAdded(token: SceneToken): void {
    this.send({
      type: "scene:token-add",
      token,
    });
  }

  sendCharacterAdded(character: SceneCharacter): void {
    this.send({
      type: "scene:character-add",
      character,
    });
  }

  sendCharacterUpdated(character: SceneCharacter): void {
    this.send({
      type: "scene:character-update",
      character,
    });
  }

  sendCharacterDeleted(characterId: string): void {
    this.send({
      type: "scene:character-delete",
      characterId,
    });
  }

  sendItemDefinitionAdded(definition: SceneItemDefinition): void {
    this.send({
      type: "scene:item-definition-add",
      definition,
    });
  }

  sendItemDefinitionUpdated(definition: SceneItemDefinition): void {
    this.send({
      type: "scene:item-definition-update",
      definition,
    });
  }

  sendItemDefinitionDeleted(definitionId: string): void {
    this.send({
      type: "scene:item-definition-delete",
      definitionId,
    });
  }

  sendItemInstanceAdded(instance: SceneItemInstance): void {
    this.send({
      type: "scene:item-instance-add",
      instance,
    });
  }

  sendItemInstanceUpdated(instance: SceneItemInstance): void {
    this.send({
      type: "scene:item-instance-update",
      instance,
    });
  }

  sendItemInstanceDeleted(instanceId: string): void {
    this.send({
      type: "scene:item-instance-delete",
      instanceId,
    });
  }

  sendWarehouseTransfer(fromWarehouse: string, toWarehouse: string, itemId: string): void {
    this.send({
      type: "scene:warehouse-transfer",
      fromWarehouse,
      toWarehouse,
      itemId,
    });
  }

  sendWarehouseSplit(warehouseId: string, itemId: string, splitQuantity: number): void {
    this.send({
      type: "scene:warehouse-split",
      warehouseId,
      itemId,
      splitQuantity,
    });
  }

  sendTokenDeleted(tokenId: string): void {
    this.send({
      type: "scene:token-delete",
      tokenId,
    });
  }

  sendImageAdded(image: SceneImageSnapshot): void {
    this.send({
      type: "scene:image-add",
      image,
    });
  }

  sendImageUpdated(image: SceneImageSnapshot): void {
    this.send({
      type: "scene:image-update",
      image,
    });
  }

  sendImagesUpdated(images: SceneImageSnapshot[]): void {
    this.send({
      type: "scene:images-update",
      images,
    });
  }

  sendImageDeleted(imageId: string): void {
    this.send({
      type: "scene:image-delete",
      imageId,
    });
  }

  sendTokenMoved(token: SceneToken, path: Cell[]): void {
    this.send({
      type: "scene:token-move",
      tokenId: token.id,
      name: token.name,
      avatarSrc: token.avatarSrc,
      avatarScale: token.avatarScale,
      avatarOffsetX: token.avatarOffsetX,
      avatarOffsetY: token.avatarOffsetY,
      cell: token.cell,
      path,
    });
  }

  sendTokenUpdated(token: SceneToken): void {
    this.send({
      type: "scene:token-update",
      token,
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

  sendDoorChanged(door: SceneDoor): void {
    this.send({
      type: "scene:door-set",
      door,
    });
  }

  sendDoorDeleted(type: WallEdgeType, x: number, y: number): void {
    this.send({
      type: "scene:door-delete",
      edge: { type, x, y },
    });
  }

  sendRoomUpdated(room: SceneRoom): void {
    this.send({
      type: "scene:room-update",
      room,
    });
  }

  sendRoomDeleted(roomId: string): void {
    this.send({
      type: "scene:room-delete",
      roomId,
    });
  }

  sendDiceChatMessage(
    message: Pick<DiceChatMessage, "kind" | "formula" | "total" | "detail" | "tokenId" | "rollVisibility">,
  ): void {
    this.send({
      type: "chat:dice",
      message,
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
      this.onSceneSnapshot({
        images: message.images ?? [],
        characters: message.characters ?? message.tokens,
        tokens: message.tokens,
        itemDefinitions: message.itemDefinitions ?? [],
        itemInstances: message.itemInstances ?? [],
        backpackItems: message.backpackItems ?? [],
        blockedVerticalEdges: message.blockedVerticalEdges ?? [],
        blockedHorizontalEdges: message.blockedHorizontalEdges ?? [],
        doors: message.doors ?? [],
        rooms: message.rooms ?? [],
      });
      return;
    }

    if (message.type === "scene:patch") {
      const { type: _type, serverTime: _serverTime, ...patch } = message;
      this.onScenePatch(patch);
      return;
    }

    if (message.type === "chat:history") {
      this.onChatMessages(message.messages, "replace");
      return;
    }

    if (message.type === "chat:message") {
      this.onChatMessages([message.message], "append");
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
