// Modules
import axios from "axios";

// Utils
import { SHOW_ENDPOINT } from "@utils/constants";
import logger from "@utils/logger";

// Types
import { Show, Episode } from "@typings/show";

export async function getShow (showId: string): Promise<Show | null> {
	try {

		const { data: response } = <any>await axios.get(`${SHOW_ENDPOINT}/shows/${showId}`);

		if (response.type === "success" && response.data) {
			return response.data;
		} else {
			throw Error(response.message);
		}

	} catch (err: unknown) {
		logger.error(err);
		return null;
	}
}

export function getEpisodeById (show: Show, episodeId: number): Episode | null {

	let accumulativeLength = 0;

	for (let i = 0; i <= show.seasons.length; i++) {

		const season = show.seasons[i];

		if (season) {

			const _accumulativeLength = accumulativeLength;
			accumulativeLength += season.episodes.length;

			if (episodeId <= accumulativeLength) {
				return season.episodes[episodeId - _accumulativeLength - 1];
			}
		}
	}

	return null;
}