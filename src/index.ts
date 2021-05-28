// Modules
import * as Sentry from "@sentry/node";

// Clases
import PoopShitter from "@classes/PoopShitter";

// Utils
import logger from "@utils/logger";

// Constants
import { FACE_OF_APATHY } from "@utils/constants";

console.log(FACE_OF_APATHY);

// Set up error logging
if (process.env.NODE_ENV === "production") {

    Sentry.init({
        dsn: process.env.SENTRY_DSN,
        tracesSampleRate: 1.0
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

logger.info(`Started in environment '${ process.env.NODE_ENV || "development" }'`);

new PoopShitter("Blame User");