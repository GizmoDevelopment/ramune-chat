// Modules
import { Socket } from "socket.io";
import { User } from "gizmo-api";

declare global {
    namespace NodeJS {
        export interface ProcessEnv {
            NODE_ENV: string;
            PORT: string;
        }
    }
}

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
    name: string;
    host: string;
    sockets: SocketId[];
    data: RoomData;
    messages: Message[];
}

export interface SimpleRoom {
    id: string;
    name: string;
    host: User;
    users: User[];
    data: RoomData;
}

export type RoomData = null | {
    showId: string;
    episodeId: string;
};

export interface Message {
    id: string;
    type: string;
    content: string;
    author: User;
}