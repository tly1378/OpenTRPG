import type { Cell, SceneDoor, SceneRoom, WallEdge, WallEdgeType } from "../core/types";
import { blockedEdgeSet, edgeKey, sameCell } from "../modules/grid/grid";
import { cellsBesideWallEdge, doorId, findRoomByCells, roomDisplayName } from "../modules/grid/logicMapUtils";

export class LogicMapController {
  constructor(
    private readonly state: {
      blockedVerticalEdges: Set<string>;
      blockedHorizontalEdges: Set<string>;
      sceneDoors: Map<string, SceneDoor>;
      sceneRooms: SceneRoom[];
      getSelectedDoorId: () => string | null;
      setSelectedDoorId: (doorId: string | null) => void;
      getSelectedRoomId: () => string | null;
      setSelectedRoomId: (roomId: string | null) => void;
      setPreviewPath: (path: Cell[]) => void;
      setPreviewRoomCells: (cells: Cell[]) => void;
      setPreviewWallEdges: (edges: WallEdge[]) => void;
    },
    private readonly queries: {
      canInspectDoor: () => boolean;
      canInspectRoom: () => boolean;
      getSelectedDoor: () => SceneDoor | null;
      getSelectedRoom: () => SceneRoom | null;
    },
    private readonly actions: {
      selectRoom: (roomId: string | null) => void;
      updateSelectionPanel: () => void;
    },
    private readonly network: {
      sendDoorChanged: (door: SceneDoor) => void;
      sendDoorDeleted: (type: WallEdgeType, x: number, y: number) => void;
      sendBlockedEdgeChanged: (type: WallEdgeType, x: number, y: number, blocked: boolean) => void;
      sendBlockedEdgesCleared: () => void;
      sendRoomUpdated: (room: SceneRoom) => void;
      sendRoomDeleted: (roomId: string) => void;
    },
  ) {}

  toggleDoorAtEdge(edge: { type: WallEdgeType; x: number; y: number }): void {
    const id = doorId(edge);
    const existingDoor = this.state.sceneDoors.get(id);

    if (existingDoor) {
      this.state.sceneDoors.delete(id);
      if (this.state.getSelectedDoorId() === id) {
        this.state.setSelectedDoorId(null);
      }
      this.state.setPreviewPath([]);
      this.actions.updateSelectionPanel();
      this.network.sendDoorDeleted(edge.type, edge.x, edge.y);
      return;
    }

    const door: SceneDoor = { ...edge, isOpen: true };
    const wallSet = blockedEdgeSet(edge.type, this.state.blockedVerticalEdges, this.state.blockedHorizontalEdges);
    const wallKey = edgeKey(edge);
    if (wallSet.delete(wallKey)) {
      this.network.sendBlockedEdgeChanged(edge.type, edge.x, edge.y, false);
    }

    this.state.sceneDoors.set(id, door);
    this.state.setPreviewPath([]);
    this.network.sendDoorChanged(door);
  }

  applyWallEdges(edges: WallEdge[], blocked: boolean): void {
    if (edges.length === 0) {
      return;
    }

    const affectedRooms = blocked ? [] : this.roomsAffectedByWallDeletion(edges);
    if (!this.confirmWallDeletionAffectedRooms(affectedRooms)) {
      return;
    }

    this.deleteRooms(affectedRooms);

    for (const edge of edges) {
      const wallSet = blockedEdgeSet(edge.type, this.state.blockedVerticalEdges, this.state.blockedHorizontalEdges);
      const wallKey = edgeKey(edge);

      if (blocked) {
        const doorIdAtEdge = doorId(edge);
        if (this.state.sceneDoors.delete(doorIdAtEdge)) {
          if (this.state.getSelectedDoorId() === doorIdAtEdge) {
            this.state.setSelectedDoorId(null);
          }
          this.network.sendDoorDeleted(edge.type, edge.x, edge.y);
        }

        if (!wallSet.has(wallKey)) {
          wallSet.add(wallKey);
          this.network.sendBlockedEdgeChanged(edge.type, edge.x, edge.y, true);
        }
      } else if (wallSet.delete(wallKey)) {
        this.network.sendBlockedEdgeChanged(edge.type, edge.x, edge.y, false);
      }
    }

    this.state.setPreviewPath([]);
    this.actions.updateSelectionPanel();
  }

  updateSelectedDoorState(isOpen: boolean): void {
    const door = this.queries.getSelectedDoor();
    if (!door || !this.queries.canInspectDoor() || door.isOpen === isOpen) {
      return;
    }

    door.isOpen = isOpen;
    this.state.setPreviewPath([]);
    this.network.sendDoorChanged(door);
    this.actions.updateSelectionPanel();
  }

