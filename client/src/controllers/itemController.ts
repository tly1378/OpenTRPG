import type { Cell, SceneItemDefinition, SceneItemInstance } from "../core/types";
import { createSceneItemDefinition, createSceneItemInstance } from "../modules/scene/sceneActions";
import { findGroundItemStack } from "../modules/warehouses/warehouses";

export class ItemController {
  constructor(
    private readonly state: {
      sceneItemDefinitions: SceneItemDefinition[];
      sceneItemInstances: SceneItemInstance[];
      getInspectedItemDefinitionId: () => string | null;
      setInspectedItemDefinitionId: (definitionId: string | null) => void;
      getInspectedItemInstanceId: () => string | null;
      setInspectedItemInstanceId: (instanceId: string | null) => void;
      getSelectedItemInstanceId: () => string | null;
      setSelectedItemInstanceId: (instanceId: string | null) => void;
      getNextItemIndex: () => number;
      setNextItemIndex: (nextIndex: number) => void;
      setItemNameEditing: (editing: boolean) => void;
      setItemDescriptionEditing: (editing: boolean) => void;
    },
    private readonly queries: {
      isAdmin: () => boolean;
      getInspectedItemDefinition: () => SceneItemDefinition | null;
      getInspectedItemInstance: () => SceneItemInstance | null;
    },
    private readonly elements: {
      itemNameInput: HTMLInputElement;
      itemDescriptionInput: HTMLTextAreaElement;
      itemQuantityInput: HTMLInputElement;
    },
    private readonly actions: {
      renderItemPanel: () => void;
      openItemDefinitionInspector: (definitionId: string) => void;
      closeItemDefinitionInspector: () => void;
      openItemInstanceInspector: (instanceId: string) => void;
      closeItemInstanceInspector: () => void;
      updateItemDefinitionInspector: () => void;
      updateItemInstanceInspector: () => void;
    },
    private readonly network: {
      sendItemDefinitionAdded: (definition: SceneItemDefinition) => void;
      sendItemDefinitionUpdated: (definition: SceneItemDefinition) => void;
      sendItemDefinitionDeleted: (definitionId: string) => void;
      sendItemInstanceAdded: (instance: SceneItemInstance) => void;
      sendItemInstanceUpdated: (instance: SceneItemInstance) => void;
      sendItemInstanceDeleted: (instanceId: string) => void;
    },
  ) {}

  addItemDefinition(): void {
    const itemIndex = this.state.getNextItemIndex();
    this.state.setNextItemIndex(itemIndex + 1);
    const definition = createSceneItemDefinition(itemIndex);

    this.state.sceneItemDefinitions.push(definition);
    this.actions.renderItemPanel();
    this.actions.openItemDefinitionInspector(definition.id);
    this.network.sendItemDefinitionAdded(definition);
  }

  placeItemAtCell(definitionId: string, cell: Cell): void {
    if (!this.queries.isAdmin()) {
      return;
    }

    const definition = this.state.sceneItemDefinitions.find((candidate) => candidate.id === definitionId);
    if (!definition) {
      return;
    }

    const existingStack = findGroundItemStack(this.state.sceneItemInstances, cell, definitionId);
    if (existingStack) {
      existingStack.quantity = Math.min(9999, existingStack.quantity + 1);
      this.state.setSelectedItemInstanceId(existingStack.id);
      this.actions.renderItemPanel();
      this.network.sendItemInstanceUpdated(existingStack);
      return;
    }

    const instance = createSceneItemInstance(definitionId, cell);
    this.state.sceneItemInstances.push(instance);
    this.state.setSelectedItemInstanceId(instance.id);
    this.actions.renderItemPanel();
    this.network.sendItemInstanceAdded(instance);
  }

  deleteItemDefinition(definitionId: string): void {
    if (!this.queries.isAdmin()) {
      return;
    }

    const definitionIndex = this.state.sceneItemDefinitions.findIndex((definition) => definition.id === definitionId);
    if (definitionIndex === -1) {
      return;
    }

    this.state.sceneItemDefinitions.splice(definitionIndex, 1);
    for (let index = this.state.sceneItemInstances.length - 1; index >= 0; index -= 1) {
      if (this.state.sceneItemInstances[index].definitionId === definitionId) {
        this.state.sceneItemInstances.splice(index, 1);
      }
    }

    if (this.state.getInspectedItemDefinitionId() === definitionId) {
      this.state.setInspectedItemDefinitionId(null);
      this.state.setItemNameEditing(false);
      this.state.setItemDescriptionEditing(false);
    }

    if (this.state.getInspectedItemInstanceId()) {
      const inspectedInstance = this.state.sceneItemInstances.find(
        (instance) => instance.id === this.state.getInspectedItemInstanceId(),
      );
      if (!inspectedInstance) {
        this.state.setInspectedItemInstanceId(null);
      }
    }

    if (this.state.getSelectedItemInstanceId()) {
      const selectedInstance = this.state.sceneItemInstances.find(
        (instance) => instance.id === this.state.getSelectedItemInstanceId(),
      );
      if (!selectedInstance) {
        this.state.setSelectedItemInstanceId(null);
      }
    }

    this.actions.renderItemPanel();
    this.actions.updateItemDefinitionInspector();
    this.actions.updateItemInstanceInspector();
    this.network.sendItemDefinitionDeleted(definitionId);
  }

