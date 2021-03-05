// Modules
import { Socket } from "socket.io";
import randtoken from "rand-token";

// Classes
import Server from "../classes/Server";

// Types
import { User } from "gizmo-api";
import { Room, SimpleRoom } from "../types";

export function sanitizeRoomId (roomId: string) {
    return roomId; // DIY string sanitization, please don't actually do this
}

export function constructRoom (socket: Socket, roomName: string): Room {
    return {
        id: randtoken.generate(32),
        name: roomName,
        host: socket.id,
        sockets: [],
        messages: [],
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

        if (hostUser) {

            // Go fuck yourself TypeShit
            const userList = _room.sockets.reduce((users: User[], socketId: string) => {
                const user = server.getUserFromSocketId(socketId);
                if (user) users.push(user);
                return users;
            }, [] as User[]);

            return {
                id: _room.id,
                name: _room.name,
                host: hostUser,
                users: userList,
                data: _room.data,
                messages: []
            };
        }
    }

}