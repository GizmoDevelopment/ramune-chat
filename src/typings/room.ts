// Types
import { User } from "gizmo-api/lib/types";
import { Show } from "@typings/show";

export interface PartialRoom {

	readonly id: string;
	readonly name: string;

	host: User;
	users: User[];
}

export interface Room {

	readonly id: string;
	readonly name: string;

	host: User;
	users: User[];
	data: RoomData | null;

}

export interface RoomData {
	show: Show;
	episodeId: number;
}

export interface RoomOptions {
	name: string;
}

export interface RoomSyncData {
	playing: boolean;
	currentTime: number;
}

export interface UpdatableRoomProperties {
	host?: User;
}

export interface InputRoomData {
	showId: string;
	episodeId: number;
}

export interface InputRoomProperties {
	hostId?: number;
}

// Type Guards

export function isRoomOptions (x: unknown): x is RoomOptions {
	return typeof x === "object" && x !== null && typeof (x as RoomOptions)?.name === "string";
}

export function isInputRoomData (x: unknown): x is InputRoomData {
	return typeof x === "object" && x !== null && typeof (x as InputRoomData)?.showId === "string" && typeof (x as InputRoomData)?.episodeId === "string";
}

export function isInputRoomProperties (x: unknown): x is InputRoomProperties {
	return typeof x === "object" && x !== null;
}

export function isRoomSyncData (x: unknown): x is RoomSyncData {
	return typeof x === "object" && x !== null && typeof (x as RoomSyncData)?.currentTime === "number" && typeof (x as RoomSyncData)?.playing === "boolean";
}