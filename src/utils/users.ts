// Modules
import { Socket } from "socket.io";
import { User } from "gizmo-api/lib/types";

// Types
import { Client, ExtendedUser } from "../types";

export function constructClient (socket: Socket, user: User): Client {
    return {
        socket,
        user,
        data: {
            hostOfRoom: null
        }
    };
}

export function constructExtendedUser (client: Client): ExtendedUser {
    return {
        ...client.user,
        host: !!client.data.hostOfRoom
    };
}