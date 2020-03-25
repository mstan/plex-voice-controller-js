let debug = require('debug')('plex-controller:clientManager');

async function listClients(plexClient) {
	return plexClient.query('/clients').then( (result) => { // Return this whole promise, waiting for it to resolve
		return result.MediaContainer.Server; // return Plex's list of all available devices
	}) 
	.catch((error) => {
		debug(error);
		return { error };	
	})
}

async function getClientByName(plexClient,name) {
	return listClients(plexClient).then( (results) => {
		return results.find( (element) => { return element.name == name }); // Return device by name
	})
	.catch((error) => {
		debug(error);
		return { error };	
	})
}

async function playQueueOnClient(plexClient,options) {
	let { targetClientID, queue } = options;  // targetClientID is the target media player to play on, the queue is the queue itself to be played
	let { playQueueID, playQueueSelectedItemID, mediaType } = queue; // playQueueID is the ID of the queue, playQueueSelctedItemID is the start of the queue
	let hostname = process.env.PLEX_HOSTNAME; // IP of media hosting server
	let port = process.env.PLEX_PORT; // Port of medai hosting server
	let offset = 0 || options.offset; // Offset, where in the queue should we start? Ideally always index 0
	let type = mediaType; // video or music? Passed for URL purposes.
	let serverMachineID = process.env.PLEX_DEFAULT_SERVER_MACHINE_ID; // Device ID of the server hosting the media
	let accessToken = process.env.PLEX_ACCESS_TOKEN; // The access token for letting Plex do the commands

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

	// We have to pass the targetClient as a header, so let's add it here.
	let plexOptions = {
		uri: endpoint, // specified endpoint 
		extraHeaders: {
			'X-Plex-Target-Client-Identifier': targetClientID
		}
	}

	return plexClient.postQuery(plexOptions).then((result) => {
		let response = result.Response.attributes;
		response.clientName = options.targetClientName;
		return response;
	})
	.catch( (error) => {
		debug(error);
		return { error };
	})
}

/*
	Check to see if a device can be targeted to play the media to.
	First, check if an explicit client was targeted. If it can't be found, return null.
	If no explicit client was named, list all and see if we can't find our targeted default one
	If a client was not named, a default client was not found, and only was target was returned, use this one.
	Otherwise, if we did not have an explicit named target, no default one exists, and we have either 0 or > 1 returned, let's return null.
*/
async function searchForClient(plexClient,options) {
	let targetClientName = options.targetClientName; // Name of the client device we are targeting
	let defaultTargetID = process.env.PLEX_DEFAULT_TARGET_CLIENT_MACHINE_ID; // The machien ID of the defualt target client, if one is set.
	
	return new Promise( async (resolve,reject) => {
		// First thing's first, if we got a name, we should try to find it as the first course of action, even over a default device ID
		if(targetClientName) {
			debug('A device name was targeted, checking to see if it exists...');
			let targetClient = await getClientByName(client,targetClientName); // look up device by list of devices
			if(!targetClient) { // if we did a search and got undefined back, that target didn't exist. Fail out here
				debug(`Device name match for ${targetClientName} wasn't found, returning...`);
				resolve(null);
				return;
			}
			resolve(targetClient); // it did exist! let's return it
			return;
		} else {
			// no target was named, let's try to figure out if we can find something.
			let targetClients = await listClients(plexClient); // get a list of all clients
			if(!targetClients) {
				targetClients = []; // if we got a null object back, assign to empty array for ease of debugging
			}

			let targetClientIDs = targetClients.map((client) => { return client.machineIdentifier }); // Create an array of only machineIdentifiers from all the clients

			/*
				We now have a list of available clients. 
				The first order of business is to see if your preferred, default client exists.
				If it does, we're going to target this one.
			*/
			if(defaultTargetID && (targetClientIDs.indexOf(defaultTargetID) > -1) ) {
				debug(`INFO: No target was specified. Defaulting to target ID ${defaultTargetID}`);
				let targetClient = targetClients.filter((targetClient) => { return targetClientIDs.indexOf(defaultTargetID) > -1 }); //get the default target client from this list
				//debug('the client is', targetClient); 
				resolve(targetClient[0]); // return this target client
				return;
			}	
			// if we're here, there was no named client AND the default one was not found.

			// Our next fallthrough case is whether or not we have exactly one client.
			// Since we do, let's just target it and move on.
			if(targetClients.length == 1) {
				debug(`WARN: No client target specified. No default one exists. Found exactly one client: ${targetClients[0].name}. Returning...`);
				resolve(targetClients[0]);
			} else {
			// either 0 or multiple clients were found. We aren't sure which to target. So let's error out.

				// Specifically for debugging, if end up in this state, we should list out what available clients exist in case our user wants to set one later
				if( process.env.DEBUG.includes("plex-controller:") && targetClients.length > 0 ) {
					debug(`No device was targeted and no default device was unable to be found.`); 
					debug(`Consider setting a default device from one of the devices below`);
					let targetClients = await listClients(client);

					for(targetClient in targetClients) {
						debug(targetClients[targetClient]);
						debug(`[ ${ targetClients[targetClient].machineIdentifier } ] ${ targetClients[targetClient].name }`);
					}
				}

				// We're done, time to return nothing.
				resolve(null);	
			}
		}
	})
	.catch( (error) => {
		debug(error);
		throw new Error(`There was an issue in device selection:`, error);
	});
}

/*
	A generic client action helper 
*/
async function genericClientAction(client,options) {
	debug(options);
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
		let response = result.Response.attributes;
		response.clientName = options.targetClientName;
		return response;
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