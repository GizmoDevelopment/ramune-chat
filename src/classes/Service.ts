// Modules
import EventEmitter from "events";

// Classes
import type PoopShitter from "./PoopShitter";

export default class Service extends EventEmitter {

	readonly name: string;
	readonly cluster: PoopShitter;

	ready = false;

	constructor (name: string, cluster: PoopShitter) {

		super();

		this.name = name;
		this.cluster = cluster;

		this.on("ready", () => this.ready = true);

	}

}