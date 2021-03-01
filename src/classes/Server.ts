// Modules
import fs from "fs";
import http from "http";
import https from "https";
import gizmo, { User } from "gizmo-api";
import io, { Socket } from "socket.io";

// Utils
import logger from "../utils/logger";
import { constructClient } from "../utils/users";
import { sanitizeRoomId } from "../utils/rooms";

// Types
import { Client } from "../types";

export default class Server {

    private readonly httpServer: http.Server | https.Server;
    private readonly ioServer: io.Server;

    clients: Map<string, Client> = new Map();

    constructor (port: number) {

        if (process.env.NODE_ENV === "production") {
            this.httpServer = https.createServer({
                key: fs.readFileSync("../../key.pem"),
                cert: fs.readFileSync("../../cert.pem")
            });
        } else {
            this.httpServer = http.createServer();
        }

        this.ioServer = new io.Server(this.httpServer);

        this.ioServer.sockets.on("connection", this.handleSocketConnection);

        this.httpServer.listen(port, () => {
            logger.info(`Listening on port ${ port }`);
        });

    }

    addClient (client: Client) {
        this.clients.set(client.socket.id, client);
    }

    socketExists (socket: Socket) {
        return this.clients.has(socket.id);
    }

    removeSocket (socket: Socket) {
        this.clients.delete(socket.id);
    }

    getClientFromSocket (socket: Socket) {
        return this.clients.get(socket.id);
    }

    getClientFromSocketId (socketId: string) {
        return this.clients.get(socketId);
    }

    private handleSocketConnection (socket: Socket) {

        logger.info(`{'${ socket.id }'} Client connected`);

        socket.on("client:authenticate", async (data: { token: string }, callback: Function) => {
        
            if (!data?.token) {
                return callback({
                    type: "error",
                    message: "User token is required"
                });
            }
    
            try {
    
                const user = await gizmo.getUser(data.token);

                this.addClient(constructClient(socket, user));

                callback({
                    type: "success",
                    message: data
                });

                // Not needed at the moment
                // socket.broadcast.emit("client:connect", user);

                logger.info(`{'${ socket.id }'} Authenticated client with userID ${ user.id }`);
    
            } catch (err) {
    
                callback({
                    type: "error",
                    message: "Something went wrong"
                });
    
                throw err;
            }
    
        });

        socket.on("client:join_room", async (data: { roomId: string }, callback: Function) => {
            if (data?.roomId && data?.roomId?.startsWith("room:")) {

                const
                    sanitizedRoomId = sanitizeRoomId(data.roomId),
                    user = this.getClientFromSocket(socket)?.user;

                if (user) {

                    socket.join(sanitizedRoomId);
                    this.ioServer.to(sanitizedRoomId).emit("client:join_room", user);

                    const
                        socketsInRoom = await this.ioServer.to(sanitizedRoomId).allSockets(),
                        listOfUsersInRoom: Record<string, User> = {};

                    socketsInRoom.forEach(socketId => {
                        if (socketId !== socket.id) {
                            
                            const user = this.getClientFromSocketId(socketId)?.user;

                            if (user) {
                                listOfUsersInRoom[user.id] = user;
                            }
                        }
                    });

                    callback({
                        type: "success",
                        message: listOfUsersInRoom
                    });
                    
                } else {
                    callback({
                        type: "error",
                        message: "Client doesn't exist"
                    });
                }

            } else {
                callback({
                    type: "error",
                    message: "Room ID is required"
                });
            }
        });

        socket.on("client:leave_room", (data: { roomId: string }, callback: Function) => {
            if (data?.roomId && data?.roomId?.startsWith("room:")) {

                const
                    sanitizedRoomId = sanitizeRoomId(data.roomId),
                    user = this.getClientFromSocket(socket)?.user;

                if (user) {
                    socket.leave(sanitizedRoomId);
                    this.ioServer.to(sanitizedRoomId).emit("client:leave_room", user);
                } else {
                    callback({
                        type: "error",
                        message: "Client doesn't exist"
                    });
                }

            } else {
                callback({
                    type: "error",
                    message: "Room ID is required"
                });
            }
        });

        socket.on("disconnect", (reason: string) => {
            if (this.socketExists(socket)) {

                this.removeSocket(socket);

                logger.info(`{'${ socket.id }'} Client disconnected with reason '${ reason }'`);
            }
        });

    }

}