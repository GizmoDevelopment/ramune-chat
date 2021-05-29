// Modules
import { v4 as uuidv4 } from "uuid";

// Classes
import WebsocketService from "services/websocket";

// Utils
import logger from "@utils/logger";

// Types
import { RoomData, UpdatableRoomProperties } from "@typings/room";
import { User } from "gizmo-api/lib/types";

interface RoomConstruct {

	readonly websocketService: WebsocketService;

	readonly id: string;
	readonly name: string;

	host: User;
	users: User[];
	data: RoomData | null;

}

export default class Room implements RoomConstruct {

	readonly websocketService: WebsocketService;

	readonly id: string;
	readonly name: string;

	host: User;
	users: User[] = [];
	data: RoomData | null = null;

	constructor (name: string, host: User, wsService: WebsocketService) {

		this.websocketService = wsService;

		this.id = uuidv4();
		this.name = name;

		this.host = host;
		this.users.push(host);

		logger.info(`[R-${ this.id }] [${ host.username }] Created room`);
	}

	join (user: User) {

		this.users = this.users.filter(_user => _user.id !== user.id);
		this.users.push(user);

		this.websocketService.ioServer.to(this.id).send("ROOM:USER_JOIN", user);

		logger.info(`[R-${ this.id }] [${ user.username }] Joined room`);
	}

	leave (user: User) {

		this.users = this.users.filter(_user => _user.id !== user.id);

		this.websocketService.ioServer.to(this.id).send("ROOM:USER_LEAVE", user);

		this.update({ host: this.users[0] });

		logger.info(`[R-${ this.id }] [${ user.username }] Left room`);
	}

	update (data: UpdatableRoomProperties) {

		const { host: newHost } = data;

		if (newHost) {
			this.host = newHost;
		}

		this.websocketService.ioServer.to(this.id).send("ROOM:UPDATE", data);

		logger.info(`[R-${ this.id }] Updated room with '${ data }'`);
	}

	updateData (data: RoomData) {

		this.data = data;
		this.websocketService.ioServer.to(this.id).send("ROOM:UPDATE_ROOM_DATA", data);

		logger.info(`[R-${ this.id }] Updated room data with '${ data }'`);
	}


}