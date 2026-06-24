import { Trash2, createIcons } from "lucide";
import type { Cell, ChatMessage, SceneCharacter, SceneItemDefinition, SceneItemInstance, SceneToken } from "../core/types";
import type { NetworkSnapshot } from "../services/networkClient";

function formatLatency(latencyMs: number | null): string {
  return latencyMs === null ? "等待中" : `${latencyMs} ms`;
}

function formatChatTime(createdAt: number): string {
  return new Intl.DateTimeFormat("zh-CN", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(createdAt));
}

function formatCell(cell: Cell): string {
  return `(${cell.x}, ${cell.y})`;
}

function isProxyDiceRoll(message: Extract<ChatMessage, { kind: "dice" }>): boolean {
  const tokenId = message.tokenId ?? (message.authorType === "player" ? message.authorId : null);
  return tokenId !== null && message.authorId !== tokenId;
}

function formatChatAuthor(message: ChatMessage): string {
  if (message.kind === "dice" && isProxyDiceRoll(message)) {
    const tokenName = message.tokenName ?? "未知角色";
    return `${tokenName}（代投）`;
  }

  if (message.kind === "dice" && message.rollVisibility === "public") {
    return `${message.authorName}（明投）`;
  }

  if (message.kind === "dice" && message.rollVisibility === "hidden") {
    return `${message.authorName}（暗投）`;
  }

  return message.authorName;
}

export class LatencyPanelController {
  private snapshot: NetworkSnapshot = {
    status: "offline",
    clients: [],
    error: null,
  };

  constructor(
    private readonly panel: HTMLElement,
    private readonly isLoggedIn: () => boolean,
  ) {}

  applySnapshot(snapshot: NetworkSnapshot): void {
    this.snapshot = snapshot;
    this.render();
  }

  render(): void {
    if (!this.isLoggedIn()) {
      this.panel.hidden = true;
      this.panel.replaceChildren();
      return;
    }

    const title = document.createElement("div");
    const status = document.createElement("div");
    const list = document.createElement("div");

    title.className = "latency-panel-title";
    status.className = `latency-panel-status is-${this.snapshot.status}`;
    list.className = "latency-client-list";
    title.textContent = "服务器延迟";
    status.textContent =
      this.snapshot.status === "online" ? "已连接" : this.snapshot.status === "connecting" ? "连接中..." : "未连接";

    if (this.snapshot.error) {
      const error = document.createElement("div");
      error.className = "latency-panel-error";
      error.textContent = this.snapshot.error;
      list.append(error);
    }

    if (this.snapshot.clients.length === 0) {
      const empty = document.createElement("div");
      empty.className = "latency-client-empty";
      empty.textContent = this.snapshot.status === "online" ? "等待延迟数据..." : "等待服务器响应...";
      list.append(empty);
    } else {
      for (const client of this.snapshot.clients) {
        const row = document.createElement("div");
        const name = document.createElement("span");
        const latency = document.createElement("span");

        row.className = "latency-client-row";
        name.textContent = `${client.identity.name} · ${
          client.identity.type === "admin" ? "管理员" : client.identity.type === "player" ? "玩家" : "选择身份中"
        }`;
        latency.textContent = formatLatency(client.latencyMs);
        row.append(name, latency);
        list.append(row);
      }
    }

    this.panel.replaceChildren(title, status, list);
    this.panel.hidden = false;
  }
}

export class ChatPanelController {
  private messages: ChatMessage[] = [];
  private panelOpen = false;

  constructor(
    private readonly elements: {
      panel: HTMLElement;
      toggleButton: HTMLButtonElement;
      messageList: HTMLDivElement;
    },
    private readonly canShowChat: () => boolean,
  ) {}

  get isOpen(): boolean {
    return this.panelOpen;
  }

  applyMessages(messages: ChatMessage[], mode: "replace" | "append"): void {
    if (mode === "replace") {
      this.messages.splice(0, this.messages.length, ...messages);
    } else {
      const knownMessageIds = new Set(this.messages.map((message) => message.id));
      this.messages.push(...messages.filter((message) => !knownMessageIds.has(message.id)));
    }

    this.messages.sort((a, b) => a.createdAt - b.createdAt);
    this.render();
  }

  setOpen(open: boolean): void {
    this.panelOpen = open && this.canShowChat();
    this.render();
  }

