// Modules
import { getAuthenticatedUser} from "gizmo-api";
import io, { Socket } from "socket.io";

// Utils
import logger from "../utils/logger";
import { constructClient, constructExtendedUser } from "../utils/users";
import { constructRoom, prepareRoomForSending, sanitizeRoomId, updateRoom } from "../utils/rooms";
import { constructMessage } from "../utils/messages";

// Types
import { User } from "gizmo-api/lib/types";
import { Client, Room } from "../types";

export default class Server {

    private readonly ioServer: io.Server;

    clients: Map<string, Client> = new Map();
    rooms: Map<string, Room> = new Map();

    constructor (port: number | string) {

        this.ioServer = new io.Server(Number(port), {
            cors: {
                origin: process.env.CORS_ORIGIN_DOMAIN,
				credentials: true
            }
        });
		
        this.ioServer.sockets.on("connection", this.handleSocketConnection.bind(this));

        logger.info(`Listening on port '${ port }'`);
    }

    private addClient (client: Client) {
        this.clients.set(client.socket.id, client);
    }

    private socketExists (socket: Socket) {
        return this.clients.has(socket.id);
    }

    private removeSocket (socket: Socket) {
        this.clients.delete(socket.id);
    }

    private getClientFromSocket (socket: Socket) {
        return this.clients.get(socket.id);
    }

    private getClientFromSocketId (socketId: string) {
        return this.clients.get(socketId);
    }

    private roomExists (roomId: string) {
        return this.rooms.has(roomId);
    }

    getUserFromSocketId (socketId: string): User | undefined {
        return this.getClientFromSocketId(socketId)?.user;
    }

    private getRoomById (roomId: string): Room | undefined {
        return this.rooms.get(roomId);
    }

    private getRoomByName (roomName: string): Room | undefined {
        return Array.from(this.rooms.values()).find(({ name }) => name === roomName);
    }

    private updateRoom (socket: Socket, type: string, roomId: string, data?: Record<string, any>) {
        if (this.roomExists(roomId)) {

            const room = this.getRoomById(roomId);

            if (room) {
                switch (type) {
                    case "change_host":
    
                        if (data && typeof data.host === "string") {

                            const newHostClient = this.getClientFromSocketId(data.host);

                            if (newHostClient) {

                                const updatedRoom = updateRoom(room, { host: data.host });

                                this.modifyClientData(socket, {
                                    hostOfRoom: null
                                });
        
                                this.modifyClientData(newHostClient.socket, {
                                    hostOfRoom: roomId
                                });

                                this.rooms.set(roomId, updatedRoom);
                                socket.to(roomId).emit("client:update_room", prepareRoomForSending(this, updatedRoom));
                            }
                        }

                        break;
                    case "update_data":

                        if (typeof data === "object") {
                            
                            const updatedRoom = updateRoom(room, { data });

                            this.rooms.set(roomId, updatedRoom);
                            socket.to(roomId).emit("client:update_room_data", data);
                        }

                        break;
                    case "sync_data":
                        
                        if (typeof data === "object") {

                            const updatedRoom = updateRoom(room, { data });
                            
                            this.rooms.set(roomId, updatedRoom);

                            /**
                             * There's no need to emit 'client:update_room' for this,
                             * it only matters during 'client:fetch_room'
                             */
                        }

                        break;
                    default:
                }
            }
        }
    }

    private createRoom (socket: Socket, roomName: string, callback?: Function) {

        const existingRoom = this.getRoomByName(roomName);

        if (!existingRoom) {

            const room = constructRoom(socket, roomName);

            if (room) {

                // New room (promote to host)
                this.modifyClientData(socket, {
                    hostOfRoom: room.id
                });

                this.rooms.set(room.id, room);

                if (callback) {
                    callback({
                        type: "success",
                        message: prepareRoomForSending(this, room)
                    });
                }

                logger.info(`{${ socket.id }} Client created roomID {${ room.id }}`);

            } else if (callback) {
                callback({
                    type: "error",
                    message: "Something went wrong"
                });
            }

        } else if (callback) {
            callback({
                type: "error",
                message: "Room already exists"
            });
        }
    }

    private async removeRoom (roomId: string) {
        if (this.roomExists(roomId)) {
            
            const socketsInRoom = await this.ioServer.to(roomId).allSockets();

            if (socketsInRoom) {
                socketsInRoom.forEach(socketId => {
                    
                    const client = this.getClientFromSocketId(socketId);

                    if (client) {
                        this.leaveRoom(client.socket, roomId);
                    }

                });
            }

            this.rooms.delete(roomId);
            logger.info(`Removed roomID {${ roomId }}`);
        }
    }

