import { cellKey } from "../grid/grid";
import type { Cell, SceneItemDefinition, SceneItemInstance } from "../../core/types";

export type ItemStack = {
  cell: Cell;
  instances: SceneItemInstance[];
};

export function groupItemInstancesByCell(instances: SceneItemInstance[]): ItemStack[] {
  const groups = new Map<string, SceneItemInstance[]>();

  for (const instance of instances) {
    const key = cellKey(instance.cell);
    const group = groups.get(key) ?? [];
    group.push(instance);
    groups.set(key, group);
  }

  return [...groups.values()].map((stackInstances) => ({
    cell: stackInstances[0].cell,
    instances: stackInstances,
  }));
}

export function getItemStackForInstance(
  instance: SceneItemInstance | null,
  instances: SceneItemInstance[],
): ItemStack | null {
  if (!instance) {
    return null;
  }

  const stack = groupItemInstancesByCell(instances).find((candidate) =>
    candidate.instances.some((stackInstance) => stackInstance.id === instance.id),
  );

  return stack ?? null;
}

export function buildItemStackLabel(
  instances: SceneItemInstance[],
  definitionsById: Map<string, SceneItemDefinition>,
): string {
  const counts = new Map<string, number>();
  const order: string[] = [];

  for (const instance of instances) {
    const current = counts.get(instance.definitionId) ?? 0;
    if (current === 0) {
      order.push(instance.definitionId);
    }
    counts.set(instance.definitionId, current + instance.quantity);
  }

  return order
    .map((definitionId) => {
      const definition = definitionsById.get(definitionId);
      const name = definition?.name ?? "物品";
      const quantity = counts.get(definitionId) ?? 1;
      return quantity > 1 ? `${name}*${quantity}` : name;
    })
    .join("、");
}

export function formatStackLabelLines(label: string, maxLines = 2, charsPerLine = 10): string[] {
  if (label.length === 0) {
    return [""];
  }

  const lines: string[] = [];
  let remaining = label;

  for (let lineIndex = 0; lineIndex < maxLines && remaining.length > 0; lineIndex += 1) {
    const isLastLine = lineIndex === maxLines - 1;

    if (remaining.length <= charsPerLine) {
      lines.push(remaining);
      break;
    }

    if (isLastLine) {
      lines.push(`${remaining.slice(0, charsPerLine - 1)}…`);
      break;
    }

    lines.push(remaining.slice(0, charsPerLine));
    remaining = remaining.slice(charsPerLine);
  }

  return lines;
}

export function buildItemDisplayLabel(
  stack: ItemStack,
  definitionsById: Map<string, SceneItemDefinition>,
): string {
  if (stack.instances.length === 1) {
    const instance = stack.instances[0];
    const definition = definitionsById.get(instance.definitionId);
    const name = definition?.name ?? "物品";
    return instance.quantity > 1 ? `${name}*${instance.quantity}` : name;
  }

  return buildItemStackLabel(stack.instances, definitionsById);
}

export function buildItemStackDescription(
  stack: ItemStack,
  definitionsById: Map<string, SceneItemDefinition>,
): string {
  if (stack.instances.length === 1) {
    const definition = definitionsById.get(stack.instances[0].definitionId);
    return definition?.description?.trim() || "暂无描述";
  }

  const lines = stack.instances.map((instance) => {
    const definition = definitionsById.get(instance.definitionId);
    const name = definition?.name ?? "物品";
    const quantityLabel = instance.quantity > 1 ? `${name}*${instance.quantity}` : name;
    const description = definition?.description?.trim() || "暂无描述";
    return `${quantityLabel}：${description}`;
  });

  return lines.join("\n");
}
