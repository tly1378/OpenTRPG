import { handleChatDice } from "../handlers/chat/dice.mjs";
import { handleHello } from "../handlers/hello.mjs";
import { handlePong } from "../handlers/pong.mjs";
import { handleSceneCharacterAdd, handleSceneCharacterDelete, handleSceneCharacterUpdate } from "../handlers/scene/characters.mjs";
import { handleSceneItemDefinitionAdd, handleSceneItemDefinitionDelete, handleSceneItemDefinitionUpdate } from "../handlers/scene/items.mjs";
import {
  handleSceneItemInstanceAdd,
  handleSceneItemInstanceDelete,
  handleSceneItemInstanceUpdate,
} from "../handlers/scene/itemInstances.mjs";
import { handleSceneWarehouseSplit, handleSceneWarehouseTransfer } from "../handlers/scene/warehouse.mjs";
import { handleSceneImageAdd, handleSceneImageDelete, handleSceneImagesUpdate, handleSceneImageUpdate } from "../handlers/scene/images.mjs";
import {
  handleBlockedEdgeSet,
  handleBlockedEdgesClear,
  handleDoorDelete,
  handleDoorSet,
  handleRoomDelete,
  handleRoomUpdate,
} from "../handlers/scene/map.mjs";
import {
  handleSceneTokenAdd,
  handleSceneTokenDelete,
  handleSceneTokenMove,
  handleSceneTokenUpdate,
} from "../handlers/scene/tokens.mjs";

const messageHandlers = {
  hello: handleHello,
  pong: handlePong,
  "scene:token-add": handleSceneTokenAdd,
  "scene:character-add": handleSceneCharacterAdd,
  "scene:character-update": handleSceneCharacterUpdate,
  "scene:character-delete": handleSceneCharacterDelete,
  "scene:item-definition-add": handleSceneItemDefinitionAdd,
  "scene:item-definition-update": handleSceneItemDefinitionUpdate,
  "scene:item-definition-delete": handleSceneItemDefinitionDelete,
  "scene:item-instance-add": handleSceneItemInstanceAdd,
  "scene:item-instance-update": handleSceneItemInstanceUpdate,
  "scene:item-instance-delete": handleSceneItemInstanceDelete,
  "scene:warehouse-transfer": handleSceneWarehouseTransfer,
  "scene:warehouse-split": handleSceneWarehouseSplit,
  "scene:token-delete": handleSceneTokenDelete,
  "scene:image-add": handleSceneImageAdd,
  "scene:image-update": handleSceneImageUpdate,
  "scene:image-delete": handleSceneImageDelete,
  "scene:images-update": handleSceneImagesUpdate,
  "scene:token-move": handleSceneTokenMove,
  "scene:token-update": handleSceneTokenUpdate,
  "scene:blocked-edge-set": handleBlockedEdgeSet,
  "scene:blocked-edges-clear": handleBlockedEdgesClear,
  "scene:door-set": handleDoorSet,
  "scene:door-delete": handleDoorDelete,
  "scene:room-update": handleRoomUpdate,
  "scene:room-delete": handleRoomDelete,
  "chat:dice": handleChatDice,
};

export function routeMessage(client, message) {
  const handler = messageHandlers[message.type];
  if (handler) {
    handler(client, message);
  }
}
