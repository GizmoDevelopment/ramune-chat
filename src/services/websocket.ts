// Modules
import { Server as ioServer, Socket } from "socket.io";
import { getAuthenticatedUser } from "gizmo-api";

// Classes
import Service from "@classes/Service";
import PoopShitter from "@classes/PoopShitter";

// Utils
import logger from "@utils/logger";
import { createResponse } from "@utils/essentials";

// Types
import { User } from "gizmo-api/lib/types";
import { SocketCallback, SocketErrorCallback } from "@typings/main";
import { Room, RoomOptions, RoomSyncData } from "@typings/room";
import RoomService from "./room";
import { getShow } from "@utils/ramune";

interface InputRoomData {
	showId: string;
	episodeId: number;
}

// Constants
const WEBSOCKET_PORT = Number(process.env.WEBSOCKET_PORT);
const CORS_ORIGIN_DOMAIN = process.env.CORS_ORIGIN_DOMAIN;

class WebsocketService extends Service {

	readonly ioServer: ioServer;
	private readonly sockets: Map<string, User> = new Map();

	constructor (cluster: PoopShitter) {

		super("websocket", cluster);
		
		this.ioServer = new ioServer(WEBSOCKET_PORT, {
			cors: {
				origin: CORS_ORIGIN_DOMAIN,
				credentials: true
			}
		});

		this.ioServer.sockets.on("connection", this.handleSocketConnection);

		process.once("SIGINT", () => {
			this.ioServer.close();
		});

		this.emit("ready");
		logger.success(`Successfully started WebSocket server on port '${ WEBSOCKET_PORT }'`);
	}

