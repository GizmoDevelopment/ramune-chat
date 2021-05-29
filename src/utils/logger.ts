// Variables
import { COLORS } from "@utils/constants";

/**
 * Returns formatted date label for use in console
 */
function getDateLabel () {
    return `${ COLORS.BrightBlack }[${
        new Date().toLocaleString("default", {
            month: "short",
            day: "numeric",
            hour: "numeric",
            minute: "numeric",
            second: "numeric",
            hour12: false
        })
    }]${ COLORS.NC }`;
}

/**
 * Logs a message to the console
 * @param message 
 * @param color 
 */
function log (message: any, color: string = COLORS.NC) {

    message = String(message);

    // Color words in 'single quotes' and {curly braces}
    message = message.replace(/('.*?')|(\[.*?\])/g, `${COLORS.BrightBlue}$1$2${color}`);

    console.log(`${getDateLabel()}${color} ${message}${COLORS.NC}`);
}

/**
 * Logs a basic message to the console
 * @param message 
 */
function info (message: string) {
    log(message);
}

/**
 * Logs a success message to the console
 * @param message
 */
function success (message: string) {
    log(message, COLORS.Green);
}

/**
 * Logs an error message to the console
 * @param message
 */
function error (message: any) {
    log(message?.stack ? message.stack : message, COLORS.Red);
}

export default {
    info,
    success,
    error
};