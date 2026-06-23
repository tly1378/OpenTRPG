const MAX_QUANTITY = 9999;

export function findGroundItemStack(instances, cell, definitionId) {
  return instances.find(
    (instance) =>
      instance.cell.x === cell.x &&
      instance.cell.y === cell.y &&
      instance.definitionId === definitionId,
  );
}

export function addGroundItemQuantity(instance, quantity) {
  instance.quantity = Math.min(MAX_QUANTITY, instance.quantity + quantity);
  return instance;
}
