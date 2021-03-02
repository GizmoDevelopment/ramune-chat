// Modules
import { Socket } from "socket.io";

// Classes
import Server from "../classes/Server";

// Types
import { Room, SimpleRoom } from "../types";

export function sanitizeRoomId (roomId: string) {
    return roomId; // DIY string sanitization, please don't actually do this
}

export function constructRoom (socket: Socket, roomId: string): Room {
    return {
        id: roomId,
        host: socket.id,
        sockets: [],
        data: null
    };
}

export function updateRoom (oldRoom: Room, newRoom: Record<string, any>): Room {
    return {
        ...oldRoom,
        data: {
            ...(oldRoom?.data || {}),
            ...(newRoom?.data || {})
        }
    };
}

export function prepareRoomForSending (server: Server, room: Room): SimpleRoom | undefined;
export function prepareRoomForSending (server: Server, room: string): SimpleRoom | undefined;
export function prepareRoomForSending (server: Server, room: Room | string): SimpleRoom | undefined {

    let _room: Room | undefined;

    // RoomID was passed
    if (typeof room === "string") {
        const _roomResult = server.rooms.get(room);
        if (_roomResult) _room = _roomResult;
    } else {
        _room = room;
    }

    if (_room) {

        const hostUser = server.getUserFromSocketId(_room.host);

        if (hostUser) {
            return {
                id: _room.id,
                host: hostUser,
                users: [],
                data: _room.data
            };
        }
    }

}