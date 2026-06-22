import type { AppMode, EditMode, Identity, SceneToken } from "./types";

export const HOST_IDENTITY: Identity = { type: "admin", id: "host", name: "主持人" };

const MODE_LABELS: Record<AppMode, string> = {
  edit: "编辑模式",
  play: "主持模式",
};

const EDIT_MODE_LABELS: Record<EditMode, string> = {
  background: "背景",
  blocking: "阻挡",
  tokens: "角色",
  rooms: "房间",
};

export function buildIdentities(tokens: SceneToken[]): Identity[] {
  return [
    HOST_IDENTITY,
    ...tokens.map((token) => ({
      type: "player" as const,
      id: token.id,
      name: token.name,
    })),
  ];
}

export function renderIdentityList(
  identityList: HTMLDivElement,
  identities: Identity[],
  onEnterIdentity: (identity: Identity) => void,
): void {
  identityList.replaceChildren(
    ...identities.map((identity) => {
      const button = document.createElement("button");
      const label = document.createElement("span");
      const type = document.createElement("span");

      button.type = "button";
      button.className = "identity-option";
      label.className = "identity-option-name";
      type.className = "identity-option-type";
      label.textContent = identity.name;
      type.textContent = identity.type === "admin" ? "管理员" : "玩家";
      button.append(label, type);
      button.addEventListener("click", () => onEnterIdentity(identity));

      return button;
    }),
  );
}

export function rebuildModeOptions(modeSelect: HTMLSelectElement, modes: AppMode[]): void {
  modeSelect.replaceChildren(
    ...modes.map((mode) => {
      const option = document.createElement("option");
      option.value = mode;
      option.textContent = MODE_LABELS[mode];
      return option;
    }),
  );
}

export function rebuildEditModeOptions(editModeSelect: HTMLSelectElement, editModes: EditMode[]): void {
  editModeSelect.replaceChildren(
    ...editModes.map((mode) => {
      const option = document.createElement("option");
      option.value = mode;
      option.textContent = EDIT_MODE_LABELS[mode];
      return option;
    }),
  );
}

export function identityLabel(identity: Identity | null): string {
  if (!identity) {
    return "未登录";
  }

  return `${identity.name} · ${identity.type === "admin" ? "管理员" : "玩家"}`;
}
