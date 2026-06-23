import { blockedEdgeSet, doorKey, normalizeBlockedEdge } from "../../normalization/edges.mjs";
import { normalizeSceneDoor } from "../../normalization/doors.mjs";
import { normalizeSceneRoom } from "../../normalization/rooms.mjs";
import { broadcastScenePatch } from "../../scene/broadcast.mjs";
import {
  blockedHorizontalEdges,
  blockedVerticalEdges,
  sceneDoors,
  sceneRooms,
} from "../../state/index.mjs";

function blockedEdgePatchField(type) {
  return type === "vertical" ? "blockedVerticalEdges" : "blockedHorizontalEdges";
}

export function handleBlockedEdgeSet(client, message) {
  if (client.identity.type !== "admin") {
    return;
  }

  const edge = normalizeBlockedEdge(message.edge);
  if (!edge || typeof message.blocked !== "boolean") {
    return;
  }

  const set = blockedEdgeSet(edge.type);
  if (message.blocked) {
    sceneDoors.delete(doorKey(edge));
    set.add(edge.key);
  } else {
    set.delete(edge.key);
  }

  client.lastSeenAt = Date.now();

  const patch = {
    [blockedEdgePatchField(edge.type)]: [{ key: edge.key, blocked: message.blocked }],
  };
  if (message.blocked) {
    patch.doorDeletes = [{ type: edge.type, x: edge.x, y: edge.y }];
  }

  broadcastScenePatch(patch);
}

export function handleBlockedEdgesClear(client) {
  if (client.identity.type !== "admin") {
    return;
  }

  blockedVerticalEdges.clear();
  blockedHorizontalEdges.clear();
  sceneDoors.clear();
  client.lastSeenAt = Date.now();
  broadcastScenePatch({ blockedEdgesClear: true });
}

export function handleDoorSet(client, message) {
  if (client.identity.type !== "admin") {
    return;
  }

  const door = normalizeSceneDoor(message.door);
  if (!door) {
    return;
  }

  blockedEdgeSet(door.type).delete(`${door.x},${door.y}`);
  sceneDoors.set(doorKey(door), door);
  client.lastSeenAt = Date.now();
  broadcastScenePatch({
    doorUpserts: [{ ...door }],
    [blockedEdgePatchField(door.type)]: [{ key: `${door.x},${door.y}`, blocked: false }],
  });
}

export function handleDoorDelete(client, message) {
  if (client.identity.type !== "admin") {
    return;
  }

  const edge = normalizeBlockedEdge(message.edge);
  if (!edge) {
    return;
  }

  sceneDoors.delete(doorKey(edge));
  client.lastSeenAt = Date.now();
  broadcastScenePatch({
    doorDeletes: [{ type: edge.type, x: edge.x, y: edge.y }],
  });
}

export function handleRoomUpdate(client, message) {
  if (client.identity.type !== "admin") {
    return;
  }

  const room = normalizeSceneRoom(message.room);
  if (!room) {
    return;
  }

  sceneRooms.set(room.id, room);
  client.lastSeenAt = Date.now();
  broadcastScenePatch({
    roomUpserts: [
      {
        ...room,
        cells: room.cells.map((cell) => ({ ...cell })),
      },
    ],
  });
}

export function handleRoomDelete(client, message) {
  if (client.identity.type !== "admin") {
    return;
  }

  const roomId = String(message.roomId ?? "");
  if (!sceneRooms.delete(roomId)) {
    return;
  }

  client.lastSeenAt = Date.now();
  broadcastScenePatch({ roomDeletes: [roomId] });
}
