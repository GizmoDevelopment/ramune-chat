// Modules
import fs from "fs";
import http from "http";
import https from "https";
import gizmo from "gizmo-api";
import io = require("socket.io");

export default class Server {

    private readonly httpServer: http.Server | https.Server;
    private readonly ioServer: io.Server;

    constructor (port: number) {

        if (process.env.NODE_ENV === "production") {
            this.httpServer = https.createServer({
                key: fs.readFileSync("../../key.pem"),
                cert: fs.readFileSync("../../cert.pem")
            });
        } else {
            this.httpServer = http.createServer();
        }

        this.ioServer = io(this.httpServer);

        this.ioServer.sockets.on("connection", this.handleSocketConnection);

        this.httpServer.listen(port, () => {
            console.log(`Listening on port ${ port }`);
        });

    }

    private handleSocketConnection (socket: io.Socket) {

        socket.on("auth:attempt", async (client: any, callback: Function) => {
        
            if (!client?.token) {
                return callback({
                    type: "error",
                    reason: "User token is required"
                });
            }
    
            try {
    
                const user = await gizmo.getUser(client.token);
    
            } catch (err) {
    
                return callback({
                    type: "error",
                    reason: "User token is required"
                });
    
                throw err;
            }
    
        });

    }

}