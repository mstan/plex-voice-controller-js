require('dotenv').config();
let debug = require('debug')('plex-controller:main');
let PlexAPI = require('plex-api');
let { actionManager, serverManager } = require('./lib');
let { performAction } = actionManager;
let { getServers } = serverManager;

const PLEX_PARAMETERS = {
	hostname: process.env.PLEX_HOSTNAME,
	username: process.env.PLEX_USERNAME,
	password: process.env.PLEX_PASSWORD,
	options: {
		identifier: process.env.PLEX_IDENTIFIER,
		product: process.env.PLEX_IDENTIFIER,
		deviceName: process.env.PLEX_IDENTIFIER
	}
}

console.log('test');
console.log(PLEX_PARAMETERS);
let plexClient = new PlexAPI(PLEX_PARAMETERS);

async function setup(client) {
	if(!process.env.PLEX_DEFAULT_SERVER_MACHINE_ID) {
		debug('Warning: No Default Server was set. Consider setting a server below from the following Server IDs in your .env file')
		let servers = await getServers(client);

		if(!servers || servers.length == 0) {
			throw new Error("No associated servers were found");
			process.exit(1);
		}

		debug('Available servers');
		for(server in servers) {
			debug(`[${ servers[server].name }] ${ servers[server].machineIdentifier  }`)
		}
		debug(`Defaulting to ${servers[0].name} [${servers[0].machineIdentifier}]`)
		process.env.PLEX_DEFAULT_SERVER_MACHINE_ID = servers[0].machineIdentifier;

		process.env.PLEX_API_CLIENT = client;
		return client;
	}
}


// Example of an options payload to be passed

/*
let options = {
	//targetClientName: "LG 75SK8070AUB", // OPTIONAL: DEBUG FOR NOW, to be abstracted later to various services
	targetMediaName: "tom and jerry",
	targetMediaTypes: ["show",],
	shuffle: 0, // 
	action: "shuffle"
}


performAction(plexClient, options).then((response) => {
	if(response && response.error) {
		debug('something went wrong', response.error);
	} else {
		debug('success!', response);
	}
})
.catch((error) => {
	debug(error);
	return { error };	
})
*/
setup(plexClient).then((result) => {
	module.exports = performAction;
})



