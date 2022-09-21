// Modules
import * as Sentry from "@sentry/node";
import logger from "@gizmo-dev/logger";

// Clases
import PoopShitter from "@classes/PoopShitter";

// Constants
import { FACE_OF_APATHY } from "@utils/constants";
import { version } from "../package.json";

console.log(FACE_OF_APATHY);

// Set up error logging
if (process.env.NODE_ENV === "production" && process.env.SENTRY_DSN) {

	Sentry.init({
		dsn: process.env.SENTRY_DSN,
		tracesSampleRate: 1.0
	});

	process.on("uncaughtException", (error: Error) => {
		logger.error(error);
		Sentry.captureException(error);
	});

	process.on("unhandledRejection", (error: Error) => {
		logger.error(error);
		Sentry.captureException(error);
	});

} else {
	process.on("uncaughtException", logger.error);
	process.on("unhandledRejection", logger.error);
}

if (!process.env.CORS_ORIGIN_DOMAIN) throw Error("Missing environmental variable 'CORS_ORIGIN_DOMAIN'");
if (!process.env.WEBSOCKET_PORT) throw Error("Missing environmental variable 'WEBSOCKET_PORT'");
if (!process.env.SHOW_ENDPOINT) throw Error("Missing environmental variable 'SHOW_ENDPOINT'");

logger.info(`Version '${version}'`);
logger.info(`Environment '${process.env.NODE_ENV || "development"}'`);

new PoopShitter("Blame User");