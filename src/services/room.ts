// Classes
import Cluster from "@classes/Cluster";
import Service from "@classes/Service";

// Types
import { Room } from "@typings/room";
import { User } from "gizmo-api/lib/types";

class RoomService extends Service {

	rooms: Map<string, Room> = new Map();
	userToRoomMap: Record<string, string> = {};

	constructor (cluster: Cluster) {
		super("room", cluster);
	}

	addRoom (room: Room) {
		this.rooms.set(room.id, room);
	}

	getRoom (roomId: string): Room | null {
		return this.rooms.get(roomId) || null;
	}

	getRooms (): Room[] {
		return Array.from(this.rooms.values());
	}

	getUserCurrentRoom (user: User): Room | null {
		if (this.userToRoomMap[user.id]) {
			
			const room = this.getRoom(this.userToRoomMap[user.id]);

			if (room) {
				return room;
			} else {
				return null;
			}

		} else {
			return null;
		}
	}

	joinRoom (user: User, room: Room) {
		room.join(user);
	}

	leaveRoom (user: User, room: Room) {
		room.leave(user);
	}

}

export default RoomService;