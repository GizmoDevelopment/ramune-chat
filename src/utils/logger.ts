// Variables
import { COLORS } from "@utils/constants";

function getDateLabel (): string {
	return `${COLORS.BrightBlack}[${
		new Date().toLocaleString("default", {
			month: "short",
			day: "numeric",
			hour: "numeric",
			minute: "numeric",
			second: "numeric",
			hour12: false
		})
	}]${COLORS.NC}`;
}

function log (message: string, color: string = COLORS.NC): void {

	// Color words in 'single quotes' and {curly braces}
	message = message.replace(/('.*?')|(\[.*?\])/g, `${COLORS.BrightBlue}$1$2${color}`);

	console.log(`${getDateLabel()}${color} ${message}${COLORS.NC}`);
}

function info (message: string): void {
	log(message);
}

function success (message: string): void {
	log(message, COLORS.Green);
}

function warn (message: string): void {
	log(message, COLORS.Yellow);
}

/**
 * Logs an error message to the console
 */
function error (message: unknown): void {
	if (message instanceof Error && message.stack) {
		log(message.stack, COLORS.Red);
	} else {
		log(`${message}`, COLORS.Red);
	}
}

export default {
	log,
	info,
	success,
	warn,
	error
};