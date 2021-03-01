// Modules
import fs from "fs";
import http from "http";
import https from "https";
import socket from "socket.io";

// Variables
let httpServer: http.Server | https.Server;

if (process.env.NODE_ENV === "production") {
    httpServer = https.createServer({
        key: fs.readFileSync("key.pem"),
        cert: fs.readFileSync("cert.pem")
    });
} else {
    httpServer = http.createServer();
}

const io = socket(httpServer);