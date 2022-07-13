// Types
import type { User } from "gizmo-api";

export interface Message {
	id: string;
	user: User;
	content: string;
}

export interface MessagePayload {
	content: string;
}

// Type Guards

export function isMessagePayload (x: unknown): x is MessagePayload {
	return typeof x === "object" && x !== null && typeof (x as MessagePayload)?.content === "string";
}