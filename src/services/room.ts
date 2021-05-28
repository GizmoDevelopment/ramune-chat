// Classes
import Cluster from "@classes/Cluster";
import Service from "@classes/Service";
import WebsocketService from "./websocket";

// Types
import { Room } from "@typings/room";
import { User } from "gizmo-api/lib/types";

class RoomService extends Service {

	rooms: Map<string, Room> = new Map();
	userToRoomMap: Record<string, string> = {};

	constructor (cluster: Cluster) {
		super("room", cluster);
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

	createRoom (name: string, host: User) {

		const wsService = this.cluster.services.get("websocket");

		if (wsService instanceof WebsocketService) {
		
			const room = new Room(name, host, wsService);
			
			this.rooms.set(room.id, room);

		}

	}

}

export default RoomService;