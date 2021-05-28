// Types
import { Show } from "@typings/show";

export { default as Room } from "@classes/Room";

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