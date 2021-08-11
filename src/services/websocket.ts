// Modules
import { Server as ioServer, Socket } from "socket.io";
import { getAuthenticatedUser } from "gizmo-api";

// Classes
import Service from "@classes/Service";
import PoopShitter from "@classes/PoopShitter";

// Utils
import logger from "@utils/logger";
import { createErrorResponse, createSuccessResponse } from "@utils/essentials";
import { constructMessage } from "@utils/message";

// Types
import { User } from "gizmo-api/lib/types";
import { SocketCallback } from "@typings/main";
import { CreateRoomOptions, ExportedRoom, InputRoomData, InputRoomProperties, isCreateRoomOptions, isInputRoomData, isInputRoomProperties, isJoinRoomOptions, isRoomSyncData, JoinRoomOptions, PartialRoom, Room, RoomSyncData, UpdatableRoomProperties } from "@typings/room";
import RoomService from "./room";
import { getEpisodeById, getShow } from "@utils/ramune";
import { isMessagePayload, Message, MessagePayload } from "@typings/message";

// Constants
import { LIMITS } from "@utils/constants";
const WEBSOCKET_PORT = Number(process.env.WEBSOCKET_PORT);
const CORS_ORIGIN_DOMAIN = process.env.CORS_ORIGIN_DOMAIN;

class WebsocketService extends Service {

	readonly ioServer: ioServer;
	readonly sockets: Map<string, User> = new Map();
	readonly userIdToSocketIdMap: Record<string, string> = {};

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

