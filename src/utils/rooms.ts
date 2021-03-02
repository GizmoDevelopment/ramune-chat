// Modules
import { Socket } from "socket.io";

// Classes
import Server from "../classes/Server";

// Types
import { User } from "gizmo-api";
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
export function prepareRoomForSending (server: Server, roomId: string): SimpleRoom | undefined;
export function prepareRoomForSending (server: Server, roomOrRoomId: Room | string): SimpleRoom | undefined {

    let _room: Room | undefined;

    // RoomID was passed
    if (typeof roomOrRoomId === "string") {
        const _roomResult = server.rooms.get(roomOrRoomId);
        if (_roomResult) _room = _roomResult;
    } else {
        _room = roomOrRoomId;
    }

    if (_room) {

        const hostUser = server.getUserFromSocketId(_room.host);

        // Go fuck yourself TypeShit
        const userList = _room.sockets.reduce((users: User[], socketId: string) => {
            const user = server.getUserFromSocketId(socketId);
            if (user) users.push(user);
            return users;
        }, [] as User[]);

        if (hostUser) {
            return {
                id: _room.id,
                host: hostUser,
                users: userList,
                data: _room.data
            };
        }
    }

}