// Modules
import { randomUUID } from "crypto";

// Utils
import logger from "@utils/logger";

// Types
import { RoomData } from "@typings/room";
import { User } from "gizmo-api/lib/types";

interface RoomConstruct {
	id: string;
	name: string;
	host: User;
	users: User[];
	data: RoomData | null;
}

export default class Room implements RoomConstruct {

	readonly id: string;
	readonly name: string;
	host: User;
	users: User[] = [];
	data: RoomData | null = null;

	constructor (name: string, host: User) {

		this.id = randomUUID({ disableEntropyCache: true });
		this.name = name;

		this.host = host;
		this.users.push(host);

	}

	join (user: User) {

		this.users = this.users.filter(_user => _user.id !== user.id);
		this.users.push(user);

		logger.info(`[R-${ this.id }] [${ user.username }] Joined room`);
	}

	leave (user: User) {

		this.users = this.users.filter(_user => _user.id !== user.id);

		logger.info(`[R-${ this.id }] [${ user.username }] Left room`);
	}


}