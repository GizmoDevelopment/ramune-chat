declare namespace NodeJS {
	export interface ProcessEnv {
		NODE_ENV: string;
		SENTRY_DSN?: string;
		WEBSOCKET_PORT?: string;
		SHOW_ENDPOINT?: string;
		CORS_ORIGIN_DOMAIN?: string;
		BOT_TOKEN?: string;
	}
}