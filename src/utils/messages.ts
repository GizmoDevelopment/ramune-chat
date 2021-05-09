// Modules
import sanitizeHtml from "sanitize-html";

// Types
import { User } from "gizmo-api/lib/types";
import { Room, Message } from "../types";

function cleanMessageContent (content: string) {
    return sanitizeHtml(content);
}

export function constructMessage (room: Room, user: User, content: string): Message {
    return {
        id: room.messages.length.toString(),
        type: "text",
        content: cleanMessageContent(content.slice(0, 400)).slice(0, 400),
        author: user
    };
}