  render(): void {
    const canShowChat = this.canShowChat();

    if (!canShowChat) {
      this.panelOpen = false;
    }

    const { panel, toggleButton, messageList } = this.elements;
    toggleButton.classList.toggle("is-hidden", !canShowChat);
    toggleButton.classList.toggle("is-active", canShowChat && this.panelOpen);
    toggleButton.disabled = !canShowChat;
    toggleButton.setAttribute("aria-pressed", String(canShowChat && this.panelOpen));
    toggleButton.setAttribute("aria-label", this.panelOpen ? "关闭聊天" : "打开聊天");
    panel.hidden = !canShowChat;
    panel.classList.toggle("is-open", canShowChat && this.panelOpen);
    panel.setAttribute("aria-hidden", String(!canShowChat || !this.panelOpen));

    if (this.messages.length === 0) {
      const empty = document.createElement("div");
      empty.className = "chat-empty";
      empty.textContent = "投骰和移动记录会显示在这里。";
      messageList.replaceChildren(empty);
      return;
    }

    const elements = this.messages.map((message) => {
      const item = document.createElement("article");
      const meta = document.createElement("div");
      const author = document.createElement("span");
      const time = document.createElement("span");

      item.className = "chat-message";
      meta.className = "chat-message-meta";
      author.className = "chat-message-author";
      author.textContent = formatChatAuthor(message);
      time.textContent = formatChatTime(message.createdAt);
      meta.append(author, time);

      if (message.kind === "dice") {
        const formula = document.createElement("div");
        const total = document.createElement("div");
        const detail = document.createElement("div");

        formula.className = "chat-dice-formula";
        total.className = "chat-dice-total";
        detail.className = "chat-dice-detail";
        formula.textContent = message.formula;
        total.textContent = `总和 ${message.total}`;
        detail.textContent = message.detail;
        item.append(meta, formula, total, detail);
      } else {
        const summary = document.createElement("div");
        const detail = document.createElement("div");

        summary.className = "chat-move-summary";
        detail.className = "chat-move-detail";
        summary.textContent = `${message.tokenName} 移动了 ${message.distance} 格`;
        detail.textContent = `${formatCell(message.fromCell)} 到 ${formatCell(message.toCell)}，斜向按 1 格计算`;
        item.append(meta, summary, detail);
      }

      return item;
    });

    messageList.replaceChildren(...elements);
    requestAnimationFrame(() => {
      messageList.scrollTop = messageList.scrollHeight;
    });
  }
}

