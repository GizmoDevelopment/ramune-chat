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
import { User } from "gizmo-api/lib/typings/user";
import { SocketCallback } from "@typings/main";
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

		this.ioServer.sockets.on("connection", this.handleSocketConnection.bind(this));

		process.once("SIGINT", () => {
			this.ioServer.close();
		});

		logger.success(`Successfully started WebSocket server on port '${ WEBSOCKET_PORT }'`);
		this.emit("ready");
	}

	private handleSocketConnection (socket: Socket) {

		logger.info(`[S-${ socket.id }] Socket connected`);
	
		socket.on("CLIENT:AUTHENTICATE", async (data: { token?: any }, callback: SocketCallback<User>) => {
			if (typeof data.token === "string") {

				try {
	
					const user = await getAuthenticatedUser(data.token);
	
					this.addAuthenticatedUser(socket, user);
				
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
				
				const roomService: RoomService = this.cluster.getService("room");

				callback(createResponse("success", roomService.getRooms()));

			} else {
				callback(createResponse("error", "You must be authenticated."));
			}
		});

		socket.on("CLIENT:CREATE_ROOM", async (options: RoomOptions, callback: SocketCallback<Room>) => {

			const user = this.getAuthenticatedUser(socket);

			if (user) {

				/**
				 * - check if room exists
				 * - check if user is already in room & leave if so
				 * - create room
				 * - add user as host
				 */

				if (typeof options.name === "string") {

					const
						roomService: RoomService = this.cluster.getService("room"),
						_targetRoom = roomService.getRoomByName(options.name);

					if (!_targetRoom) {

						const currentRoom = roomService.getUserCurrentRoom(user);

						if (currentRoom) {
							roomService.leaveRoom(currentRoom, user, socket);
						}

						// Create & join
						let newRoom = roomService.createRoom(options, user);
						newRoom = roomService.joinRoom(newRoom, user, socket);

						callback(createResponse("success", newRoom));

					} else {
						callback(createResponse("error", "Room already exists."));
					}

				} else {
					callback(createResponse("error", "Invalid room data."));
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

				const
					roomService: RoomService = this.cluster.getService("room"),
					targetRoom = roomService.getRoom(roomId);

				if (targetRoom) {

					const currentRoom = roomService.getUserCurrentRoom(user);

					if (currentRoom) {
						roomService.leaveRoom(currentRoom, user, socket);
					}

					const newRoom = roomService.joinRoom(targetRoom, user, socket);

					callback(createResponse("success", newRoom));
				} else {
					callback(createResponse("error", "Room doesn't exist."));
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

				const
					roomService: RoomService = this.cluster.getService("room"),
					currentRoom = roomService.getUserCurrentRoom(user);

				if (currentRoom) {

					roomService.leaveRoom(currentRoom, user, socket);

					callback(createResponse("success", "Successfully left room."));

				} else {
					callback(createResponse("error", "You aren't in a room."));
				}

			} else {
				callback(createResponse("error", "You must be authenticated."));
			}
		});

		socket.on("CLIENT:UPDATE_ROOM_DATA", async (roomData: InputRoomData, callback: SocketCallback<string>) => {

			const user = this.getAuthenticatedUser(socket);

			if (user) {

				/**
				 * - check whether the user is in a room
				 * - check whether the user is the room host
				 * - validate `roomData`
				 * - fetch show and send RoomData to everyone with ROOM:UPDATE_DATA 
				 */

				const
					roomService: RoomService = this.cluster.getService("room"),
					currentRoom = roomService.getUserCurrentRoom(user);

				if (currentRoom) {
					if (currentRoom.host.id === user.id) {
						if (typeof roomData.showId === "string" && typeof roomData.episodeId === "number") {

							const show = await getShow(roomData.showId);

							if (show) {

								roomService.updateRoomData(currentRoom, {
									show,
									episodeId: roomData.episodeId
								});

								callback(createResponse("success", "Successfully updated data."));

							} else {
								callback(createResponse("error", "Couldn't fetch show."));
							}

						} else {
							callback(createResponse("error", "Invalid room data."));
						}
					} else {
						callback(createResponse("error", "You aren't the room host."));
					}
				} else {
					callback(createResponse("error", "You aren't in a room."));
				}

			} else {
				callback(createResponse("error", "You must be authenticated."));
			}
		});

		socket.on("CLIENT:SYNC_ROOM", async (syncData: RoomSyncData, callback: SocketCallback<string>) => {

			const user = this.getAuthenticatedUser(socket);

			if (user) {

				/**
				 * - check whether the user is in a room
				 * - check whether the user is the room host
				 * - validate `syncData`
				 * - send RoomSyncData to everyone with ROOM:SYNC
				 */

				const
					roomService: RoomService = this.cluster.getService("room"),
					currentRoom = roomService.getUserCurrentRoom(user);

				if (currentRoom) {
					if (currentRoom.host.id === user.id) {
						if (typeof syncData.currentTime === "number" && typeof syncData.playing === "boolean") {

							roomService.syncRoom(currentRoom, {
								currentTime: syncData.currentTime,
								playing: syncData.playing
							}, socket);

							callback(createResponse("success", "Successfully synced room."));

						} else {
							callback(createResponse("error", "Invalid room sync data."));
						}
					} else {
						callback(createResponse("error", "You aren't the room host."));
					}
				} else {
					callback(createResponse("error", "You aren't in a room."));
				}

			} else {
				callback(createResponse("error", "You must be authenticated."));
			}
		});

		socket.on("disconnect", (reason: string) => {

			const user = this.getAuthenticatedUser(socket);

			if (user) {

				const
					roomService: RoomService = this.cluster.getService("room"),
					currentRoom = roomService.getUserCurrentRoom(user);

				if (currentRoom) {
					roomService.leaveRoom(currentRoom, user, socket);
				}

			}

			logger.info(`[S-${ socket.id }] Socket disconnected with reason '${ reason }'`);
		})
	;
	}

	private addAuthenticatedUser (socket: Socket, user: User) {
		this.sockets.set(socket.id, user);
	}

	private getAuthenticatedUser (socket: Socket): User | null {
		return this.sockets.get(socket.id) || null;
	}

}

export default WebsocketService;
