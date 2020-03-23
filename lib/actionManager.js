let { listClients, getClientByName, playQueueOnClient, searchForClient, genericClientAction } = require('./clientManager.js');
let debug = require('debug')('plex-controller:actionManager');
let encodeURL = require('encodeurl');


/*
	Using the string and media type, check to see if something matches what the request is asking for.
*/
async function _searchForMedia(client,options) {
	let mediaName = options.targetMediaName; // name of media we're searching for
	/*
		media types -- type of media we're searching for:
		can be: "movie", "show", "season", "episode", "artist", "album", "track"
	*/
	let types = options.targetMediaTypes || [];
	if( (typeof(types) === 'string') ) {
		types = JSON.parse(types);
	}
	types = types.map((type) => { return type.toLowerCase() }); //lowercase all input data for consistency


	let endpoint = encodeURL(`/search?query=${mediaName}`);

	return client.query(endpoint).then((result) => { // url encode query string
		let matches = result.MediaContainer.Metadata;
		if(!matches || matches.length == 0) {
			debug(`No matching media found for ${mediaName} [${JSON.stringify(types)}], returning...`);
			return null;
		} else {
			// filter by the requested media type(s) if types were specified
			if(types.length > 0) {
				matches = result.MediaContainer.Metadata.filter( (element) => { return types.indexOf(element.type.toLowerCase() ) > -1 }); // filter by media type for more concise results
			}

			matches = matches.map((element) => { return element.ratingKey });
			debug(`Media found for ${mediaName}, returning...`);
			return matches;
		}
	})
	.catch((error) => {
		debug(error);
		return { error };	
	})
}

/* 
	Determines whether we should state this is video (TV, Movie) or music (Music)
*/
function _setMediaType(options) {
	let { targetMediaTypes } = options;
	// logic
	let isVideo = targetMediaTypes.indexOf('movie') > -1 || 
	targetMediaTypes.indexOf('show') > -1 || 
	targetMediaTypes.indexOf("episode") > -1 ||
	targetMediaTypes.indexOf("season") > -1 // TODO: is season valid?

	if(isVideo) {
		return'video';
	} else {
		return 'music';
	}
}

async function _createQueue(client,options) {
	let machineIdentifier = process.env.PLEX_DEFAULT_SERVER_MACHINE_ID;
	let { targetMediaKey, action } = options;
	let shuffle = (action == "shuffle") ? 1 : 0; // if shuffle was specified, set it to true (1), otherwise not (0)
	let type = _setMediaType(options);

	let url = `/playQueues?` +
	`type=video` +
	`&shuffle=${shuffle}` +
	`&repeat=0` + 
	`&continuous=1` + 
	`&own=1` + // unsure of what this really does
	`&uri=server://${machineIdentifier}/com.plexapp.plugins.library/library/metadata/${targetMediaKey}`;

	return client.postQuery(url).then((result) => {
		let queue = result.MediaContainer;

		if(!queue || queue.size == 0) {
			debug('Queue is empty. Nothing came back.');
			return null;
		}

		debug(`Enqueued ${queue.size} items. playQueueID is ${queue.playQueueID}, playQueueSelectedItemID is ${queue.playQueueSelectedItemID}`)
		return queue;
	})
	.catch((error) => {
		debug(`Something went wrong while generating a queue on Plex: ${error}`);
		return null;
	})
}

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
async function performGenericActionOnClient(client,options) {
	// verify valid player
	let targetClient = await searchForClient(client,options); // pull device ID of device to be acted on
	if(!targetClient) {
		debug(`No targetable device ID found. Breaking ${options.action} process.`)
		return false;
	}
	let { machineIdentifier } = targetClient;
	let targetClientID = machineIdentifier;
	options.targetClientID = targetClientID;
	debug(`Targeting Client ID ${targetClientID}...`);

	return await genericClientAction(client,options);
}

async function resumeMediaOnClient(client,options) {
	options.action = 'play';
	return await genericActionOnClient(client,options);
}

async function playMediaOnClient(client,options) {
	// verify valid player
	let targetClient = await searchForClient(client,options); // pull device ID of device to be acted on
	if(!targetClient) {
		debug('No targetable client ID found. Breaking process.')
		return { error: "Unable to target any client" };
	}
	debug(targetClient);
	
	let targetClientID = targetClient.machineIdentifier;
	options.targetClientID = targetClientID;
	options.targetClientName = targetClient.name;
	debug(`Targeting Client ID ${targetClientID}...`);

	// verify valid media
	let mediaKey = await _searchForMedia(client,options);
	if(!mediaKey) {
		debug('No targetable media found. Breaking process.');
		return { error: "Unable to find media to play"};
	}

	debug(`Found media for search result: ${options.targetMediaName}...`);
	options.targetMediaKey = mediaKey;

	// build a queue
	let queue = await _createQueue(client,options);

	if(!queue) {
		debug('Invalid or empty queue. Breaking process..');
		return { error: "There was an error when trying to generate a queue" };
	}
	options.queue = queue;
	// play the queue
	return await playQueueOnClient(client,options);
}

async function performAction(client,options) {
	let { action } = options;

	switch(action) {
		case 'play': // query media based on name, create, and play queue
		case 'shuffle': // just playing something random entirely...
			return await playMediaOnClient(client,options);
			break;
		case 'resume': // continue playing whatever active media is.
		//case' continue': // commented out for now, but functionally equivalent to 'resume'
			return await resumeMediaOnClient(client,options);
			break;
		case 'pause': // pause active media
		case 'stop': // stop playing media entirely
		case 'stepForward': // Fast forward by 30 seconds
		case 'stepBack': // Rewind by 30 seconds
		case 'skipNext': // go to next media item in queue
		case 'skipPrevious': // go to previous media item in queue
			return await performGenericActionOnClient(client,options);
			break;
		default:
			debug('No action specified.')
			return { error: "Unrecognized action" };
	}
}

module.exports = {
	performAction
}