function createCharacterRow(options: {
  character: SceneCharacter;
  tokens: SceneToken[];
  avatarImages: Map<string, { src: string; image: HTMLImageElement }>;
  isAdmin: boolean;
  duplicateCharacter: (characterId: string) => void;
  deleteCharacter: (characterId: string) => void;
  openTokenInspector: (characterId: string) => void;
}): HTMLDivElement {
  const { character, tokens, avatarImages, isAdmin, duplicateCharacter, deleteCharacter, openTokenInspector } = options;
  const row = document.createElement("div");
  const entry = document.createElement("button");
  const avatar = document.createElement("span");
  const text = document.createElement("span");
  const name = document.createElement("span");
  const status = document.createElement("span");
  const actions = document.createElement("div");
  const copyButton = document.createElement("button");
  const deleteButton = document.createElement("button");
  const isOnMap = tokens.some((token) => token.id === character.id);
  const avatarImage = avatarImages.get(character.id);

  row.className = "character-row";
  row.classList.toggle("is-on-map", isOnMap);
  row.classList.toggle("is-npc", Boolean(character.isNpc));
  entry.type = "button";
  entry.className = "character-entry";
  entry.draggable = true;
  entry.dataset.characterId = character.id;
  avatar.className = "character-avatar";
  avatar.style.setProperty("--character-color", character.color);
  text.className = "character-text";
  name.className = "character-name";
  status.className = "character-status";
  name.textContent = character.name;
  status.textContent = isOnMap ? "已在地图上" : "可拖入地图";

  if (avatarImage) {
    const image = document.createElement("img");
    const diameter = 100;
    const radius = diameter / 2;
    const scale = character.avatarScale ?? 1;
    const offsetX = (character.avatarOffsetX ?? 0) * radius;
    const offsetY = (character.avatarOffsetY ?? 0) * radius;
    const ratio = avatarImage.image.naturalWidth / avatarImage.image.naturalHeight || 1;
    const width = ratio >= 1 ? diameter * scale * ratio : diameter * scale;
    const height = ratio >= 1 ? diameter * scale : (diameter * scale) / ratio;

    image.src = avatarImage.src;
    image.alt = `${character.name} 头像`;
    image.style.width = `${width}%`;
    image.style.height = `${height}%`;
    image.style.left = `${50 + offsetX}%`;
    image.style.top = `${50 + offsetY}%`;
    avatar.append(image);
  } else {
    avatar.textContent = character.name.trim().slice(0, 1).toUpperCase() || "P";
  }

  actions.className = "character-row-actions";

  copyButton.type = "button";
  copyButton.className = "copy-character-button";
  copyButton.setAttribute("aria-label", `复制角色 ${character.name}`);
  copyButton.innerHTML =
    '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><rect x="9" y="9" width="11" height="11" rx="2" fill="none" stroke="currentColor" stroke-width="2"/><path d="M5 15V5a2 2 0 0 1 2-2h10" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';
  copyButton.addEventListener("click", (event) => {
    event.stopPropagation();
    duplicateCharacter(character.id);
  });

  deleteButton.type = "button";
  deleteButton.className = "delete-character-button";
  deleteButton.setAttribute("aria-label", `删除角色 ${character.name}`);
  deleteButton.innerHTML =
    '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M9 3h6l1 2h4v2H4V5h4l1-2Z"/><path d="M6 9h12l-1 12H7L6 9Zm4 2v8h2v-8h-2Zm4 0v8h2v-8h-2Z"/></svg>';
  deleteButton.addEventListener("click", (event) => {
    event.stopPropagation();
    deleteCharacter(character.id);
  });

  entry.addEventListener("click", () => openTokenInspector(character.id));
  entry.addEventListener("dragstart", (event) => {
    if (!event.dataTransfer || !isAdmin) {
      return;
    }

    event.dataTransfer.effectAllowed = "copy";
    event.dataTransfer.setData("application/x-trpg-character-id", character.id);
    event.dataTransfer.setData("text/plain", character.id);
  });

  text.append(name, status);
  entry.append(avatar, text);
  actions.append(copyButton, deleteButton);
  row.append(entry, actions);
  return row;
}

function createCharacterListSeparator(): HTMLDivElement {
  const separator = document.createElement("div");
  const label = document.createElement("span");

  separator.className = "character-list-separator";
  separator.setAttribute("role", "separator");
  separator.setAttribute("aria-label", "NPC");
  label.className = "character-list-separator-label";
  label.textContent = "NPC";
  separator.append(label);
  return separator;
}

function renderCharacterList(
  list: HTMLDivElement,
  characters: SceneCharacter[],
  options: {
    tokens: SceneToken[];
    avatarImages: Map<string, { src: string; image: HTMLImageElement }>;
    isAdmin: boolean;
    duplicateCharacter: (characterId: string) => void;
    deleteCharacter: (characterId: string) => void;
    openTokenInspector: (characterId: string) => void;
  },
): void {
  const playerCharacters = characters.filter((character) => !character.isNpc);
  const npcCharacters = characters.filter((character) => character.isNpc);

  if (characters.length === 0) {
    const empty = document.createElement("div");
    empty.className = "character-empty";
    empty.textContent = "还没有角色。";
    list.replaceChildren(empty);
    return;
  }

  const elements: HTMLElement[] = playerCharacters.map((character) =>
    createCharacterRow({
      character,
      tokens: options.tokens,
      avatarImages: options.avatarImages,
      isAdmin: options.isAdmin,
      duplicateCharacter: options.duplicateCharacter,
      deleteCharacter: options.deleteCharacter,
      openTokenInspector: options.openTokenInspector,
    }),
  );

  if (playerCharacters.length > 0 && npcCharacters.length > 0) {
    elements.push(createCharacterListSeparator());
  }

  elements.push(
    ...npcCharacters.map((character) =>
      createCharacterRow({
        character,
        tokens: options.tokens,
        avatarImages: options.avatarImages,
        isAdmin: options.isAdmin,
        duplicateCharacter: options.duplicateCharacter,
        deleteCharacter: options.deleteCharacter,
        openTokenInspector: options.openTokenInspector,
      }),
    ),
  );

  list.replaceChildren(...elements);
}

