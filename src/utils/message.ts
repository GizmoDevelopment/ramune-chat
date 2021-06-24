// Utils
import { sanitize } from "./essentials";

// Types
import { User } from "gizmo-api/lib/types";
import { Message } from "@typings/message";

export function constructMessage (user: User, messageContent: string): Message {
	return {
		userId: user.id,
		content: sanitize(messageContent.trim())
	};
}