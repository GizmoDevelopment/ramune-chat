// Modules
import { v4 as uuidv4 } from "uuid";

// Types
import { Room, RoomOptions } from "@typings/room";
import { User } from "gizmo-api/lib/types";

// Variables
const rooms: Map<string, Room> = new Map();

export function createRoom (host: User, options: RoomOptions): Room {

	const room = {
		id: uuidv4(),
		name: options.name,
		host: host,
		users: [ host ],
		data: null
	};

	rooms.set(room.id, room);

	return room;
}

export function destroyRoom (roomId: string) {
	rooms.delete(roomId);
}

export function addUserToRoom (room: Room, user: User): Room {
	if 
}

export function removeUserFromRoom (room: Room, user: User): Room {

	room.users = room.users.filter(_user => _user.id !== user.id);

	return room;
}

export function getRooms (): Room[] {
	return Array.from(rooms.values());
}

export function getRoom (roomId: string): Room | null {
	return rooms.get(roomId) || null;
}