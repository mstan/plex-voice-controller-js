require('dotenv').config(); // environment variable loading from file
let debug = require('debug')('plex-controller:main'); // debug logger
let PlexAPI = require('plex-api'); // plex API library

// library files
let { actionManager, serverManager } = require('./lib'); 
let { performAction } = actionManager;
let { getServers } = serverManager;

// Plex parameters for PlexAPI object
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


// Function to prepare Plex server
async function setup() {
	return new Promise( async (resolve,reject) => {
		let plexClient = await new PlexAPI(PLEX_PARAMETERS); // create plex server

		/*
		  By default, we expect a server machine ID for building queries with.
		  It's possible the user may not have set one yet, 
		*/ 
		if(!process.env.PLEX_DEFAULT_SERVER_MACHINE_ID) {
			debug('Warning: No Default Server was set. Consider setting a server below from the following Server IDs in your .env file')
			let servers = await getServers(plexClient);

			// invalid response or no servers found
			if(!servers || servers.length == 0) {
				throw new Error("No associated servers were found");
				process.exit(1);
			}

			/*
				List available servers so a default one can be set
			*/
			debug('Available servers');
			for(server in servers) {
				debug(`[${ servers[server].name }] ${ servers[server].machineIdentifier  }`)
			}

			/*
				Error out if more than one server is found and no default one is set.
				We intentionally error AFTER listing servers so a user can check logs and pull a server ID out to set a default one
			*/
			if(servers.length > 1) { 
				throw new Error("Multiple servers were found, but no default server is set.");
				process.exit(1);
			}


			// If we got here, we only found one server. Even if no default exists, let's set it as the active server for this instance.
			debug(`Defaulting to ${servers[0].name} [${servers[0].machineIdentifier}]`)
			process.env.PLEX_DEFAULT_SERVER_MACHINE_ID = servers[0].machineIdentifier;
			process.env.PLEX_API_CLIENT = plexClient;
		}

		resolve(plexClient);
	})
}

// Example of an options payload to be passed
/*
let options = {
	//targetClient: "LG 75SK8070AUB", // OPTIONAL
	targetMediaName: "tom and jerry",
	targetMediaType: "show",
	shuffle: 0, // 
	action: "shuffle"
}
*/

// Wrapper function of perform action. Consider adding more unique voiceCommand functionality here.
async function voiceCommand(plexClient,options) {
	return await performAction(plexClient, options);
}

module.exports = {
	setup,
	voiceCommand
}