	private handleSocketConnection (socket: Socket) {

		logger.info(`[S-${ socket.id }] Socket connected`);
	
		socket.on("CLIENT:AUTHENTICATE", async (data: { token?: any }, callback: SocketCallback<User>) => {
			if (typeof data.token === "string") {
	
				try {
	
					const user = await getAuthenticatedUser(data.token);
	
					this.addUser(socket, user);
				
					callback(createResponse<User>("success", user));
	
					logger.info(`[S-${ socket.id }] [${ user.username }] Successfully authenticated`);
	
				} catch (err) {
					callback(createResponse("error", "Something went wrong."));
				}
	
			} else {
				callback(createResponse("error", "User token is required."));
			}
		});
	
		socket.on("CLIENT:FETCH_ROOMS", async (callback: SocketCallback<Room[]>) => {

			const user = this.getAuthenticatedUser(socket);

			if (user) {

				const roomService = this.cluster.getService("room");

				if (roomService instanceof RoomService) {
					callback(createResponse("success", roomService.getRooms()));
				} else {
					callback(createResponse("error", "Room service currently isn't available."));
				}

			} else {
				callback(createResponse("error", "You must be authenticated."));
			}
		});

		socket.on("CLIENT:CREATE_ROOM", async (options: RoomOptions, callback: SocketCallback<Room>) => {

			const user = this.getAuthenticatedUser(socket);

			if (user) {

				/**
				 * - check if user is already in room
				 * - check if room exists
				 * - create room
				 * - add user as host
				 */

				const roomService = this.cluster.getService("room");

				if (roomService instanceof RoomService) {
					
					const { name: roomName }: { name: string } = options;

					if (typeof roomName === "string") {

						const _room = roomService.getRoom(roomName);

						if (!_room) {

							const currentRoom = roomService.getUserCurrentRoom(user);

							if (currentRoom) {
								socket.leave(currentRoom.id);
								currentRoom.leave(user);
							}

							const newRoom = roomService.createRoom(roomName, user);

							if (newRoom) {

								newRoom.join(user);
								socket.join(newRoom.id);

								callback(createResponse("success", newRoom));
							} else {
								callback(createResponse("error", "Something went wrong."));
							}

						} else {
							callback(createResponse("error", "Room already exists."));
						}

					} else {
						callback(createResponse("error", "Invalid room name."));
					}

				} else {
					callback(createResponse("error", "Room service currently isn't available."));
				}

			} else {
				callback(createResponse("error", "You must be authenticated."));
			}
		});
	
		socket.on("CLIENT:JOIN_ROOM", async (roomId: string, callback: SocketCallback<Room>) => {
			
			const user = this.getAuthenticatedUser(socket);

			if (user) {

				/**
				 * - check if room exists
				 * - leave the room the user is currently in
				 * - join room
				 */

				const roomService = this.cluster.getService("room");

				if (roomService instanceof RoomService) {

					const room = roomService.getRoom(roomId);

					if (room) {

						const currentRoom = roomService.getUserCurrentRoom(user);

						if (currentRoom) {
							socket.leave(currentRoom.id);
							currentRoom.leave(user);
						}

						room.join(user);
						socket.join(room.id);

						callback(createResponse("success", room));

					} else {
						callback(createResponse("error", "Room doesn't exist."));
					}

				} else {
					callback(createResponse("error", "Room service currently isn't available."));
				}

			} else {
				callback(createResponse("error", "You must be authenticated."));
			}
		});

		socket.on("CLIENT:LEAVE_ROOM", async (callback: SocketCallback<string>) => {

			const user = this.getAuthenticatedUser(socket);
			
			if (user) {

				/**
				 * - get user's current room and leave it
				 * - send ROOM:USER_LEAVE to all other roommates
				 * - promote first roommate on list to host using ROOM:UPDATE
				 * - if room is empty, remove it
				 */

				const roomService = this.cluster.getService("room");

				if (roomService instanceof RoomService) {

					const currentRoom = roomService.getUserCurrentRoom(user);

					if (currentRoom) {

						socket.leave(currentRoom.id);
						currentRoom.leave(user);

						callback(createResponse("success", "Successfully left room."));

					} else {
						callback(createResponse("error", "You aren't in any rooms."));
					}

				} else {
					callback(createResponse("error", "Room service currently isn't available."));
				}

			} else {
				callback(createResponse("error", "You must be authenticated."));
			}
		});

		socket.on("CLIENT:UPDATE_ROOM_DATA", async (roomData: InputRoomData, callback: SocketErrorCallback) => {

			const user = this.getAuthenticatedUser(socket);

			if (user) {

				/**
				 * - check whether the user is in a room
				 * - check whether the user is the room host
				 * - validate `roomData`
				 * - fetch show and send RoomData to everyone with ROOM:UPDATE_DATA 
				 */

				const roomService = this.cluster.getService("room");

				if (roomService instanceof RoomService) {

					const room = roomService.getUserCurrentRoom(user);

					if (room) {

						if (room.host.id === user.id) {

							if (typeof roomData.showId === "string" && typeof roomData.episodeId === "number") {

								const show = await getShow(roomData.showId);

								if (show) {

									room.updateData({
										show,
										episodeId: roomData.episodeId
									});
	
								} else {
									callback(createResponse("error", "Show doesn't exist."));
								}

							} else {
								callback(createResponse("error", "Invalid room data."));
							}

						} else {
							callback(createResponse("error", "You aren't the host."));
						}
						
					} else {
						callback(createResponse("error", "You aren't in a room."));
					}

				} else {
					callback(createResponse("error", "Room service currently isn't available."));
				}

			} else {
				callback(createResponse("error", "You must be authenticated."));
			}
		});

		socket.on("CLIENT:SYNC_ROOM", async (syncData: RoomSyncData, callback: SocketErrorCallback) => {

			const user = this.getAuthenticatedUser(socket);

			if (user) {

				/**
				 * - check whether the user is in a room
				 * - check whether the user is the room host
				 * - validate `syncData`
				 * - send RoomSyncData to everyone with ROOM:SYNC
				 */

				const roomService = this.cluster.getService("room");

				if (roomService instanceof RoomService) {

					const room = roomService.getUserCurrentRoom(user);

					if (room) {

						if (room.host.id === user.id) {

							if (typeof syncData.currentTime === "number" && typeof syncData.playing === "boolean") {

								syncData = {
									currentTime: syncData.currentTime,
									playing: syncData.playing
								};

								socket.to(room.id).emit("ROOM:SYNC", syncData);

							} else {
								callback(createResponse("error", "Invalid sync data."));
							}

						} else {
							callback(createResponse("error", "You aren't the host."));
						}
						
					} else {
						callback(createResponse("error", "You aren't in a room."));
					}

				} else {
					callback(createResponse("error", "Room service currently isn't available."));
				}

			} else {
				callback(createResponse("error", "You must be authenticated."));
			}
		});
	
	}

	private addUser (socket: Socket, user: User) {
		this.sockets.set(socket.id, user);
	}

	private isAuthenticated (socket: Socket) {
		return this.sockets.has(socket.id);
	}

	private getAuthenticatedUser (socket: Socket): User | null {
		return this.sockets.get(socket.id) || null;
	}

}

export default WebsocketService;