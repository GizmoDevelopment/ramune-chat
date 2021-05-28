// Classes
import Cluster from "@classes/Cluster";
import Service from "@classes/Service";

// Types
import { Room } from "@typings/room";

class RoomService extends Service {

	rooms: Map<string, Room> = new Map();

	constructor (cluster: Cluster) {
		super("room", cluster);
	}

	addRoom (room: Room) {
		this.rooms.set(room.id, room);
	}

	removeRoom (room: Room) {
		this.rooms.delete(room.id);
	}

	roomExists (roomId: string): boolean {
		return this.rooms.has(roomId);
	}

	getRoom (roomId: string): Room | null {
		return this.rooms.get(roomId) || null;
	}

	getRooms (): Room[] {
		return Array.from(this.rooms.values());
	}

}

export default RoomService;