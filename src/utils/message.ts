// Modules
import { randomUUID } from "crypto";

// Utils
import { sanitize } from "./essentials";

// Types
import { User } from "gizmo-api/lib/types";
import { Message } from "@typings/message";

export function constructMessage (user: User, messageContent: string): Message {

	const _messageContent = messageContent.trim().slice(0, 500);

	return {
		id: randomUUID(),
		user,
		content: user.badges.includes("DEVELOPER") ? _messageContent : sanitize(_messageContent)
	};
}