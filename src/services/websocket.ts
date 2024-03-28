// Modules
import { Server } from "socket.io";
import { getAuthenticatedUser } from "gizmo-api";
import { instrument } from "@socket.io/admin-ui";
import logger from "@gizmo-dev/logger";

// Classes
import Service from "@classes/Service";
import type PoopShitter from "@classes/PoopShitter";

// Utils
import { createErrorResponse, createSuccessResponse } from "@utils/essentials";
import { constructMessage } from "@utils/message";
import { isCreateRoomOptions, isInputRoomData, isInputRoomProperties, isJoinRoomOptions, isRoomSyncClientData, isRoomSyncData } from "@typings/room";
import { isMessagePayload } from "@typings/message";
import { getEpisodeById, getShow } from "@utils/ramune";

// Types
import type { Socket } from "socket.io";
import type { User } from "gizmo-api";
import type { ServerToClientEvents, ClientToServerEvents, SocketData, InterServerEvents } from "@typings/socket";
import type { UpdatableRoomProperties } from "@typings/room";
import type RoomService from "./room";

// Constants
import { LIMITS } from "@utils/constants";
const WEBSOCKET_PORT = Number(process.env.WEBSOCKET_PORT);
const CORS_ORIGIN_DOMAIN = process.env.CORS_ORIGIN_DOMAIN || "";
const WEBSOCKET_ADMIN_USERNAME = process.env.WEBSOCKET_ADMIN_USERNAME;
const WEBSOCKET_ADMIN_PASSWORD = process.env.WEBSOCKET_ADMIN_PASSWORD;

if (CORS_ORIGIN_DOMAIN.length === 0) {
	throw Error("Missing environmental variable CORS_ORIGIN_DOMAIN");
}

class WebsocketService extends Service {

	readonly ioServer: Server<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>;

	allowConnections = true;

	constructor (cluster: PoopShitter) {

		super("websocket", cluster);

		this.ioServer = new Server<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>(WEBSOCKET_PORT, {
			cors: {
				origin: [
					CORS_ORIGIN_DOMAIN
				],
				credentials: true
			},
			connectionStateRecovery: {
				maxDisconnectionDuration: 12000,
				skipMiddlewares: true
			},
			cleanupEmptyChildNamespaces: true
		});

		if (WEBSOCKET_ADMIN_USERNAME && WEBSOCKET_ADMIN_PASSWORD) {
			instrument(this.ioServer, {
				auth: {
					type: "basic",
					username: WEBSOCKET_ADMIN_USERNAME,
					password: WEBSOCKET_ADMIN_PASSWORD
				}
			});
		}

		this.ioServer.on("connection", this.handleSocketConnection.bind(this));

		process.once("SIGINT", () => {
			this.ioServer.close();
			this.allowConnections = false;
		});

		logger.success(`Started WebSocket server on port '${WEBSOCKET_PORT}'`);
		logger.info(`http://localhost:${WEBSOCKET_PORT}`);

		this.emit("ready");
	}

	async getSocketFromUser (user: User): Promise<Socket<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData> | null> {

		let targetSocketId: string | null = null;

		for (const socket of await this.ioServer.fetchSockets()) {
			if (socket.data.user?.id === user.id) {
				targetSocketId = socket.id;
			}
		}

		if (targetSocketId) {

			const targetSocket = this.ioServer.sockets.sockets.get(targetSocketId);

			return targetSocket || null;
		} else {
			return null;
		}
	}

