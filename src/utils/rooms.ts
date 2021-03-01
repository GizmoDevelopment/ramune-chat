// Types
import { Room } from "../types";

export function sanitizeRoomId (roomId: string) {
    return JSON.stringify(roomId); // DIY string sanitization, please don't actually do this
}

export function createRoom (roomId: string): Room {
    return {
        id: roomId,
        data: null
    };
}