export class CharacterPanelController {
  private panelOpen = false;

  constructor(
    private readonly elements: {
      panel: HTMLElement;
      toggleButton: HTMLButtonElement;
      addButton: HTMLButtonElement;
      list: HTMLDivElement;
    },
    private readonly state: {
      canShowCharacters: () => boolean;
      isAdmin: () => boolean;
      characters: () => SceneCharacter[];
      tokens: () => SceneToken[];
      avatarImages: () => Map<string, { src: string; image: HTMLImageElement }>;
    },
    private readonly actions: {
      duplicateCharacter: (characterId: string) => void;
      deleteCharacter: (characterId: string) => void;
      openTokenInspector: (characterId: string) => void;
    },
  ) {}

  get isOpen(): boolean {
    return this.panelOpen;
  }

  setOpen(open: boolean): void {
    this.panelOpen = open && this.state.canShowCharacters();
    this.render();
  }

  render(): void {
    const canShowCharacters = this.state.canShowCharacters();

    if (!canShowCharacters) {
      this.panelOpen = false;
    }

    const { panel, toggleButton, addButton, list } = this.elements;
    toggleButton.classList.toggle("is-hidden", !canShowCharacters);
    toggleButton.classList.toggle("is-active", canShowCharacters && this.panelOpen);
    toggleButton.disabled = !canShowCharacters;
    toggleButton.setAttribute("aria-pressed", String(canShowCharacters && this.panelOpen));
    toggleButton.setAttribute("aria-label", this.panelOpen ? "关闭角色管理" : "打开角色管理");
    panel.hidden = !canShowCharacters;
    panel.classList.toggle("is-open", canShowCharacters && this.panelOpen);
    panel.setAttribute("aria-hidden", String(!canShowCharacters || !this.panelOpen));
    addButton.disabled = !canShowCharacters;

    const characters = this.state.characters();
    const tokens = this.state.tokens();
    const avatarImages = this.state.avatarImages();
    const isAdmin = this.state.isAdmin();

    renderCharacterList(list, characters, {
      tokens,
      avatarImages,
      isAdmin,
      duplicateCharacter: this.actions.duplicateCharacter,
      deleteCharacter: this.actions.deleteCharacter,
      openTokenInspector: this.actions.openTokenInspector,
    });

    createIcons({
      icons: { Trash2 },
      nameAttr: "data-lucide",
      attrs: {
        "aria-hidden": "true",
        class: "tool-icon",
        focusable: "false",
      },
    });
  }
}

function createItemRow(options: {
  definition: SceneItemDefinition;
  instances: SceneItemInstance[];
  iconImages: Map<string, { src: string; image: HTMLImageElement }>;
  isAdmin: boolean;
  deleteItemDefinition: (definitionId: string) => void;
  openItemDefinitionInspector: (definitionId: string) => void;
}): HTMLDivElement {
  const { definition, instances, iconImages, isAdmin, deleteItemDefinition, openItemDefinitionInspector } = options;
  const row = document.createElement("div");
  const entry = document.createElement("button");
  const avatar = document.createElement("span");
  const text = document.createElement("span");
  const name = document.createElement("span");
  const status = document.createElement("span");
  const deleteButton = document.createElement("button");
  const instanceCount = instances.filter((instance) => instance.definitionId === definition.id).length;
  const iconImage = iconImages.get(definition.id);

  row.className = "character-row item-row";
  row.classList.toggle("is-on-map", instanceCount > 0);
  entry.type = "button";
  entry.className = "character-entry item-entry";
  entry.draggable = true;
  entry.dataset.itemDefinitionId = definition.id;
  avatar.className = "character-avatar item-icon";
  text.className = "character-text";
  name.className = "character-name";
  status.className = "character-status";
  name.textContent = definition.name;
  status.textContent = instanceCount > 0 ? `场景中 ${instanceCount} 个` : "可拖入地图";

  if (iconImage) {
    const image = document.createElement("img");
    const diameter = 100;
    const radius = diameter / 2;
    const scale = definition.iconScale ?? 1;
    const offsetX = (definition.iconOffsetX ?? 0) * radius;
    const offsetY = (definition.iconOffsetY ?? 0) * radius;
    const ratio = iconImage.image.naturalWidth / iconImage.image.naturalHeight || 1;
    const width = ratio >= 1 ? diameter * scale * ratio : diameter * scale;
    const height = ratio >= 1 ? diameter * scale : (diameter * scale) / ratio;

    image.src = iconImage.src;
    image.alt = `${definition.name} 图标`;
    image.style.width = `${width}%`;
    image.style.height = `${height}%`;
    image.style.left = `${50 + offsetX}%`;
    image.style.top = `${50 + offsetY}%`;
    avatar.append(image);
  } else {
    avatar.textContent = definition.name.trim().slice(0, 1) || "物";
  }

  deleteButton.type = "button";
  deleteButton.className = "delete-character-button delete-item-button";
  deleteButton.setAttribute("aria-label", `删除物品 ${definition.name}`);
  deleteButton.innerHTML =
    '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M9 3h6l1 2h4v2H4V5h4l1-2Z"/><path d="M6 9h12l-1 12H7L6 9Zm4 2v8h2v-8h-2Zm4 0v8h2v-8h-2Z"/></svg>';
  deleteButton.addEventListener("click", (event) => {
    event.stopPropagation();
    deleteItemDefinition(definition.id);
  });

  entry.addEventListener("click", () => openItemDefinitionInspector(definition.id));
  entry.addEventListener("dragstart", (event) => {
    if (!event.dataTransfer || !isAdmin) {
      return;
    }

    event.dataTransfer.effectAllowed = "copy";
    event.dataTransfer.setData("application/x-trpg-item-definition-id", definition.id);
    event.dataTransfer.setData("text/plain", definition.id);
  });

  text.append(name, status);
  entry.append(avatar, text);
  row.append(entry, deleteButton);
  return row;
}

