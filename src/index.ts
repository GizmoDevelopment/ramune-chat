// Modules
import Sentry from "@sentry/node";
import { ErrorReporting } from "@google-cloud/error-reporting";

// Clases
import Server from "./classes/Server";

// Utils
import logger from "./utils/logger";

// Set up error logging
if (process.env.NODE_ENV === "production") {

    const reporter = new ErrorReporting();

    Sentry.init({
        dsn: process.env.SENTRY_DSN,
        tracesSampleRate: 1.0
    });

    process.on("uncaughtException", (error) => {
        reporter.report(error);
        logger.error(error);
        Sentry.captureException(error);
    });
    
    process.on("unhandledRejection", (error) => {
        reporter.report(error);
        logger.error(error);
        Sentry.captureException(error);
    });

} else {
    process.on("uncaughtException", logger.error);
    process.on("unhandledRejection", logger.error);
}

if (!process.env.PORT) throw Error("Missing environmental variable 'PORT'");
new Server(Number(process.env.PORT) || 1337);