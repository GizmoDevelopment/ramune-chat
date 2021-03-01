// Modules
import { Socket } from "socket.io";
import { User } from "gizmo-api";

export interface Client {
    socket: Socket;
    user: User;
    data: {
        hostOfRoom: string;
    };
}

export interface ExtendedUser extends User {
    host: boolean;
}

export interface Room {
    id: string;
    data: null | {
        showId: string;
        episodeId: string;
    };
}