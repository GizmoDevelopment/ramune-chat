// Types
import type { User } from "gizmo-api";
import type { Show } from "@typings/show";

export interface PartialRoom {

	readonly id: string;
	readonly name: string;

	readonly locked: boolean;

	readonly host: User;
	readonly users: User[];
}

export interface ExportedRoom {

	// Needed otherwise TS thinks ExportedRoom & Room are overlapping interfaces (fuck off)
	readonly _exported: boolean;

	readonly id: string;
	readonly name: string;

	readonly locked: boolean;

	readonly host: User;
	readonly users: User[];
	readonly data: RoomData | null;
}

export interface Room {

	readonly id: string;
	readonly name: string;

	locked: boolean;
	password?: string;

	host: User;
	users: User[];
	data: RoomData | null;
}

export interface RoomData {
	show: Show;
	episodeId: number;
}

export interface JoinRoomOptions {
	id: string;
	password?: string;
}

export interface CreateRoomOptions {
	name: string;
	password?: string;
}

export interface RoomSyncData {
	playing: boolean;
	currentTime: number;
}

export interface RoomSyncClientData {
	userId: number;
	data: RoomSyncData;
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

export function isJoinRoomOptions (x: unknown): x is JoinRoomOptions {
	return typeof x === "object" && x !== null && typeof (x as JoinRoomOptions)?.id === "string";
}

export function isCreateRoomOptions (x: unknown): x is CreateRoomOptions {
	return typeof x === "object" && x !== null && typeof (x as CreateRoomOptions)?.name === "string";
}

export function isInputRoomData (x: unknown): x is InputRoomData {
	return typeof x === "object" && x !== null && typeof (x as InputRoomData)?.showId === "string" && typeof (x as InputRoomData)?.episodeId === "number";
}

export function isInputRoomProperties (x: unknown): x is InputRoomProperties {
	return typeof x === "object" && x !== null;
}

export function isRoomSyncData (x: unknown): x is RoomSyncData {
	return typeof x === "object" && x !== null && typeof (x as RoomSyncData)?.currentTime === "number" && typeof (x as RoomSyncData)?.playing === "boolean";
}

export function isRoomSyncClientData (x: unknown): x is RoomSyncClientData {
	return typeof x === "object" && x !== null && typeof (x as RoomSyncClientData)?.userId === "number" && isRoomSyncData((x as RoomSyncClientData)?.data);
}