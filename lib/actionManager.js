let { listClients, getClientByName, playQueueOnClient, searchForClient, genericClientAction } = require('./clientManager.js');
let { searchForMedia, createQueue } = require('./mediaManager.js');
let debug = require('debug')('plex-controller:actionManager');
let encodeURL = require('encodeurl');



/*
	TODO: NON GENERIC FUNCTIONS
	setParameters | setting the volume!
	skipTo | go to offset in something
*/


/*
	For the most part, play, pause, fast forward, rewind, and other similar commands are near identical in functionality. 
	Let's use one function and DRY!

	resume* | resume active media
	pause | pause active media
	stop | stop active media
	skipNext | go to next media item in queue
	skipPrevious | go to previous media item in queue
	stepForward | go forward X seconds
	stepBack | Go back X seconds
*/
async function performGenericActionOnClient(plexClient,options) {
	let targetClient = await searchForClient(plexClient,options); // Return a valid, reasonable, targetable device client
	// If no suitable client was found, time to error out here
	if(!targetClient) {
		debug('No targetable client ID found. Breaking process.')
		return { error: "Unable to find a device to act on." };
	}
	/*
		A suitable client was found, it's time to do some binding for the return.
	*/
	let targetClientID = targetClient.machineIdentifier; // get the target's machine ID
	let targetClientName = targetClient.name; // generic name of the target client
	options.targetClientID = targetClientID; // Bind the ID to our options
	options.targetClientName = targetClientName; // Bind the device's name to our options
	debug(`Targeting Client ${targetClientName} [${targetClientID}]...`);

	return await genericClientAction(plexClient,options);
}

async function resumeMediaOnClient(plexClient,options) {
	options.action = 'play'; // to "play" without targeted media/queue is just resuming existing media.
	return await genericActionOnClient(plexClient,options);
}

async function playMediaOnClient(plexClient,options) {
	/*
		Verify that a valid, targetable player exists.
	*/
	let targetClient = await searchForClient(plexClient,options); // Return a valid, reasonable, targetable device client
	// If no suitable client was found, time to error out here
	if(!targetClient) {
		debug('No targetable client ID found. Breaking process.')
		return { error: "Unable to find a device to play on." };
	}
	/*
		A suitable client was found, it's time to do some binding for the return.
	*/
	let targetClientID = targetClient.machineIdentifier; // get the target's machine ID
	let targetClientName = targetClient.name;
	options.targetClientID = targetClientID; // Bind the ID to our options
	options.targetClientName = targetClientName; // Bind the device's name to our options
	debug(`Targeting Client ${targetClientName} [${targetClientID}]...`);

	/*
		Next up, it's time to verify that the media the user is requesting exists and is valid
	*/
	let media = await searchForMedia(plexClient,options); // Return valid, targetable media by its unique keys
	if(!media) {
		debug('No targetable media found. Breaking process.');
		return { error: `No results found for ${options.targetMediaName}`};
	}
	debug(`Found media for search result: ${options.targetMediaName}...`);
	// We have our media! Let's keep going with it
	options.targetMedia = media;

	/*
		With Plex, we don't just pass the immediate media key to play it. We have to build a queue and pass THAT to the client.
	*/
	let queue = await createQueue(plexClient,options); // Build and return a valid, reasonable, queue to play

	// If we didn't get a queue back, something went wrong and we're not sure what.
	if(!queue) {
		debug('Invalid or empty queue. Breaking process..');
		return { error: "Something went wrong when creating the queue." };
	}
	// Bind our queue.
	options.queue = queue;
	// play the queue
	return await playQueueOnClient(plexClient,options);
}

async function performAction(plexClient,options) {
	let { action } = options;

	switch(action) {
		case 'play': // query media based on name, create, and play queue
		case 'shuffle': // just playing something random entirely...
			return await playMediaOnClient(plexClient,options);
			break;
		case 'resume': // continue playing whatever active media is.
			return await resumeMediaOnClient(plexClient,options);
			break;
		case 'pause': // pause active media
		case 'stop': // stop playing media entirely
		case 'stepForward': // Fast forward by 30 seconds
		case 'stepBack': // Rewind by 30 seconds
		case 'skipNext': // go to next media item in queue
		case 'skipPrevious': // go to previous media item in queue
			return await performGenericActionOnClient(plexClient,options);
			break;
		default:
			debug('No action specified.')
			return { error: "Unrecognized action" };
	}
}

module.exports = {
	performAction
}