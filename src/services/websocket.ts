// Modules
import { Server as ioServer, Socket } from "socket.io";
import { getAuthenticatedUser } from "gizmo-api";

// Classes
import Service from "@classes/Service";

// Utils
import logger from "../../FIREBASE/old/src/utils/logger";
import { createResponse } from "@utils/essentials";

// Types
import { User } from "gizmo-api/lib/types";
import { SocketCallback, SocketErrorCallback } from "@typings/main";
import { Room, RoomOptions, RoomSyncData } from "@typings/room";

interface InputRoomData {
	showId: string;
	episodeId: number;
}

// Constants
const WEBSOCKET_PORT = Number(process.env.WEBSOCKET_PORT);
const CORS_ORIGIN_DOMAIN = process.env.CORS_ORIGIN_DOMAIN;

class Websocket extends Service {

	private readonly ioServer: ioServer;
	private readonly sockets: Map<string, User> = new Map();

	constructor () {

		super("websocket");
		
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
			if (this.isAuthenticated(socket)) {

				// return list of rooms

			} else {
				callback(createResponse("error", "You must be authenticated."));
			}
		});

		socket.on("CLIENT:CREATE_ROOM", async (options: RoomOptions, callback: SocketCallback<Room>) => {
			if (this.isAuthenticated(socket)) {

				/**
				 * - check if user is already in room
				 * - check if room exists
				 * - create room
				 * - add user as host
				 */

			} else {
				callback(createResponse("error", "You must be authenticated."));
			}
		});
	
		socket.on("CLIENT:JOIN_ROOM", async (roomId: string, callback: SocketCallback<Room>) => {
			if (this.isAuthenticated(socket)) {

				/**
				 * - check if room exists
				 * - leave the room the user is currently in
				 * - join room
				 */

			} else {
				callback(createResponse("error", "You must be authenticated."));
			}
		});

		socket.on("CLIENT:LEAVE_ROOM", async (callback: SocketCallback<Room>) => {
			if (this.isAuthenticated(socket)) {

				/**
				 * - get user's current room and leave it
				 * - send ROOM:USER_LEAVE to all other roommates
				 * - promote first roommate on list to host using ROOM:UPDATE
				 * - if room is empty, remove it
				 */

			} else {
				callback(createResponse("error", "You must be authenticated."));
			}
		});

		socket.on("CLIENT:UPDATE_ROOM_DATA", async (roomData: InputRoomData, callback: SocketErrorCallback) => {
			if (this.isAuthenticated(socket)) {

				/**
				 * - check whether the user is in a room
				 * - check whether the user is the room host
				 * - validate `roomData`
				 * - fetch show and send RoomData to everyone with ROOM:UPDATE_DATA 
				 */

			} else {
				callback(createResponse("error", "You must be authenticated."));
			}
		});

		socket.on("CLIENT:SYNC_ROOM", async (syncData: RoomSyncData, callback: SocketErrorCallback) => {
			if (this.isAuthenticated(socket)) {

				/**
				 * - check whether the user is in a room
				 * - check whether the user is the room host
				 * - validate `syncData`
				 * - send RoomSyncData to everyone with ROOM:SYNC
				 */

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

}

export default Websocket;