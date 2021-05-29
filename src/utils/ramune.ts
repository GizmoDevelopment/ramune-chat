// Modules
import axios from "axios";

// Utils
import { SHOW_ENDPOINT } from "@utils/constants";
import logger from "@utils/logger";

// Types
import { Show } from "@typings/show";

export async function getShow (showId: string): Promise<Show|null> {
	try {

		const { data: response } = await axios.get(`${ SHOW_ENDPOINT }/shows/${ showId }`);

		if (response.type === "success" && response.data) {
			return response.data;
		} else {
			throw new Error(response.message);
		}

	} catch (err) {
		logger.error(err);
		return null;
	}
}