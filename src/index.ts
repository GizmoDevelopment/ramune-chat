// Clases
import Sentry from "@sentry/node";
import Server from "./classes/Server";

// Utils
import logger from "./utils/logger";

// Set up error logging
if (process.env.NODE_ENV === "production") {

    Sentry.init({
        dsn: process.env.SENTRY_DSN
    });

    process.on("uncaughtException", (error) => {
        logger.error(error);
        Sentry.captureException(error);
    });
    
    process.on("unhandledRejection", (error) => {
        logger.error(error);
        Sentry.captureException(error);
    });

} else {
    process.on("uncaughtException", logger.error);
    process.on("unhandledRejection", logger.error);
}

