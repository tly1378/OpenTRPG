import { blockedEdgeSet, doorKey, normalizeBlockedEdge } from "../../normalization/edges.mjs";
import { normalizeSceneDoor } from "../../normalization/doors.mjs";
import { normalizeSceneRoom } from "../../normalization/rooms.mjs";
import { broadcastSceneSnapshot } from "../../scene/snapshot.mjs";
import {
  blockedHorizontalEdges,
  blockedVerticalEdges,
  sceneDoors,
  sceneRooms,
} from "../../state/index.mjs";

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
  broadcastSceneSnapshot();
}

export function handleBlockedEdgesClear(client) {
  if (client.identity.type !== "admin") {
    return;
  }

  blockedVerticalEdges.clear();
  blockedHorizontalEdges.clear();
  sceneDoors.clear();
  client.lastSeenAt = Date.now();
  broadcastSceneSnapshot();
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
  broadcastSceneSnapshot();
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
  broadcastSceneSnapshot();
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
  broadcastSceneSnapshot();
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
  broadcastSceneSnapshot();
}