	handleSocketConnection (socket: Socket<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>): void {

		if (!this.allowConnections) {
			socket.disconnect(true);
			return;
		}

		logger.info(`[S-${socket.id}] Socket connected`);

		socket.on("CLIENT:AUTHENTICATE", async (data, callback) => {

			if (typeof callback !== "function")
				return socket.emit("exception", createErrorResponse("You must provide a callback function.", "CLIENT:AUTHENTICATE"));

			if (typeof data.token !== "string")
				return callback(createErrorResponse("User token is required."));

			try {

				const user = await getAuthenticatedUser(data.token);
				let found = false;

				// !! Optimize lookup to not iterate over all online users
				for (const socket of await this.ioServer.fetchSockets()) {
					if (socket.data.user?.id === user.id) {
						found = true;
						break;
					}
				}

				if (!found) {

					socket.data.user = user;
					
					callback(createSuccessResponse(user));

					logger.info(`[S-${socket.id}] [${user.username}] Successfully authenticated`);

				} else {
					callback(createErrorResponse("You are already connected somewhere else."));
				}

			} catch (err) {
				callback(createErrorResponse("Something went wrong."));
			}
		});

		socket.on("CLIENT:FETCH_ROOMS", async (callback) => {

			if (typeof callback !== "function")
				return socket.emit("exception", createErrorResponse("You must provide a callback function.", "CLIENT:FETCH_ROOMS"));

			if (!socket.data.user)
				return callback(createErrorResponse("You must be authenticated."));

			const roomService: RoomService = this.cluster.getService("room");

			callback(createSuccessResponse(roomService.getRooms()));
		});

		socket.on("CLIENT:CREATE_ROOM", async (options, callback) => {

			if (typeof callback !== "function")
				return socket.emit("exception", createErrorResponse("You must provide a callback function.", "CLIENT:CREATE_ROOM"));

			const user = socket.data.user;

			if (!user)
				return callback(createErrorResponse("You must be authenticated."));

			if (!isCreateRoomOptions(options))
				return callback(createErrorResponse("Invalid room options."));

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

			if (options.name.length === 0) {
				return callback(createErrorResponse("Room name cannot be empty."));
			}

			if (options.password) {
				if (options.password.length === 0) {
					return callback(createErrorResponse("Password cannot be empty."));
				} else if (options.password.length > LIMITS.ROOM_PASSWORD_LENGTH_LIMIT) {
					return callback(createErrorResponse(`Password must not be longer than ${LIMITS.ROOM_PASSWORD_LENGTH_LIMIT} characters.`));
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
		});

		socket.on("CLIENT:JOIN_ROOM", async (options, callback) => {

			if (typeof callback !== "function")
				return socket.emit("exception", createErrorResponse("You must provide a callback function.", "CLIENT:JOIN_ROOM"));

			const user = socket.data.user;

			if (!user)
				return callback(createErrorResponse("You must be authenticated."));

			if (!isJoinRoomOptions(options))
				return callback(createErrorResponse("Invalid room options"));

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

		socket.on("CLIENT:LEAVE_ROOM", async (callback) => {

			if (typeof callback !== "function")
				return socket.emit("exception", createErrorResponse("You must provide a callback function.", "CLIENT:LEAVE_ROOM"));

			const user = socket.data.user;

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

			if (!currentRoom) {
				return callback(createErrorResponse("You aren't in a room."));
			}

			roomService.leaveRoom(currentRoom, user, socket);

			callback(createSuccessResponse("Successfully left room."));
		});

		socket.on("CLIENT:UPDATE_ROOM", async (newRoom, callback) => {

			if (typeof callback !== "function")
				return socket.emit("exception", createErrorResponse("You must provide a callback function.", "CLIENT:UPDATE_ROOM"));

			const user = socket.data.user;

			if (!user)
				return callback(createErrorResponse("You must be authenticated."));

			if (!isInputRoomProperties(newRoom))
				return callback(createErrorResponse("Invalid room properties."));

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

			if (!currentRoom)
				return callback(createErrorResponse("You aren't in a room."));

			if (currentRoom.host.id !== user.id)
				return callback(createErrorResponse("You aren't the room host."));

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
		});

		socket.on("CLIENT:UPDATE_ROOM_DATA", async (roomData, callback) => {

			if (typeof callback !== "function")
				return socket.emit("exception", createErrorResponse("You must provide a callback function.", "CLIENT:UPDATE_ROOM_DATA"));

			const user = socket.data.user;

			if (!user)
				return callback(createErrorResponse("You must be authenticated."));

			if (!isInputRoomData(roomData))
				return callback(createErrorResponse("Invalid room data."));

			/**
			 * - validate `roomData`
			 * - check whether the user is in a room
			 * - check whether the user is the room host
			 * - fetch show and send RoomData to everyone with ROOM:UPDATE_DATA
			 */

			const
				roomService: RoomService = this.cluster.getService("room"),
				currentRoom = roomService.getUserCurrentRoom(user);

			if (!currentRoom)
				return callback(createErrorResponse("You aren't in a room."));

			if (currentRoom.host.id !== user.id)
				return callback(createErrorResponse("You aren't the room host."));

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
		});

		socket.on("CLIENT:SYNC_ROOM", async (syncData, callback) => {

			if (typeof callback !== "function")
				return socket.emit("exception", createErrorResponse("You must provide a callback function.", "CLIENT:SYNC_ROOM"));

			const user = socket.data.user;

			if (!user)
				return callback(createErrorResponse("You must be authenticated."));

			if (!isRoomSyncData(syncData))
				return callback(createErrorResponse("Invalid room sync data."));

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

			if (!currentRoom)
				return callback(createErrorResponse("You aren't in a room."));

			if (currentRoom.host.id !== user.id)
				return callback(createErrorResponse("You aren't the room host."));
			
			const finishTimestamp = Date.now();

			roomService.syncRoom(currentRoom, {
				currentTime: syncData.currentTime + (finishTimestamp - startTimestamp) / 1000,
				playing: syncData.playing
			}, socket);

			callback(createSuccessResponse("Successfully synced room."));
		});

		socket.on("CLIENT:SYNC_ROOM_CLIENT", async (syncData, callback) => {

			if (typeof callback !== "function")
				return socket.emit("exception", createErrorResponse("You must provide a callback function.", "CLIENT:SYNC_ROOM_CLIENT"));

			const user = socket.data.user;

			if (!user)
				return callback(createErrorResponse("You must be authenticated."));

			if (!isRoomSyncClientData(syncData))
				return callback(createErrorResponse("Invalid room client sync data."));

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

			if (!currentRoom)
				return callback(createErrorResponse("You aren't in a room."));

			const targetUser = roomService.getUserInRoom(currentRoom, syncData.userId);

			if (!targetUser)
				return callback(createErrorResponse("Could not find user in room."));

			const targetSocket = await this.getSocketFromUser(targetUser);

			if (!targetSocket)
				return callback(createErrorResponse("Something went wrong."));

			if (currentRoom.host.id !== user.id)
				return callback(createErrorResponse("You aren't the room host."));

			const finishTimestamp = Date.now();

			roomService.syncRoomClient(currentRoom, {
				currentTime: syncData.data.currentTime + (finishTimestamp - startTimestamp) / 1000,
				playing: syncData.data.playing
			}, targetSocket);

			callback(createSuccessResponse("Successfully synced room client."));
		});

		socket.on("CLIENT:SEND_MESSAGE", async (data, callback) => {

			if (typeof callback !== "function")
				return socket.emit("exception", createErrorResponse("You must provide a callback function.", "CLIENT:SEND_MESSAGE"));

			const user = socket.data.user;

			if (!user)
				return callback(createErrorResponse("You must be authenticated."));

			if (!isMessagePayload(data))
				return callback(createErrorResponse("Invalid message payload."));

			if (data.content.trim().length === 0)
				return callback(createErrorResponse("You cannot send an empty message."));

			const
				roomService: RoomService = this.cluster.getService("room"),
				currentRoom = roomService.getUserCurrentRoom(user);

			if (!currentRoom)
				return callback(createErrorResponse("You aren't in a room."));

			const message = constructMessage(user, data.content);

			if (message.content.length > 0) {
				socket.to(currentRoom.id).emit("ROOM:MESSAGE", message);
				callback(createSuccessResponse(message));
			} else {
				callback(createErrorResponse("You cannot send an empty message."));
			}
		});

		socket.on("CLIENT:FETCH_ONLINE_USERS", async (callback) => {

			if (typeof callback !== "function")
				return socket.emit("exception", createErrorResponse("You must provide a callback function.", "CLIENT:FETCH_ONLINE_USERS"));

			const authenticatedSockets = (await this.ioServer.fetchSockets()).filter(socket => socket.data.user);

			// !! Disable inferrence because we already filtered out sockets that aren't logged in
			callback(createSuccessResponse(authenticatedSockets.map(socket => socket.data.user as User)));
		});

		socket.on("CLIENT:KICK_USER", async (userId, callback) => {

			if (typeof callback !== "function")
				return socket.emit("exception", createErrorResponse("You must provide a callback function.", "CLIENT:KICK_USER"));

			const user = socket.data.user;

			if (!user)
				return callback(createErrorResponse("You must be authenticated."));

			if (typeof userId !== "number")
				return callback(createErrorResponse("Invalid UserID."));

			const
				roomService: RoomService = this.cluster.getService("room"),
				currentRoom = roomService.getUserCurrentRoom(user);

			if (!currentRoom)
				return callback(createErrorResponse("You aren't in a room."));

			if (currentRoom.host.id !== user.id)
				return callback(createErrorResponse("You aren't the room host."));

			const targetUser = roomService.getUserInRoom(currentRoom, userId);

			if (!targetUser)
				return callback(createErrorResponse("The target user isn't in the room."));

			const targetSocket = await this.getSocketFromUser(targetUser);

			if (!targetSocket)
				return callback(createErrorResponse("Something went wrong."));

			roomService.leaveRoom(currentRoom, targetUser, targetSocket);

			callback(createSuccessResponse("Successfully kicked user."));
		});

		socket.on("CLIENT:START_TYPING", () => {

			const user = socket.data.user;

			if (!user)
				return;

			const
				roomService: RoomService = this.cluster.getService("room"),
				currentRoom = roomService.getUserCurrentRoom(user);

			if (currentRoom) {
				this.ioServer.to(currentRoom.id).emit("ROOM:USER_START_TYPING", user.id);
			}

		});

		socket.on("CLIENT:STOP_TYPING", () => {

			const user = socket.data.user;

			if (!user)
				return;

			const
				roomService: RoomService = this.cluster.getService("room"),
				currentRoom = roomService.getUserCurrentRoom(user);

			if (currentRoom) {
				this.ioServer.to(currentRoom.id).emit("ROOM:USER_STOP_TYPING", user.id);
			}

		});

		socket.on("CLIENT:REQUEST_ROOM_SYNC", async () => {

			const user = socket.data.user;

			if (!user)
				return;

			const
				roomService: RoomService = this.cluster.getService("room"),
				currentRoom = roomService.getUserCurrentRoom(user);

			if (currentRoom) {

				const hostSocket = await this.getSocketFromUser(currentRoom.host);

				if (hostSocket) {
					hostSocket.emit("ROOM:CLIENT_REQUEST_ROOM_SYNC", user.id);
				}
			}
		});

		socket.on("disconnect", (reason: string) => {

			const user = socket.data.user;

			if (user) {

				const
					roomService: RoomService = this.cluster.getService("room"),
					currentRoom = roomService.getUserCurrentRoom(user);

				if (currentRoom) {
					roomService.leaveRoom(currentRoom, user, socket);
				}
			}

			logger.info(`[S-${socket.id}] Socket disconnected with reason '${reason}'`);
		});

	}
}

export default WebsocketService;
