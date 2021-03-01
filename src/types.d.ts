// Modules
import { Socket } from "socket.io";
import { User } from "gizmo-api";

export interface Client {
    socket: Socket;
    user: User;
}