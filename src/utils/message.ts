// Modules
import { v4 as uuidv4 } from "uuid";

// Utils
import { sanitize } from "./essentials";

// Types
import { User } from "gizmo-api/lib/types";
import { Message } from "@typings/message";

export function constructMessage (user: User, messageContent: string): Message {

	const _messageContent = messageContent.trim().slice(0, 500);

	return {
		id: uuidv4(),
		user,
		content: user.badges.includes("DEVELOPER") ? _messageContent : sanitize(_messageContent)
	};
}