  selectRoomFromCells(cells: Cell[]): void {
    if (cells.length === 0) {
      return;
    }

    const existingRoom = findRoomByCells(this.state.sceneRooms, cells);
    if (existingRoom) {
      this.actions.selectRoom(existingRoom.id);
      return;
    }

    const room: SceneRoom = {
      id: `room-${crypto.randomUUID()}`,
      name: "",
      cells: cells.map((cell) => ({ ...cell })),
    };

    this.state.sceneRooms.push(room);
    this.state.setPreviewRoomCells([]);
    this.actions.selectRoom(room.id);
    this.network.sendRoomUpdated(room);
  }

  updateSelectedRoomName(name: string): void {
    const room = this.queries.getSelectedRoom();
    if (!room || !this.queries.canInspectRoom()) {
      return;
    }

    const nextName = name.trim().slice(0, 32);
    if (room.name === nextName) {
      return;
    }

    room.name = nextName;
    this.network.sendRoomUpdated(room);
    this.actions.updateSelectionPanel();
  }

  deleteSelectedRoom(): void {
    const selectedRoom = this.queries.getSelectedRoom();
    if (!selectedRoom || !this.queries.canInspectRoom()) {
      return;
    }

    const roomIndex = this.state.sceneRooms.findIndex((room) => room.id === selectedRoom.id);
    if (roomIndex === -1) {
      return;
    }

    this.state.sceneRooms.splice(roomIndex, 1);
    this.state.setSelectedRoomId(null);
    this.state.setPreviewRoomCells([]);
    this.actions.updateSelectionPanel();
    this.network.sendRoomDeleted(selectedRoom.id);
  }

  clearBlockingLayer(): void {
    const shouldClearWalls = window.confirm("确定要清空所有阻挡边、门和房间吗？此操作会同步到所有客户端。");
    if (!shouldClearWalls) {
      return;
    }

    this.deleteRooms([...this.state.sceneRooms]);
    this.state.blockedVerticalEdges.clear();
    this.state.blockedHorizontalEdges.clear();
    this.state.sceneDoors.clear();
    this.state.setSelectedDoorId(null);
    this.state.setSelectedRoomId(null);
    this.state.setPreviewPath([]);
    this.state.setPreviewRoomCells([]);
    this.state.setPreviewWallEdges([]);
    this.actions.updateSelectionPanel();
    this.network.sendBlockedEdgesCleared();
  }

  private roomsAffectedByWallDeletion(edges: WallEdge[]): SceneRoom[] {
    const affectedRooms = new Map<string, SceneRoom>();

    for (const edge of edges) {
      const wallSet = blockedEdgeSet(edge.type, this.state.blockedVerticalEdges, this.state.blockedHorizontalEdges);
      if (!wallSet.has(edgeKey(edge))) {
        continue;
      }

      const [firstCell, secondCell] = cellsBesideWallEdge(edge);
      const firstRoom = this.roomAtCell(firstCell);
      const secondRoom = this.roomAtCell(secondCell);
      if (firstRoom && secondRoom && firstRoom.id === secondRoom.id) {
        continue;
      }

      if (firstRoom) {
        affectedRooms.set(firstRoom.id, firstRoom);
      }
      if (secondRoom) {
        affectedRooms.set(secondRoom.id, secondRoom);
      }
    }

    return [...affectedRooms.values()];
  }

  private confirmWallDeletionAffectedRooms(rooms: SceneRoom[]): boolean {
    if (rooms.length === 0) {
      return true;
    }

    const roomList = rooms.map((room) => `- ${roomDisplayName(room)}`).join("\n");
    return window.confirm(`删除这堵墙会一并删除以下房间：\n${roomList}\n\n确定要继续吗？`);
  }

  private deleteRooms(rooms: SceneRoom[]): void {
    const roomIds = new Set(rooms.map((room) => room.id));
    if (roomIds.size === 0) {
      return;
    }

    for (let index = this.state.sceneRooms.length - 1; index >= 0; index -= 1) {
      const room = this.state.sceneRooms[index];
      if (!roomIds.has(room.id)) {
        continue;
      }

      this.state.sceneRooms.splice(index, 1);
      this.network.sendRoomDeleted(room.id);
    }

    if (this.state.getSelectedRoomId() && roomIds.has(this.state.getSelectedRoomId() ?? "")) {
      this.state.setSelectedRoomId(null);
    }
    this.state.setPreviewRoomCells([]);
  }

  private roomAtCell(targetCell: Cell): SceneRoom | null {
    return [...this.state.sceneRooms].reverse().find((room) => room.cells.some((cell) => sameCell(cell, targetCell))) ?? null;
  }
}
