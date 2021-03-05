// Modules
import sanitizeHtml from "sanitize-html";

// Types
import { User } from "gizmo-api";
import { Room, Message } from "../types";

function cleanMessageContent (content: string) {
    return sanitizeHtml(content, {
        allowedTags: [ "b", "i" ]
    });
}

export function constructMessage (room: Room, user: User, content: string): Message {
    return {
        id: room.messages.length.toString(),
        type: "text",
        content: cleanMessageContent(content),
        author: user
    };
}