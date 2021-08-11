// Modules
import { randomBytes, pbkdf2Sync } from "crypto";
import sanitizeHtml from "sanitize-html";

// Types
import { ErrorResponse, SuccessResponse } from "@typings/main";


// TODO: Rewrite using function overloads, since that has fucked me in the ass in the past

export function createSuccessResponse<T> (data: T, protocol?: string): SuccessResponse<T> {

	const response: SuccessResponse<T> = {
		type: "success",
		data
	};

	if (protocol) {
		response.protocol = protocol;
	}

	return response;
}

export function createErrorResponse (message: string, protocol?: string): ErrorResponse {

	const response: ErrorResponse = {
		type: "error",
		message
	};

	if (protocol) {
		response.protocol = protocol;
	}

	return response;
}

export function sanitize (input: string, options?: sanitizeHtml.IOptions): string {
	return sanitizeHtml(input, {
		allowedAttributes: {},
		allowedTags: [],
		allowedStyles: {},
		disallowedTagsMode: "recursiveEscape",
		...(options || {})
	});
}

export function generatePasswordHash (password: string): string {

	const salt = randomBytes(16).toString("hex");

	return pbkdf2Sync(password, salt, 1000, 64, "sha512").toString("hex");
}