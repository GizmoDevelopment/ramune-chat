export interface BaseResponse {
	type: "success" | "error";
	protocol?: string;
	message?: string;
}

export interface SuccessResponse<T> extends BaseResponse {
	type: "success";
	data: T;
}

export interface ErrorResponse extends BaseResponse {
	type: "error";
	message: string;
}

export type ServerResponse<T> = SuccessResponse<T> | ErrorResponse;

export type SocketCallback<T> = (response: ServerResponse<T>) => void;
export type SocketErrorCallback = (response: ErrorResponse) => void;