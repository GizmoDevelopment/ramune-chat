// Modules
import EventEmitter from "events";

// Classes
import Cluster from "./Cluster";

export default class Service extends EventEmitter {

	readonly name: string;
	readonly cluster: Cluster;

	ready: boolean = false;

	constructor (name: string, cluster: Cluster) {

		super();

		this.name = name;
		this.cluster = cluster;

		this.on("ready", () => this.ready = true);

	}

}