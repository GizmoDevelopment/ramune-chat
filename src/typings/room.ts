// Types
import { User } from "gizmo-api/lib/types";
import { Show } from "@typings/show";

export interface Room {
	id: string;
	name: string;
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