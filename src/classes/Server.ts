// Modules
import { Server as ioServer, Socket } from "socket.io";
import { getAuthenticatedUser } from "gizmo-api";

// Utils
import logger from "@utils/logger";
import { createRoom, getRoom } from "@utils/rooms";

// Types
import { SocketCallback } from "@typings/main";
import { User } from "gizmo-api/lib/types";
import { createResponse } from "@utils/essentials";
import { Room, RoomOptions } from "@typings/room";

// Constants
const WEBSOCKET_PORT = Number(process.env.WEBSOCKET_PORT);
const CORS_ORIGIN_DOMAIN = process.env.CORS_ORIGIN_DOMAIN;

export default class Server {
	
	readonly ready = false;
	private readonly ioServer: ioServer;

	// Socket IDs mapped to their respective Users
	private users: Map<string, User> = new Map();

	constructor () {

		this.ioServer = new ioServer(WEBSOCKET_PORT, {
			cors: {
				origin: CORS_ORIGIN_DOMAIN,
				credentials: true
			}
		});

		this.ioServer.sockets.on("connection", this.handleSocketConnetion.bind(this));

		logger.success(`Successfully started WebSocket server on port '${ WEBSOCKET_PORT }'`);

		process.once("SIGINT", () => {
			this.ioServer.close();
		});

	}

	private handleSocketConnetion (socket: Socket) {
		
		logger.info(`[S-${ socket.id }] Socket connected`);

		socket.on("CLIENT:AUTHENTICATE", async (data: { token?: string }, callback: SocketCallback<User>) => {
			if (typeof data?.token === "string") {

				try {

					const user = await getAuthenticatedUser(data.token);

					this.addUser(socket, user);
					callback(createResponse<User>("success", user));

					logger.info(`[${ socket.id }] [${ user.username }] Successfully authenticated`);

				} catch (err) {
					callback(createResponse("error", "Something went wrong."));
				}

			} else {
				callback(createResponse("error", "User token is required."));
			}
		});

		socket.on("CLIENT:FETCH_ROOMS", async (callback: SocketCallback<Room[]>) => {
			
		});

		socket.on("CLIENT:CREATE_ROOM", async (options: RoomOptions, callback: SocketCallback<Room>) => {
			if (typeof options?.name === "string") {
				
				const user = this.getUser(socket);

				if (user) {

					const room = createRoom(user, options);

					socket.join(room.id);

					callback(createResponse<Room>("success", room));
					logger.info(`[S-${ socket.id }] [R-${ room.id }] [${ user.username }] Created new room`);

				} else {
					callback(createResponse("error", "Something went wrong."));
				}

			} else {
				callback(createResponse("error", "Missing room options."));
			}
		});

		socket.on("CLIENT:JOIN_ROOM", async ({ roomId }: { roomId: string }, callback: SocketCallback<Room>) => {
			if (typeof roomId === "string") {

				const user = this.getUser(socket);

				if (user) {

					const room = getRoom(roomId);

					if (room) {
						
						

					} else {
						callback(createResponse("error", "Room not found."));
					}

				} else {
					callback(createResponse("error", "Something went wrong."));
				}

			} else {
				callback(createResponse("error", "Missing RoomID."));
			}
		});

		socket.on("disconnect", (reason: string) => {

			const user = this.getUser(socket);

			if (user) {

				

				this.removeUser(socket);

				logger.info(`[S-${ socket.id }] Disconnected with reason '${ reason }'`);
			}

		});

	}

	private addUser (socket: Socket, user: User) {
		this.users.set(socket.id, user);
	}

	private getUser (socket: Socket): User | null {
		return this.users.get(socket.id) || null;		
	}

	private removeUser (socket: Socket) {
		this.users.delete(socket.id);
	}

}