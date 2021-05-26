// Modules
import fs from "fs";
import path from "path";

// Classes
import Service from "@classes/Service";

// Utils
import logger from "@utils/logger";

// Constants
const SERVICES_DIR = path.join(__dirname, "../services");

export default class Cluster {

	name: string;
	services: Map<string, Service> = new Map();

	constructor (name: string) {

		this.name = name;

		fs.readdirSync(SERVICES_DIR).forEach(serviceFile => {
			if (path.extname(serviceFile) === ".ts") {

				const
					servicePath = path.join(SERVICES_DIR, serviceFile),
					{ default: serviceClass }: any = require(servicePath);

				if (typeof serviceClass === "function") {

					const service: any = new serviceClass();

					if (service instanceof Service) {
						this.services.set(service.name, service);
						logger.success(`Successfully started Service '${ service.name }'`);
					}
				}

				delete require.cache[servicePath];
			}
		});

		logger.success(`Successfully started Cluster '${ this.name }'`);

	}

}