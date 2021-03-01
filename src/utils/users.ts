// Modules
import { Socket } from "socket.io";
import { User } from "gizmo-api";

// Types
import { Client } from "../types";

export function constructClient (socket: Socket, user: User): Client {
    return {
        socket,
        user,
        data: {
            hostOfRoom: null
        }
    };
}