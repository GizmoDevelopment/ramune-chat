// Modules
import { Server as ioServer, Socket } from "socket.io";
import { getAuthenticatedUser } from "gizmo-api";

// Classes
import Service from "@classes/Service";
import PoopShitter from "@classes/PoopShitter";

// Utils
import logger from "@utils/logger";
import { createResponse } from "@utils/essentials";
import { constructMessage } from "@utils/message";

// Types
import { User } from "gizmo-api/lib/types";
import { SocketCallback } from "@typings/main";
import { PartialRoom, Room, RoomOptions, RoomSyncData } from "@typings/room";
import RoomService from "./room";
import { getEpisodeById, getShow } from "@utils/ramune";
import { Message, MessagePayload } from "@typings/message";

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
	private readonly userIdToSocketIdMap: Record<string, string> = {};

	constructor (cluster: PoopShitter) {

		super("websocket", cluster);

		this.ioServer = new ioServer(WEBSOCKET_PORT, {
			cors: {
				origin: CORS_ORIGIN_DOMAIN,
				methods: [ "GET", "POST" ]
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

					// Prevent the same user from connecting twice
					if (!this.userIdToSocketIdMap[user.id]) {

						this.addAuthenticatedUser(socket, user);

						callback(createResponse<User>("success", user));

						logger.info(`[S-${socket.id}] [${user.username}] Successfully authenticated`);
					} else {
						callback(createResponse("error", "You are already connected somewhere else."));
					}

				} catch (err) {
					callback(createResponse("error", "Something went wrong."));
				}

			} else {
				callback(createResponse("error", "User token is required."));
			}
		});

		socket.on("CLIENT:FETCH_ROOMS", async (callback: SocketCallback<PartialRoom[]>) => {

			const user = this.getAuthenticatedUser(socket);

			if (!user)
				return callback(createResponse("error", "You must be authenticated."));

			const roomService: RoomService = this.cluster.getService("room");

			callback(createResponse("success", roomService.getRooms()));
		});

		socket.on("CLIENT:CREATE_ROOM", async (options: RoomOptions | any, callback: SocketCallback<Room>) => {

			const user = this.getAuthenticatedUser(socket);

			if (!user)
				return callback(createResponse("error", "You must be authenticated."));

			/**
			 * - check if room exists
			 * - check if user is already in room & leave if so
			 * - create room
			 * - add user as host
			 */

			if (typeof options.name === "string") {
				if (options.name.trim().length > 0) {
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
					callback(createResponse("error", "Room name cannot be empty."));
				}
			} else {
				callback(createResponse("error", "Invalid room data."));
			}
		});

		socket.on("CLIENT:JOIN_ROOM", async (roomId: string | any, callback: SocketCallback<Room>) => {

			const user = this.getAuthenticatedUser(socket);

			if (!user)
				return callback(createResponse("error", "You must be authenticated."));

			/**
			 * - check if room exists
			 * - leave the room the user is currently in
			 * - join room
			 */

			if (typeof roomId === "string") {

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
				callback(createResponse("error", "Invalid RoomID"));
			}
		});

		socket.on("CLIENT:LEAVE_ROOM", async (callback: SocketCallback<string>) => {

			const user = this.getAuthenticatedUser(socket);

			if (!user)
				return callback(createResponse("error", "You must be authenticated."));

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
		});

		socket.on("CLIENT:UPDATE_ROOM_DATA", async (roomData: InputRoomData | any, callback: SocketCallback<string>) => {

			const user = this.getAuthenticatedUser(socket);

			if (!user)
				return callback(createResponse("error", "You must be authenticated."));

			/**
			 * - check whether the user is in a room
			 * - check whether the user is the room host
			 * - validate `roomData`
			 * - fetch show and send RoomData to everyone with ROOM:UPDATE_DATA
			 */

			if (typeof roomData?.showId === "string" && typeof roomData?.episodeId === "number") {

				const
					roomService: RoomService = this.cluster.getService("room"),
					currentRoom = roomService.getUserCurrentRoom(user);

				if (currentRoom) {
					if (currentRoom.host.id === user.id) {

						// Same show already picked, just search through saved show
						if (currentRoom.data && currentRoom.data.show.id === roomData.showId) {

							const episode = getEpisodeById(currentRoom.data.show, roomData.episodeId);

							// Episode exists, just push episodeId to other clients
							if (episode) {

								roomService.updateRoomData(currentRoom, {
									show: currentRoom.data.show,
									episodeId: roomData.episodeId
								});

								return callback(createResponse("success", "Successfully updated data."));
							}
						}

						// If the episode couldn't be found, re-fetch the entire show
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
						callback(createResponse("error", "You aren't the room host."));
					}
				} else {
					callback(createResponse("error", "You aren't in a room."));
				}
			} else {
				callback(createResponse("error", "Invalid room data."));
			}
		});

		socket.on("CLIENT:SYNC_ROOM", async (syncData: RoomSyncData | any, callback: SocketCallback<string>) => {

			const user = this.getAuthenticatedUser(socket);

			if (!user)
				return callback(createResponse("error", "You must be authenticated."));

			/**
			 * - check whether the user is in a room
			 * - check whether the user is the room host
			 * - validate `syncData`
			 * - send RoomSyncData to everyone with ROOM:SYNC
			 */

			if (typeof syncData?.currentTime === "number" && typeof syncData?.playing === "boolean") {

				const
					roomService: RoomService = this.cluster.getService("room"),
					currentRoom = roomService.getUserCurrentRoom(user);

				if (currentRoom) {
					if (currentRoom.host.id === user.id) {

						roomService.syncRoom(currentRoom, {
							currentTime: syncData.currentTime,
							playing: syncData.playing
						}, socket);

						callback(createResponse("success", "Successfully synced room."));

					} else {
						callback(createResponse("error", "You aren't the room host."));
					}
				} else {
					callback(createResponse("error", "You aren't in a room."));
				}

			} else {
				callback(createResponse("error", "Invalid room sync data."));
			}
		});

		socket.on("CLIENT:SEND_MESSAGE", async (data: MessagePayload | any, callback: SocketCallback<Message>) => {

			const user = this.getAuthenticatedUser(socket);

			if (!user)
				return callback(createResponse("error", "You must be authenticated."));

			if (typeof data?.content === "string") {
				if (data.content.trim().length > 0) {

					const
						roomService: RoomService = this.cluster.getService("room"),
						currentRoom = roomService.getUserCurrentRoom(user);

					if (currentRoom) {

						const message = constructMessage(user, data.content);

						if (message.content.length > 0) {
							socket.to(currentRoom.id).emit("ROOM:MESSAGE", message);
							callback(createResponse("success", message));
						} else {
							callback(createResponse("error", "You cannot send an empty message."));
						}

					} else {
						callback(createResponse("error", "You aren't in a room."));
					}
				} else {
					callback(createResponse("error", "You cannot send an empty message."));
				}
			} else {
				callback(createResponse("error", "Invalid message payload."));
			}
		});

		socket.on("CLIENT:FETCH_ONLINE_USERS", async (callback: SocketCallback<User[]>) => {
			callback(createResponse("success", Array.from(this.sockets.values())));
		});

		socket.on("CLIENT:KICK_USER", async (userId: number|any, callback: SocketCallback<string>) => {

			const user = this.getAuthenticatedUser(socket);

			if (!user)
				return callback(createResponse("error", "You must be authenticated."));

			if (typeof userId === "number") {

				const
					roomService: RoomService = this.cluster.getService("room"),
					currentRoom = roomService.getUserCurrentRoom(user);

				if (currentRoom) {
					if (currentRoom.host.id === user.id) {

						const
							targetUser = currentRoom.users.find((user: User) => user.id === userId),
							targetSocketId = targetUser && this.userIdToSocketIdMap[targetUser?.id];

						if (targetUser && targetSocketId) {

							const targetSocket = this.ioServer.sockets.sockets.get(targetSocketId);

							if (targetSocket) {

								roomService.leaveRoom(currentRoom, targetUser, targetSocket);

								callback(createResponse("success", "Successfully kicked user."));
							} else {
								callback(createResponse("error", "Something went wrong."));
							}
						} else {
							callback(createResponse("error", "The target user isn't in the room."));
						}
					} else {
						callback(createResponse("error", "You aren't the room host."));
					}
				} else {
					callback(createResponse("error", "You aren't in a room."));
				}
			} else {
				callback(createResponse("error", "Invalid UserID."));
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

				this.removeAuthenticatedUser(socket, user);
			}

			logger.info(`[S-${ socket.id }] Socket disconnected with reason '${ reason }'`);
		});
	}

	private addAuthenticatedUser (socket: Socket, user: User) {
		this.userIdToSocketIdMap[user.id] = socket.id;
		this.sockets.set(socket.id, user);
	}

	private getAuthenticatedUser (socket: Socket): User | null {
		return this.sockets.get(socket.id) || null;
	}

	private removeAuthenticatedUser (socket: Socket, user: User) {
		delete this.userIdToSocketIdMap[user.id];
		this.sockets.delete(socket.id);
	}

}

export default WebsocketService;
