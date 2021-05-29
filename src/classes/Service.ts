// Modules
import EventEmitter from "events";

// Classes
import PoopShitter from "./PoopShitter";

export default class Service extends EventEmitter {

	readonly name: string;
	readonly cluster: PoopShitter;

	ready: boolean = false;

	constructor (name: string, cluster: PoopShitter) {

		super();

		this.name = name;
		this.cluster = cluster;

		this.on("ready", () => this.ready = true);

	}

}