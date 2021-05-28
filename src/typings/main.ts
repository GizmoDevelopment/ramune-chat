declare global {
    namespace NodeJS {
        export interface ProcessEnv {
            NODE_ENV: string;
			SENTRY_DSN: string;
			WEBSOCKET_PORT: string;
			REDIS_PORT: string;
        }
    }
}

interface BaseResponse {
	type: "success" | "error";
	message?: string;
}

export interface SuccessResponse<T = undefined> extends BaseResponse {
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