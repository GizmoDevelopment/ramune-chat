// Modules
import { Socket } from "socket.io";

// Types
import { Room } from "../types";

export function sanitizeRoomId (roomId: string) {
    return JSON.stringify(roomId); // DIY string sanitization, please don't actually do this
}

export function constructRoom (roomId: string, socket: Socket): Room {
    return {
        id: roomId,
        host: socket.id,
        data: null
    };
}