		logger.success(`Successfully started WebSocket server on port '${WEBSOCKET_PORT}'`);
		this.emit("ready");
	}

	addAuthenticatedUser (socket: Socket, user: User): void {
		this.userIdToSocketIdMap[user.id] = socket.id;
		this.sockets.set(socket.id, user);
	}

	getAuthenticatedUser (socket: Socket): User | null {
		return this.sockets.get(socket.id) || null;
	}

	removeAuthenticatedUser (socket: Socket, user: User): void {
		delete this.userIdToSocketIdMap[user.id];
		this.sockets.delete(socket.id);
	}

	getSocketFromUser (user: User): Socket | null {

		const targetSocketId = this.userIdToSocketIdMap[user.id];

		if (targetSocketId) {

			const targetSocket = this.ioServer.sockets.sockets.get(targetSocketId);

			return targetSocket || null;
		} else {
			return null;
		}
	}

	handleSocketConnection (socket: Socket): void {

		logger.info(`[S-${socket.id}] Socket connected`);

		socket.on("CLIENT:AUTHENTICATE", async (data: { token?: string }, callback: SocketCallback<User>) => {

			if (typeof callback !== "function")
				return socket.emit("exception", createErrorResponse("You must provide a callback function.", "CLIENT:AUTHENTICATE"));

			if (data.token) {

				try {

					const user = await getAuthenticatedUser(data.token);

					// Prevent the same user from connecting twice
					if (!this.userIdToSocketIdMap[user.id]) {

						this.addAuthenticatedUser(socket, user);

						callback(createSuccessResponse(user));

						logger.info(`[S-${socket.id}] [${user.username}] Successfully authenticated`);
					} else {
						callback(createErrorResponse("You are already connected somewhere else."));
					}

				} catch (err) {
					callback(createErrorResponse("Something went wrong."));
				}

			} else {
				callback(createErrorResponse("User token is required."));
			}
		});

		socket.on("CLIENT:FETCH_ROOMS", async (callback: SocketCallback<PartialRoom[]>) => {

			if (typeof callback !== "function")
				return socket.emit("exception", createErrorResponse("You must provide a callback function.", "CLIENT:FETCH_ROOMS"));

			const user = this.getAuthenticatedUser(socket);

			if (!user)
				return callback(createErrorResponse("You must be authenticated."));

			const roomService: RoomService = this.cluster.getService("room");

			callback(createSuccessResponse(roomService.getRooms()));
		});

		socket.on("CLIENT:CREATE_ROOM", async (options: CreateRoomOptions | unknown, callback: SocketCallback<ExportedRoom>) => {

			if (typeof callback !== "function")
				return socket.emit("exception", createErrorResponse("You must provide a callback function.", "CLIENT:CREATE_ROOM"));

			if (!isCreateRoomOptions(options))
				return callback(createErrorResponse("Invalid room options."));

			const user = this.getAuthenticatedUser(socket);

			if (!user)
				return callback(createErrorResponse("You must be authenticated."));

			/**
			 * - validate `options`
			 * - check if room exists
			 * - check if user is already in room & leave if so
			 * - create room
			 * - add user as host
			 */

			options.name = options.name.trim();

			if (options.password) {
				options.password = options.password.trim();
			}

			if (options.name.length > 0) {

				if (options.password) {
					if (options.password.length === 0) {
						return callback(createErrorResponse("Password cannot be empty."));
					} else if (options.password.length > LIMITS.ROOM_PASSWORD_LENGTH_LIMIT) {
						return callback(createErrorResponse(`Password is longer than ${LIMITS.ROOM_PASSWORD_LENGTH_LIMIT} characters.`));
					}
				}

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

					callback(createSuccessResponse(roomService.exportRoom(newRoom)));

				} else {
					callback(createErrorResponse("Room already exists."));
				}
			} else {
				callback(createErrorResponse("Name cannot be empty."));
			}
		});

		socket.on("CLIENT:JOIN_ROOM", async (options: JoinRoomOptions | unknown, callback: SocketCallback<ExportedRoom>) => {

			if (typeof callback !== "function")
				return socket.emit("exception", createErrorResponse("You must provide a callback function.", "CLIENT:JOIN_ROOM"));

			if (!isJoinRoomOptions(options))
				return callback(createErrorResponse("Invalid room options"));

			const user = this.getAuthenticatedUser(socket);

			if (!user)
				return callback(createErrorResponse("You must be authenticated."));

			/**
			 * - validate `roomId`
			 * - check if room exists
			 * - validate password if room is locked
			 * - leave the room the user is currently in
			 * - join room
			 */

			const
				roomService: RoomService = this.cluster.getService("room"),
				targetRoom = roomService.getRoom(options.id);

			if (typeof options.password === "string") {
				if (options.password.length === 0) {
					return callback(createErrorResponse("Password cannot be empty."));
				} else if (options.password.length > LIMITS.ROOM_PASSWORD_LENGTH_LIMIT) {
					return callback(createErrorResponse(`Password is longer than ${LIMITS.ROOM_PASSWORD_LENGTH_LIMIT} characters.`));
				}
			}

			if (targetRoom) {

				if (targetRoom.locked) {
					if (typeof options.password === "string") {
						if (!roomService.isValidRoomPassword(targetRoom, options.password)) {
							return callback(createErrorResponse("Invalid password."));
						}
					} else {
						return callback(createErrorResponse("The room requires a password."));
					}
				}

				const currentRoom = roomService.getUserCurrentRoom(user);

				if (currentRoom) {
					roomService.leaveRoom(currentRoom, user, socket);
				}

				const newRoom = roomService.joinRoom(targetRoom, user, socket);

				callback(createSuccessResponse(roomService.exportRoom(newRoom)));
			} else {
				callback(createErrorResponse("Room doesn't exist."));
			}
		});

		socket.on("CLIENT:LEAVE_ROOM", async (callback: SocketCallback<string>) => {

			if (typeof callback !== "function")
				return socket.emit("exception", createErrorResponse("You must provide a callback function.", "CLIENT:LEAVE_ROOM"));

			const user = this.getAuthenticatedUser(socket);

			if (!user)
				return callback(createErrorResponse("You must be authenticated."));

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

				callback(createSuccessResponse("Successfully left room."));

			} else {
				callback(createErrorResponse("You aren't in a room."));
			}
		});

		socket.on("CLIENT:UPDATE_ROOM", async (newRoom: InputRoomProperties | unknown, callback: SocketCallback<string>) => {

			if (typeof callback !== "function")
				return socket.emit("exception", createErrorResponse("You must provide a callback function.", "CLIENT:UPDATE_ROOM"));

			if (!isInputRoomProperties(newRoom))
				return callback(createErrorResponse("Invalid room properties."));

			const user = this.getAuthenticatedUser(socket);

			if (!user)
				return callback(createErrorResponse("You must be authenticated."));

			/**
			 * - validate `newRoom`
			 * - check whether the user is in a room
			 * - check whether the user is the room host
			 * - update room
			 * - broadcast changes
			*/

			const
				roomService: RoomService = this.cluster.getService("room"),
				currentRoom = roomService.getUserCurrentRoom(user);

			if (currentRoom) {
				if (currentRoom.host.id === user.id) {

					const newRoomProperties: UpdatableRoomProperties = {};

					if (typeof newRoom.hostId === "number") {

						const targetUser = roomService.getUserInRoom(currentRoom, newRoom.hostId);

						if (targetUser) {
							newRoomProperties.host = targetUser;
						} else {
							callback(createErrorResponse("The target user isn't in the room."));
						}
					}

					if (Object.values(newRoomProperties).length > 0) {

						roomService.updateRoom(currentRoom, newRoomProperties);

						callback(createSuccessResponse("Successfully updated room."));
					}

				} else {
					callback(createErrorResponse("You aren't the room host."));
				}
			} else {
				callback(createErrorResponse("You aren't in a room."));
			}
		});

		socket.on("CLIENT:UPDATE_ROOM_DATA", async (roomData: InputRoomData | unknown, callback: SocketCallback<string>) => {

			if (typeof callback !== "function")
				return socket.emit("exception", createErrorResponse("You must provide a callback function.", "CLIENT:UPDATE_ROOM_DATA"));

			if (!isInputRoomData(roomData))
				return callback(createErrorResponse("Invalid room data."));

			const user = this.getAuthenticatedUser(socket);

			if (!user)
				return callback(createErrorResponse("You must be authenticated."));

			/**
			 * - validate `roomData`
			 * - check whether the user is in a room
			 * - check whether the user is the room host
			 * - fetch show and send RoomData to everyone with ROOM:UPDATE_DATA
			 */

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

							return callback(createSuccessResponse("Successfully updated data."));
						}
					}

					// If the episode couldn't be found, re-fetch the entire show
					const show = await getShow(roomData.showId);

					if (show) {

						roomService.updateRoomData(currentRoom, {
							show,
							episodeId: roomData.episodeId
						});

						callback(createSuccessResponse("Successfully updated data."));

					} else {
						callback(createErrorResponse("Couldn't fetch show."));
					}

				} else {
					callback(createErrorResponse("You aren't the room host."));
				}
			} else {
				callback(createErrorResponse("You aren't in a room."));
			}
		});

		socket.on("CLIENT:SYNC_ROOM", async (syncData: RoomSyncData | unknown, callback: SocketCallback<string>) => {

			if (typeof callback !== "function")
				return socket.emit("exception", createErrorResponse("You must provide a callback function.", "CLIENT:SYNC_ROOM"));

			if (!isRoomSyncData(syncData))
				return callback(createErrorResponse("Invalid room sync data."));

			const user = this.getAuthenticatedUser(socket);

			if (!user)
				return callback(createErrorResponse("You must be authenticated."));

			/**
			 * - validate `syncData`
			 * - check whether the user is in a room
			 * - check whether the user is the room host
			 * - send RoomSyncData to everyone with ROOM:SYNC
			 */

			const startTimestamp = Date.now();

			const
				roomService: RoomService = this.cluster.getService("room"),
				currentRoom = roomService.getUserCurrentRoom(user);

			if (currentRoom) {
				if (currentRoom.host.id === user.id) {

					const finishTimestamp = Date.now();

					roomService.syncRoom(currentRoom, {
						currentTime: syncData.currentTime + (finishTimestamp - startTimestamp) / 1000,
						playing: syncData.playing
					}, socket);

					callback(createSuccessResponse("Successfully synced room."));

				} else {
					callback(createErrorResponse("You aren't the room host."));
				}
			} else {
				callback(createErrorResponse("You aren't in a room."));
			}
		});

		socket.on("CLIENT:SEND_MESSAGE", async (data: MessagePayload | unknown, callback: SocketCallback<Message>) => {

			if (typeof callback !== "function")
				return socket.emit("exception", createErrorResponse("You must provide a callback function.", "CLIENT:SEND_MESSAGE"));

			if (!isMessagePayload(data))
				return callback(createErrorResponse("Invalid message payload."));

			const user = this.getAuthenticatedUser(socket);

			if (!user)
				return callback(createErrorResponse("You must be authenticated."));

			if (data.content.trim().length > 0) {

				const
					roomService: RoomService = this.cluster.getService("room"),
					currentRoom = roomService.getUserCurrentRoom(user);

				if (currentRoom) {

					const message = constructMessage(user, data.content);

					if (message.content.length > 0) {
						socket.to(currentRoom.id).emit("ROOM:MESSAGE", message);
						callback(createSuccessResponse(message));
					} else {
						callback(createErrorResponse("You cannot send an empty message."));
					}

				} else {
					callback(createErrorResponse("You aren't in a room."));
				}
			} else {
				callback(createErrorResponse("You cannot send an empty message."));
			}
		});

		socket.on("CLIENT:FETCH_ONLINE_USERS", async (callback: SocketCallback<User[]>) => {

			if (typeof callback !== "function")
				return socket.emit("exception", createErrorResponse("You must provide a callback function.", "CLIENT:FETCH_ONLINE_USERS"));

			callback(createSuccessResponse(Array.from(this.sockets.values())));
		});

		socket.on("CLIENT:KICK_USER", async (userId: number | unknown, callback: SocketCallback<string>) => {

			if (typeof callback !== "function")
				return socket.emit("exception", createErrorResponse("You must provide a callback function.", "CLIENT:KICK_USER"));

			if (typeof userId !== "number")
				return callback(createErrorResponse("Invalid UserID."));

			const user = this.getAuthenticatedUser(socket);

			if (!user)
				return callback(createErrorResponse("You must be authenticated."));

			const
				roomService: RoomService = this.cluster.getService("room"),
				currentRoom = roomService.getUserCurrentRoom(user);

			if (currentRoom) {
				if (currentRoom.host.id === user.id) {

					const targetUser = roomService.getUserInRoom(currentRoom, userId);

					if (targetUser) {

						const targetSocket = this.getSocketFromUser(targetUser);

						if (targetSocket) {

							roomService.leaveRoom(currentRoom, targetUser, targetSocket);

							callback(createSuccessResponse("Successfully kicked user."));
						} else {
							callback(createErrorResponse("Something went wrong."));
						}
					} else {
						callback(createErrorResponse("The target user isn't in the room."));
					}
				} else {
					callback(createErrorResponse("You aren't the room host."));
				}
			} else {
				callback(createErrorResponse("You aren't in a room."));
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

			logger.info(`[S-${socket.id}] Socket disconnected with reason '${reason}'`);
		});

	}
}

export default WebsocketService;
