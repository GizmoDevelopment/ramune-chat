// Modules
import { Server as ioServer } from "socket.io";
import { v4 as uuidv4 } from "uuid";

// Classes
import PoopShitter from "@classes/PoopShitter";
import Service from "@classes/Service";
import WebsocketService from "./websocket";

// Utils
import logger from "@utils/logger";
import { sanitize } from "@utils/essentials";

// Types
import { User } from "gizmo-api/lib/types";
import { PartialRoom, Room, RoomData, RoomOptions, RoomSyncData, UpdatableRoomProperties } from "@typings/room";
import { Socket } from "socket.io";

class RoomService extends Service {

	rooms: Map<string, Room> = new Map();
	userIdToRoomIdMap: Record<string, string> = {};
	roomNameToRoomIdMap: Record<string, string> = {};

	get ioServer (): ioServer {
		return (this.cluster.getService("websocket") as WebsocketService).ioServer;
	}

	constructor (cluster: PoopShitter) {
		super("room", cluster);
	}

	getRooms (): PartialRoom[] {
		return Array.from(this.rooms.values()).map((room: Room) => {
			return {
				id: room.id,
				name: room.name,
				host: room.host,
				users: room.users
			};
		});
	}

	getRoom (roomId: string): Room | null {
		return this.rooms.get(roomId) || null;
	}

	getRoomByName (roomName: string): Room | null {

		const roomId = this.roomNameToRoomIdMap[roomName];

		if (roomId) {
			return this.getRoom(roomId);
		} else {
			return null;
		}
	}

	getUserCurrentRoom (user: User): Room | null {

		const roomId = this.userIdToRoomIdMap[user.id];

		if (roomId) {
			return this.rooms.get(roomId) || null;
		} else {
			return null;
		}
	}

	createRoom (options: RoomOptions, user: User): Room {

		const room: Room = {
			id: uuidv4(),
			name: sanitize(options.name),
			host: user,
			users: [],
			data: null
		};

		this.rooms.set(room.id, room);
		this.roomNameToRoomIdMap[room.name] = room.id;

		logger.info(`[R-${room.id}] [${user.username}] Created room`);
		return room;
	}

	deleteRoom (room: Room) {

		delete this.roomNameToRoomIdMap[room.name];
		this.rooms.delete(room.id);

		logger.info(`[R-${ room.id }] Room deleted`);
	}

	joinRoom (room: Room, user: User, socket: Socket): Room {

		this.userIdToRoomIdMap[user.id] = room.id;

		// Make sure the user can't duplicate
		room.users = room.users.filter(_user => _user.id !== user.id);
		room.users.push(user);

		this.rooms.set(room.id, room);

		// Broadcast
		this.ioServer.to(room.id).emit("ROOM:USER_JOIN", user);
		socket.join(room.id);

		logger.info(`[R-${ room.id }] [${ user.username }] Joined room`);
		return room;
	}

	leaveRoom (room: Room, user: User, socket: Socket) {

		delete this.userIdToRoomIdMap[user.id];

		room.users = room.users.filter(_user => _user.id !== user.id);
		this.rooms.set(room.id, room);

		// Broadcast
		this.ioServer.to(room.id).emit("ROOM:USER_LEAVE", user);
		socket.leave(room.id);

		// If the host left, promote first user to host
		if (room.host.id === user.id) {
			this.updateRoom(room, { host: room.users[0] });
		}

		logger.info(`[R-${ room.id }] [${ user.username }] Left room`);

		if (room.users.length === 0) {
			this.deleteRoom(room);
		}
	}

	updateRoom (room: Room, data: UpdatableRoomProperties) {

		const { host: newHost } = data;

		if (newHost) {
			room.host = newHost;
		}

		// Broadcast
		this.ioServer.to(room.id).emit("ROOM:UPDATE", data);

		logger.info(`[R-${room.id}] Updated room with '${ JSON.stringify(data) }'`);
	}

	updateRoomData (room: Room, data: RoomData) {

		room.data = data;
		this.rooms.set(room.id, room);

		// Broadcast
		this.ioServer.to(room.id).emit("ROOM:UPDATE_ROOM_DATA", data);

		logger.info(`[R-${ room.id }] Updated room data with '${ JSON.stringify({ show: data.show.title, episodeId: data.episodeId }) }'`);
	}

	syncRoom (room: Room, data: RoomSyncData, socket: Socket) {

		// Broadcast
		socket.to(room.id).emit("ROOM:SYNC", data);

		logger.info(`[R-${room.id}] Synced room with data '${ JSON.stringify(data) }'`);
	}

}

export default RoomService;