export class ItemPanelController {
  private panelOpen = false;

  constructor(
    private readonly elements: {
      panel: HTMLElement;
      toggleButton: HTMLButtonElement;
      addButton: HTMLButtonElement;
      list: HTMLDivElement;
    },
    private readonly state: {
      canShowItems: () => boolean;
      isAdmin: () => boolean;
      definitions: () => SceneItemDefinition[];
      instances: () => SceneItemInstance[];
      iconImages: () => Map<string, { src: string; image: HTMLImageElement }>;
    },
    private readonly actions: {
      deleteItemDefinition: (definitionId: string) => void;
      openItemDefinitionInspector: (definitionId: string) => void;
    },
  ) {}

  get isOpen(): boolean {
    return this.panelOpen;
  }

  setOpen(open: boolean): void {
    this.panelOpen = open && this.state.canShowItems();
    this.render();
  }

  render(): void {
    const canShowItems = this.state.canShowItems();

    if (!canShowItems) {
      this.panelOpen = false;
    }

    const { panel, toggleButton, addButton, list } = this.elements;
    toggleButton.classList.toggle("is-hidden", !canShowItems);
    toggleButton.classList.toggle("is-active", canShowItems && this.panelOpen);
    toggleButton.disabled = !canShowItems;
    toggleButton.setAttribute("aria-pressed", String(canShowItems && this.panelOpen));
    toggleButton.setAttribute("aria-label", this.panelOpen ? "关闭物品图鉴" : "打开物品图鉴");
    panel.hidden = !canShowItems;
    panel.classList.toggle("is-open", canShowItems && this.panelOpen);
    panel.setAttribute("aria-hidden", String(!canShowItems || !this.panelOpen));
    addButton.disabled = !canShowItems;

    const definitions = this.state.definitions();
    const instances = this.state.instances();
    const iconImages = this.state.iconImages();
    const isAdmin = this.state.isAdmin();

    if (definitions.length === 0) {
      const empty = document.createElement("div");
      empty.className = "character-empty";
      empty.textContent = "还没有物品。";
      list.replaceChildren(empty);
    } else {
      list.replaceChildren(
        ...definitions.map((definition) =>
          createItemRow({
            definition,
            instances,
            iconImages,
            isAdmin,
            deleteItemDefinition: this.actions.deleteItemDefinition,
            openItemDefinitionInspector: this.actions.openItemDefinitionInspector,
          }),
        ),
      );
    }

    createIcons({
      icons: { Trash2 },
      nameAttr: "data-lucide",
      attrs: {
        "aria-hidden": "true",
        class: "tool-icon",
        focusable: "false",
      },
    });
  }
}
