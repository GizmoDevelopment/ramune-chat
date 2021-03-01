// Modules
import { Socket } from "socket.io";

// Types
import { Room } from "../types";

export function sanitizeRoomId (roomId: string) {
    return JSON.stringify(roomId); // DIY string sanitization, please don't actually do this
}

export function constructRoom (socket: Socket, roomId: string): Room {
    return {
        id: roomId,
        host: socket.id,
        data: null
    };
}

export function updateRoom (oldRoom: Room, newRoom: Record): Room {
    return {
        ...oldRoom,
        data: {
            ...(oldRoom?.data || {}),
            ...(newRoom?.data || {})
        }
    };
}