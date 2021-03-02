// Modules
import { Socket } from "socket.io";
import { User } from "gizmo-api";

export interface Client {
    socket: Socket;
    user: User;
    data: {
        hostOfRoom: string | null;
    };
}

export interface ExtendedUser extends User {
    host: boolean;
}

export type SocketId = string;

export interface Room {
    id: string;
    host: string;
    sockets: SocketId[];
    data: RoomData;
}

export interface SimpleRoom {
    id: string;
    host: User;
    users: User[];
    data: RoomData;
}

export type RoomData = null | {
    showId: string;
    episodeId: string;
};