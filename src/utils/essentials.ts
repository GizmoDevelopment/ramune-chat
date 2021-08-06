// Modules
import sanitizeHtml from "sanitize-html";

// Types
import { BaseResponse, ErrorResponse, SuccessResponse } from "@typings/main";

export function createResponse<T> (type: "success", data: T, protocol?: string): SuccessResponse<T>;
export function createResponse (type: "error", message: string, protocol?: string): ErrorResponse;
export function createResponse (type: "success" | "error", dataOrMessage: any, protocol?: string): unknown {

	const res: BaseResponse = {
		type
	};

	if (protocol) {
		res.protocol = protocol;
	}

	if (type === "success") {
		(res as SuccessResponse<unknown>).data = dataOrMessage;
	} else {
		(res as ErrorResponse).message = dataOrMessage;
	}

	return res;
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