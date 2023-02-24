// Types
import type { User } from "gizmo-api";
import type { ErrorResponse, SocketCallback } from "@typings/main";
import type { CreateRoomOptions, ExportedRoom, InputRoomData, InputRoomProperties, JoinRoomOptions, PartialRoom, RoomSyncClientData, RoomSyncData } from "@typings/room";
import type { Message, MessagePayload } from "@typings/message";

export interface ServerToClientEvents {
	exception: (err: ErrorResponse) => void;
	"ROOM:MESSAGE": (message: Message) => void;
	"ROOM:USER_START_TYPING": (userId: number) => void;
	"ROOM:USER_STOP_TYPING": (userId: number) => void;
	"ROOM:CLIENT_REQUEST_ROOM_SYNC": (userId: number) => void;
}

export interface ClientToServerEvents {
	"CLIENT:AUTHENTICATE": (data: { token?: string }, callback: SocketCallback<User>) => void;
	"CLIENT:FETCH_ROOMS": (callback: SocketCallback<PartialRoom[]>) => void;
	"CLIENT:CREATE_ROOM": (options: CreateRoomOptions | unknown, callback: SocketCallback<ExportedRoom>) => void;
	"CLIENT:JOIN_ROOM": (options: JoinRoomOptions | unknown, callback: SocketCallback<ExportedRoom>) => void;
	"CLIENT:LEAVE_ROOM": (callback: SocketCallback<string>) => void;
	"CLIENT:UPDATE_ROOM": (newRoom: InputRoomProperties | unknown, callback: SocketCallback<string>) => void;
	"CLIENT:UPDATE_ROOM_DATA": (roomData: InputRoomData | unknown, callback: SocketCallback<string>) => void;
	"CLIENT:SYNC_ROOM": (syncData: RoomSyncData | unknown, callback: SocketCallback<string>) => void;
	"CLIENT:SYNC_ROOM_CLIENT": (syncData: RoomSyncClientData | unknown, callback: SocketCallback<string>) => void;
	"CLIENT:SEND_MESSAGE": (data: MessagePayload | unknown, callback: SocketCallback<Message>) => void;
	"CLIENT:FETCH_ONLINE_USERS": (callback: SocketCallback<User[]>) => void;
	"CLIENT:KICK_USER": (userId: number | unknown, callback: SocketCallback<string>) => void;
	"CLIENT:START_TYPING": () => void;
	"CLIENT:STOP_TYPING": () => void;
	"CLIENT:REQUEST_ROOM_SYNC": () => void;
}

export interface InterServerEvents {
	ping: () => void;
}

export interface SocketData {
	user?: User;
}