  deleteItemInstance(instanceId: string): void {
    if (!this.queries.isAdmin()) {
      return;
    }

    const instanceIndex = this.state.sceneItemInstances.findIndex((instance) => instance.id === instanceId);
    if (instanceIndex === -1) {
      return;
    }

    this.state.sceneItemInstances.splice(instanceIndex, 1);
    if (this.state.getSelectedItemInstanceId() === instanceId) {
      this.state.setSelectedItemInstanceId(null);
    }
    if (this.state.getInspectedItemInstanceId() === instanceId) {
      this.state.setInspectedItemInstanceId(null);
    }

    this.actions.renderItemPanel();
    this.actions.updateItemInstanceInspector();
    this.network.sendItemInstanceDeleted(instanceId);
  }

  updateItemDefinitionName(name: string): void {
    const definition = this.queries.getInspectedItemDefinition();
    const normalizedName = name.trim();
    if (!definition || !this.queries.isAdmin() || normalizedName.length === 0 || definition.name === normalizedName) {
      return;
    }

    definition.name = normalizedName.slice(0, 24);
    this.actions.renderItemPanel();
    this.actions.updateItemDefinitionInspector();
    this.network.sendItemDefinitionUpdated(definition);
  }

  updateItemDefinitionDescription(description: string): void {
    const definition = this.queries.getInspectedItemDefinition();
    if (!definition || !this.queries.isAdmin()) {
      return;
    }

    const normalizedDescription = description.slice(0, 500);
    if (definition.description === normalizedDescription) {
      return;
    }

    definition.description = normalizedDescription;
    this.actions.updateItemDefinitionInspector();
    this.network.sendItemDefinitionUpdated(definition);
  }

  startItemNameEditing(): void {
    if (!this.queries.isAdmin() || !this.queries.getInspectedItemDefinition()) {
      return;
    }

    this.state.setItemNameEditing(true);
    this.actions.updateItemDefinitionInspector();
    this.elements.itemNameInput.focus();
    this.elements.itemNameInput.select();
  }

  stopItemNameEditing(): void {
    this.updateItemDefinitionName(this.elements.itemNameInput.value);
    this.state.setItemNameEditing(false);
    this.actions.updateItemDefinitionInspector();
  }

  startItemDescriptionEditing(): void {
    if (!this.queries.isAdmin() || !this.queries.getInspectedItemDefinition()) {
      return;
    }

    this.state.setItemDescriptionEditing(true);
    this.actions.updateItemDefinitionInspector();
    this.elements.itemDescriptionInput.focus();
  }

  stopItemDescriptionEditing(): void {
    this.updateItemDefinitionDescription(this.elements.itemDescriptionInput.value);
    this.state.setItemDescriptionEditing(false);
    this.actions.updateItemDefinitionInspector();
  }

  updateItemDefinitionIcon(definition: SceneItemDefinition): void {
    this.actions.renderItemPanel();
    this.actions.updateItemDefinitionInspector();
    this.network.sendItemDefinitionUpdated(definition);
  }

  updateItemInstanceQuantity(quantity: number): void {
    const instance = this.queries.getInspectedItemInstance();
    if (!instance || !this.queries.isAdmin()) {
      return;
    }

    const normalizedQuantity = Math.min(9999, Math.max(1, Math.floor(quantity)));
    if (instance.quantity === normalizedQuantity) {
      return;
    }

    instance.quantity = normalizedQuantity;
    this.actions.updateItemInstanceInspector();
    this.network.sendItemInstanceUpdated(instance);
  }

  stopItemQuantityEditing(): void {
    const parsed = Number.parseInt(this.elements.itemQuantityInput.value, 10);
    this.updateItemInstanceQuantity(Number.isFinite(parsed) ? parsed : 1);
    this.actions.updateItemInstanceInspector();
  }
}
