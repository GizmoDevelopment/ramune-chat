// Modules
import gizmo, { User } from "gizmo-api";
import io, { Socket } from "socket.io";

// Utils
import logger from "../utils/logger";
import { constructClient, constructExtendedUser } from "../utils/users";
import { constructRoom, prepareRoomForSending, sanitizeRoomId, updateRoom } from "../utils/rooms";

// Types
import { Client, Room } from "../types";

export default class Server {

    private readonly ioServer: io.Server;

    clients: Map<string, Client> = new Map();
    rooms: Map<string, Room> = new Map();

    constructor (port: number) {

        this.ioServer = new io.Server(port, {
            cors: {
                origin: "*"
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

    private updateRoom (socket: Socket, type: string, roomId: string, data?: Record<string, any>) {
        if (this.roomExists(roomId)) {

            const room = this.rooms.get(roomId);

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
                                socket.to(roomId).emit("client:update_room", updatedRoom);
                            }
                        }

                        break;
                    case "update_data":

                        if (typeof data === "object") {
                            
                            const updatedRoom = updateRoom(room, { data });

                            this.rooms.set(roomId, updatedRoom);
                            socket.to(roomId).emit("client:update_room", updatedRoom);
                        }

                        break;
                    default:
                }
            }
        }
    }

    private createRoom (socket: Socket, roomId: string) {
        if (!this.roomExists(roomId)) {

            // New room (promote to host)
            this.modifyClientData(socket, {
                hostOfRoom: roomId
            });

            this.rooms.set(roomId, constructRoom(socket, roomId));
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

                // Existing room
                this.modifyClientData(socket, {
                    hostOfRoom: null
                });

            } else {

                this.createRoom(socket, sanitizedRoomId);
                logger.info(`{${ socket.id }} Client created roomID {${ sanitizedRoomId }}`);

            }

            const room = this.rooms.get(roomId);

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
                this.ioServer.to(sanitizedRoomId).emit("client:leave_room", user.id);
            } else {
                this.removeRoom(sanitizedRoomId);
            }

            const room = this.rooms.get(roomId);

            if (room && room?.sockets?.includes(socket.id)) {

                room.sockets.splice(room.sockets.indexOf(socket.id), 1);
                
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

            if (!data?.token) {

                callback({
                    type: "error",
                    message: "User token is required"
                });

                return socket.disconnect(true);
            }
    
            try {
    
                const
                    user = await gizmo.getUser(data.token),
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

        socket.on("client:join_room", async (data: { roomId: string }, callback: Function) => {
            if (data?.roomId) {
                this.joinRoom(socket, data.roomId, callback);
            } else {
                callback({
                    type: "error",
                    message: "Room ID is required"
                });
            }
        });

        socket.on("client:leave_room", (data: { roomId: string }, callback: Function) => {
            if (data?.roomId) {
                this.leaveRoom(socket, data.roomId, callback);
            } else {
                callback({
                    type: "error",
                    message: "Room ID is required"
                });
            }
        });

        socket.on("client:send_message", (data: { content: string }) => {

            const client = this.getClientFromSocket(socket);

            if (client) {

                const user = client.user;

                this.ioServer.sockets.emit("client:send_message", {
                    id: Math.floor(Math.random() * 10000000),
                    type: "text",
                    content: data.content,
                    author: {
                        id: user.id,
                        username: user.uid,
                        avatar: user.avatar
                    }
                });
            }
        });

        socket.on("client:sync_player", (data: { timestamp: number, paused: boolean }, callback: Function) => {
            
            const client = this.getClientFromSocket(socket);

            if (client) {

                const {
                    hostOfRoom
                } = client.data;

                if (hostOfRoom) {
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

        socket.on("client:update_room", (data: { showId: string, episodeId: string }, callback: Function) => {

            const client = this.getClientFromSocket(socket);

            if (client) {

                const {
                    hostOfRoom
                } = client.data;

                if (hostOfRoom) {

                    const newRoomContent = {
                        showId: data.showId,
                        episodeId: data.episodeId
                    };

                    this.updateRoom(socket, "update_data", hostOfRoom, newRoomContent);
                    socket.to(hostOfRoom).emit("client:update_room", newRoomContent);

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

        socket.on("client:fetch_room", (data: { roomId: string }, callback: Function) => {
            if (this.socketExists(socket)) {
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
            }
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