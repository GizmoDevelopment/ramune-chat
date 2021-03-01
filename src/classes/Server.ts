// Modules
import fs from "fs";
import http from "http";
import https from "https";
import gizmo from "gizmo-api";
import io, { Socket } from "socket.io";

// Utils
import logger from "../utils/logger";
import { constructClient } from "../utils/users";

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

    private handleSocketConnection (socket: Socket) {

        logger.info(`{'${ socket.id }'} Client connected`);

        socket.on("user:authenticate", async (data: { token: string }, callback: Function) => {
        
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
                    message: "Successfully authenticated"
                });

                logger.info(`{'${ socket.id }'} Authenticated client with userID ${ user.id }`);
    
            } catch (err) {
    
                callback({
                    type: "error",
                    message: "Something went wrong"
                });
    
                throw err;
            }
    
        });

        socket.on("disconnect", reason => {
            if (this.socketExists(socket)) {

                this.removeSocket(socket);

                logger.info(`{'${ socket.id }'} Client disconnected with reason '${ reason }'`);
            }
        });

    }

}