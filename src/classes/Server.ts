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

    private handleSocketConnection (socket: Socket) {

        logger.info(`Incoming socket connection from '${ socket.id }'`);

        socket.on("auth:attempt", async (data: { token: string }, callback: Function) => {
        
            if (!data?.token) {
                return callback({
                    type: "error",
                    reason: "User token is required"
                });
            }
    
            try {
    
                const user = await gizmo.getUser(data.token);
                
                this.addClient(constructClient(socket, user));
    
            } catch (err) {
    
                callback({
                    type: "error",
                    reason: "Something went wrong"
                });
    
                throw err;
            }
    
        });

    }

}