// Modules
import EventEmitter from "events";

export default class Service extends EventEmitter {

	readonly name: string;

	ready: boolean = false;

	constructor (name: string) {

		super();

		this.name = name;

		this.on("ready", () => this.ready = true);

	}

}