    private async joinRoom (socket: Socket, roomId: string, callback?: Function) {

        const
            sanitizedRoomId = sanitizeRoomId(roomId),
            user = this.getClientFromSocket(socket)?.user;

        if (user) {

            this.leaveAllSocketRooms(socket);

            if ((await this.ioServer.to(sanitizedRoomId).allSockets()).size > 0) {
                this.modifyClientData(socket, {
                    hostOfRoom: null
                });
            }

            const room = this.getRoomById(roomId);

            if (room) {

                socket.join(sanitizedRoomId);
                this.ioServer.to(sanitizedRoomId).emit("client:join_room", user);

                if (!room.sockets.includes(socket.id)) {
                    room.sockets.push(socket.id);
                }

                if (callback) {

                    const preparedRoom = prepareRoomForSending(this, room);
    
                    if (preparedRoom) {
                        callback({
                            type: "success",
                            message: preparedRoom
                        });
                    } else {
                        callback({
                            type: "success",
                            message: {}
                        });
                    }
                }

            } else if (callback) {
                callback({
                    type: "error",
                    message: "Room doesn't exist"
                });
            }

            logger.info(`{${ socket.id }} Client joined roomID {${ sanitizedRoomId }}`);
            
        } else if (callback) {
            callback({
                type: "error",
                message: "Client doesn't exist"
            });
        }
    }

    private async leaveRoom (socket: Socket, roomId: string, callback?: Function) {

        const
            sanitizedRoomId = sanitizeRoomId(roomId),
            user = this.getClientFromSocket(socket)?.user;

        if (user) {

            socket.leave(sanitizedRoomId);

            if ((await this.ioServer.to(sanitizedRoomId).allSockets()).size > 0) {
                
                const room = this.getRoomById(sanitizedRoomId);

                if (room) {
                    
                    // Remove socket from socket array
                    if (room.sockets.includes(socket.id)) {
                        room.sockets.splice(room.sockets.indexOf(socket.id), 1);
                    }

                    // Choose next host
                    if (room.host === socket.id) {

                        room.host = room.sockets[0];
                        socket.to(roomId).emit("client:update_room", prepareRoomForSending(this, room));

                        logger.info(`{${ socket.id }} Updated host for roomID {${ sanitizedRoomId }}`);
                    }
                    
                    this.rooms.set(sanitizedRoomId, room);
                }

                this.ioServer.to(sanitizedRoomId).emit("client:leave_room", user.id);

            } else {
                this.removeRoom(sanitizedRoomId);
            }

            if (callback) {
                callback({
                    type: "success",
                    message: sanitizedRoomId
                });
            }
            
            logger.info(`{${ socket.id }} Client left roomID {${ sanitizedRoomId }}`);

        } else if (callback) {
            callback({
                type: "error",
                message: "Client doesn't exist"
            });
        }
    }

    private leaveAllSocketRooms (socket: Socket) {

        const client = this.getClientFromSocket(socket);

        if (client) {
            socket.rooms.forEach(roomId => {
                if (roomId !== socket.id) {
                    this.leaveRoom(socket, roomId);
                }
            });
        }
    }

    private modifyClientData (socket: Socket, data: Record<string, any>) {

        const client = this.getClientFromSocket(socket);

        if (client) {
            this.clients.set(client.socket.id, {
                ...client,
                data: {
                    ...client.data,
                    ...data
                }
            });
        }

    }

