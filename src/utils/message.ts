// Modules
import { v4 as uuidv4 } from "uuid";

// Utils
import { sanitize } from "./essentials";

// Types
import { User } from "gizmo-api/lib/types";
import { Message } from "@typings/message";

export function constructMessage (user: User, messageContent: string): Message {
	return {
		id: uuidv4(),
		user,
		content: sanitize(messageContent.trim().slice(0, 500))
	};
}