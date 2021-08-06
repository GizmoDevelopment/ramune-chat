// Modules
import axios from "axios";

// Utils
import { SHOW_ENDPOINT } from "@utils/constants";
import logger from "@utils/logger";

// Types
import { Show, Episode } from "@typings/show";

export async function getShow (showId: string): Promise<Show|null> {
	try {

		const { data: response } = await axios.get(`${SHOW_ENDPOINT}/shows/${showId}`);

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

export function getEpisodeById (show: Show, episodeId: number): Episode | null {

	let _episode: Episode | null = null;

	show.seasons.forEach(({ episodes }) => {
		episodes.forEach((episode: Episode) => {
			if (episode.id === episodeId) {
				_episode = episode;
			}
		});
	});

	return _episode;
}