    private handleSocketConnection (socket: Socket) {

        logger.info(`{${ socket.id }} Client connected`);

        socket.on("client:authenticate", async (data: { token: string }, callback: Function) => {

            if (typeof data?.token !== "string") {

                callback({
                    type: "error",
                    message: "User token is required"
                });

                return socket.disconnect(true);
            }
    
            try {
    
                const
                    user = await getAuthenticatedUser(data.token),
                    client = constructClient(socket, user),
                    extendedUser = constructExtendedUser(client);

                this.addClient(client);

                callback({
                    type: "success",
                    message: extendedUser
                });

                // Not needed at the moment
                socket.broadcast.emit("client:connect", extendedUser);

                logger.info(`{${ socket.id }} Authenticated client with userID {${ user.id }}`);
    
            } catch (err) {
    
                callback({
                    type: "error",
                    message: "Something went wrong"
                });
    
                throw err;
            }
    
        });

        socket.on("client:create_room", (data: { roomName: string }, callback: Function) => {
            if (typeof data?.roomName === "string") {
                this.createRoom(socket, data.roomName, callback);
            } else {
                callback({
                    type: "error",
                    message: "Room name is required"
                });
            }
        });

        socket.on("client:join_room", (data: { roomId: string }, callback: Function) => {
            if (typeof data?.roomId === "string") {
                this.joinRoom(socket, data.roomId, callback);
            } else {
                callback({
                    type: "error",
                    message: "Room ID is required"
                });
            }
        });

        socket.on("client:leave_room", (data: { roomId: string }, callback: Function) => {
            if (typeof data?.roomId === "string") {
                this.leaveRoom(socket, data.roomId, callback);
            } else {
                callback({
                    type: "error",
                    message: "Room ID is required"
                });
            }
        });

        socket.on("client:send_message", (data: { content: string, roomId: string }, callback: Function) => {

            if (typeof data?.content !== "string" || typeof data?.roomId !== "string") {
                return callback({
                    type: "error",
                    message: "Invalid message payload"
                });
            }

            const client = this.getClientFromSocket(socket);

            if (client) {

                const
                    user = client.user,
                    sanitizedRoomId = sanitizeRoomId(data.roomId),
                    room = this.getRoomById(sanitizedRoomId);

                if (room) {
                    
                    const message = constructMessage(room, user, data.content);

                    room.messages.push(message);
                    this.rooms.set(sanitizedRoomId, room);

                    this.ioServer.to(sanitizedRoomId).emit("client:send_message", message);

                    if (callback) {
                        callback({
                            type: "success",
                            message
                        });
                    }

                } else if (callback) {
                    callback({
                        type: "error",
                        message: "Room does not exist"
                    });
                }
            }
        });

        socket.on("client:sync_player", (data: { timestamp: number, paused: boolean }, callback: Function) => {
            
            if (!data) {
                return callback({
                    type: "error",
                    message: "You are trying to sync with an empty payload"
                });
            }

            const client = this.getClientFromSocket(socket);

            if (client) {

                const {
                    hostOfRoom
                } = client.data;

                if (hostOfRoom) {

                    this.updateRoom(socket, "sync_data", hostOfRoom, {
                        timestamp: data.timestamp
                    });

                    socket.to(hostOfRoom).emit("client:sync_player", {
                        timestamp: Number(data.timestamp) ?? 0,
                        paused: !!data.paused
                    });

                } else {
                    callback({
                        type: "error",
                        message: "You aren't the host"
                    });
                }
            }
        });

        socket.on("client:update_room_data", (data: { showId: string, episodeId: string, timestamp?: number }, callback: Function) => {

            if (!data) {
                return callback({
                    type: "error",
                    message: "You are trying to update a room with an empty payload"
                });
            }

            const client = this.getClientFromSocket(socket);

            if (client) {

                const {
                    hostOfRoom
                } = client.data;

                if (hostOfRoom) {

                    const newRoomContent = {
                        showId: data.showId,
                        episodeId: data.episodeId,
                        timestamp: data.timestamp
                    };

                    this.updateRoom(socket, "update_data", hostOfRoom, newRoomContent);
                    socket.to(hostOfRoom).emit("client:update_room_data", newRoomContent);

                    callback({
                        type: "success",
                        message: prepareRoomForSending(this, hostOfRoom)
                    });

                } else {
                    callback({
                        type: "error",
                        message: "You aren't the host"
                    });
                }
            }
        });

        socket.on("client:fetch_room", (data: { roomId?: string, roomName?: string }, callback: Function) => {
            if (data.roomId) {
                if (this.roomExists(data.roomId)) {
                    callback({
                        type: "success",
                        message: prepareRoomForSending(this, data.roomId)
                    });
                } else {
                    callback({
                        type: "error",
                        message: "Room doesn't exist"
                    });
                }
            } else if (data.roomName) {

                const room = this.getRoomByName(data.roomName);
                
                if (room) {
                    callback({
                        type: "success",
                        message: prepareRoomForSending(this, room)
                    });
                } else {
                    callback({
                        type: "error",
                        message: "Room doesn't exist"
                    });
                }

            } else {
                callback({
                    type: "error",
                    message: "No search filter provided"
                });
            }
        });

        socket.on("client:fetch_rooms", (callback: Function) => {

            const preparedRooms = Array.from(this.rooms.values()).map((room: Room) => {
                return prepareRoomForSending(this, room);
            });

            callback({
                type: "success",
                message: preparedRooms
            });
        });

        socket.on("disconnecting", () => {
            if (this.socketExists(socket)) {
                this.leaveAllSocketRooms(socket);
            }
        });

        socket.on("disconnect", (reason: string) => {
            
            if (this.socketExists(socket)) {
                this.removeSocket(socket);
            }

            logger.info(`{${ socket.id }} Client disconnected with reason '${ reason }'`);
        });

    }

}