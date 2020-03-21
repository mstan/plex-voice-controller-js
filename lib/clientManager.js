let debug = require('debug')('plex-controller:clientManager');

async function listClients(client) {
	return client.query('/clients').then( (result) => { // Return this whole promise, waiting for it to resolve
		return result.MediaContainer.Server; // return Plex's list of all available devices
	}) 
	.catch((error) => {
		debug(error);
		return { error};	
	})
}

async function getClientByName(client,name) {
	return listClients(client).then( (results) => {
		return results.find( (element) => { return element.name == name }); // Return device by name
	})
	.catch((error) => {
		debug(error);
		return { error};	
	})
}

async function playQueueOnClient(client,options) {
	let { targetClientID, queue } = options; 
	let { playQueueID, playQueueSelectedItemID } = queue;
	let hostname = process.env.PLEX_HOSTNAME;
	let port = process.env.PLEX_PORT;
	let offset = 0 || options.offset;
	let type = 'video';
	let serverMachineID = process.env.PLEX_DEFAULT_SERVER_MACHINE_ID;
	let accessToken = process.env.PLEX_ACCESS_TOKEN;

	let endpoint = `/player/playback/playMedia?` +
	`protocol=http` + 
	`&address=${hostname}` +
	`&port=${port}` +
	`&containerKey=/playQueues/${playQueueID}` + 
	`&key=/library/metadata/${playQueueSelectedItemID}` + 
	`&offset=0` +
	`&type=video` +
	`&commandID=1` +
	`&machineIdentifier=${serverMachineID}` + 
	`&token=${accessToken}`;

	let plexOptions = {
		uri: endpoint, // specified endpoint 
		extraHeaders: {
			'X-Plex-Target-Client-Identifier': targetClientID
		}
	}

	return client.postQuery(plexOptions).then((result) => {
		return result.Response.attributes;
	})
	.catch( (error) => {
		debug(error);
		return { error};
	})
}

/*
	Check to see if a device can be targeted to play the media to.
	First, check if an explicit client was targeted. If not, error out.
	If no explicit one was targeted, try to see if the default 
	If an explicit device is not targeted, try targeting the default set device
*/
async function searchForClient(client,options) {
	let targetClientName = options.targetClientName;
	let defaultTargetID = process.env.PLEX_DEFAULT_TARGET_CLIENT_MACHINE_ID;
	
	return new Promise( async (resolve,reject) => {
		// if a name was given, look for it.
		if(targetClientName) {
			debug('A device name was targeted, checking to see if it exists...');
			let targetClient = await getClientByName(client,targetClientName); // look up device by list of devices
			if(!targetClient) { // if we did a search and got undefined back, that target didn't exist. Fail out here
				debug(`Device name match for ${targetClientName} wasn't found, returning...`);
				resolve(null);
				return;
			}
			resolve(targetClient); // it did exist, let's return it
		} else {
			// no target was named, let's try to figure out if we can find something.
			let targetClients = await listClients(client); // get a list of all clients
			if(!targetClients) targetClients = []; // if we got a null object back, assign to empty array for ease of debugging

			let targetClientIDs = targetClients.map((client) => { return client.machineIdentifier }); // map a list of IDs from targetClientIDs

			// if a default client exists AND it's in the list of items, target it.
			if(defaultTargetID && (targetClientIDs.indexOf(defaultTargetID) > -1) ) { // No device was asked for, let's check for our default device that should be set.
				debug(`INFO: No target was specified. Defaulting to target ID ${defaultTargetID}`);
				resolve({ machineIdentifier: defaultTargetID});
				return;
			}	
			// if we're here, the defaultTarget wasn't returned OR no defaultTarget was set

			// exactly one available client exists. Let's target it and hope it's right!
			if(targetClients.length == 1) {
				debug(`WARN: No client target specified. No default one exists. Found exactly one client: ${targetClients[0].name}. Returning...`);
				resolve(targetClients[0]);
			} else {
			// either 0 or multiple clients were found. We aren't sure which to target. So let's return null
				if( process.env.DEBUG.includes("plex-controller:") ) {
					debug(`No device was targeted and no default device was unable to be found.`); 
					debug(`Consider setting a default device from one of the devices below`);
					let targetClients = await listClients(client);

					for(targetClient in targetClients) {
						debug(targetClients[targetClient]);
						debug(`[ ${ targetClients[targetClient].machineIdentifier } ] ${ targetClients[targetClient].name }`);
					}
				}

				resolve(null);	
			}
		}
	})
	.catch( (error) => {
		throw new Error(`Something went wrong in device selection:`, error);
	});
}

/*
	A generic client action helper 
*/
async function genericClientAction(client,options) {
	let { targetClientID, action } = options; 
	let hostname = process.env.PLEX_HOSTNAME;
	let port = process.env.PLEX_PORT;
	let offset = 0 || options.offset;
	let type = 'video';
	let serverMachineID = process.env.PLEX_DEFAULT_SERVER_MACHINE_ID;
	let endpoint = `/player/playback/${action}?` +
	`protocol="http"` + 
	`&address="${hostname}"` +
	`&port="${port}"` +
	`&type="video"` +
	`&commandID="1"` +
	`&machineIdentifier="${serverMachineID}"`;

	// TODO: This area gives 500 malformed request. Why?
	let plexOptions = {
		uri: endpoint, // specified endpoint 
		extraHeaders: {
			'X-Plex-Target-Client-Identifier': targetClientID // how you target the device ID -- double check ID is right.
		}
	}

	return client.postQuery(plexOptions).then((result) => {
		debug(result);
		return result;
	})
	.catch( (error) => {
		debug(error);
		return { error };
	})
}

module.exports = {
	listClients,
	getClientByName,
	playQueueOnClient,
	searchForClient,
	genericClientAction
}