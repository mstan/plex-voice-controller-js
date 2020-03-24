let encodeURL = require('encodeurl');
let debug = require('debug')('plex-controller:mediaManager');


/* 
	Determines whether we should state this is video (TV, Movie) or music (Music)
*/
function _setMediaType(options) {
	let { targetMedia } = options;
	let type = targetMedia.type;

	let isVideo = 
	type == 'movie' ||
	type == 'show' || 
	type == 'episode' || 
	type == 'season';

	if(isVideo) {
		return'video';
	} else {
		return 'music';
	}
}

async function createQueue(client,options) {
	let machineIdentifier = process.env.PLEX_DEFAULT_SERVER_MACHINE_ID;
	let { targetMedia, action } = options;
	let targetMediaKey = targetMedia.ratingKey; // This is the unique key specified for this media.
	let shuffle = (action == "shuffle") ? 1 : 0; // if shuffle was specified, set it to true (1), otherwise not (0)
	let type = _setMediaType(options); // Plex requires we tell it the type it's going to play apparently, so this helper determines what's video vs music

	/*
		Time to build our createQueue URL
	*/
	let url = `/playQueues?` +
	`type=${type}` + // video or music?
	`&shuffle=${shuffle}` + // Are we shuffling this playlist? Only really relevant for songs or TV Shows
	`&repeat=0` +  // Should we repeat? For now, we assume always no for voice commands
	`&continuous=1` +  // continuous? Should it play one after the other? With a lack of remote, yes.
	`&own=1` + // unsure of what this really does
	`&uri=server://${machineIdentifier}/com.plexapp.plugins.library/library/metadata/${targetMediaKey}`;

	return client.postQuery(url).then((result) => {
		let queue = result.MediaContainer;

		if(!queue || queue.size == 0) {
			debug('Queue is empty. Nothing came back.');
			return null;
		}

		debug(`Enqueued ${queue.size} items. playQueueID is ${queue.playQueueID}, playQueueSelectedItemID is ${queue.playQueueSelectedItemID}`)
		queue.mediaType = type;
		return queue;
	})
	.catch((error) => {
		debug(`Something went wrong while generating a queue on Plex: ${error}`);
		return null;
	})
}


/*
	Using the string and media type, check to see if something matches what the request is asking for.
*/
async function searchForMedia(client,options) {
	let { targetMediaName, targetMediaTypes } = options; 
	// name of media we're searching for
	let mediaName = targetMediaName;
	/*
		media types -- type of media we're searching for:
		can be: "movie", "show", "season", "episode", "artist", "album", "track"
	*/
	let types = targetMediaTypes || []; // If targetMediaTypes was not passed (because it's optional), declare an empty array here for easy of logistics.

	// ensure that types is an array, and not a stringified array
	if( (typeof(types) === 'string') ) {
		try {
			types = JSON.parse(types);	
		} catch(error) {
			debug('Tried to parse string targetMediaTypes, but an error occurred, setting targetMediaTypes to an empty array');
			debug(error);
			types = [];
		}
	}
	// In order make comparison of strings easier, lowercase everything.
	types = types.map((type) => { return type.toLowerCase() }); //lowercase all input data for consistency

	// Build the query endpoint.
	let endpoint = encodeURL(`/search?query=${mediaName}`);

	return client.query(endpoint).then((result) => {
		let matches = result.MediaContainer.Metadata; // return everything that matched
		if(!matches || matches.length == 0) { // if an error occurred or 0 items were returned
			debug(`No matching media found for ${mediaName} ${JSON.stringify(types)}, returning...`);
			return null;
		} else {
			// We found some media. Now let's try and reduce our matches by only specifying the media types we specified.
			// filter by the requested media type(s) if types were specified (types > 0)
			if(types.length > 0) {
				/*
					Perform a filter where all matches with matching specified types exist
				*/
				matches = result.MediaContainer.Metadata.filter( (element) => { return types.indexOf(element.type.toLowerCase() ) > -1 }); 

				/*
					We just preformed af ilter, and we potentially run the risk of now zeroing out our array
					Check again to see if we should error out
				*/
				if(!matches || matches.length == 0) { // if an error occurred or 0 items were returned
					debug(`No matching media found for ${mediaName} ${JSON.stringify(types)}, returning...`);
					return null;
				}
			}

			// Now that we've filtered, let's pull the ratingKey (unique key) for each element we have now
			//matches = matches.map((element) => { return element.ratingKey });
			debug(`Media found for ${mediaName}, returning...`);
			return matches[0]; // let's just return the first element object only, since we're wanting to do the "best match"
		}
	})
	.catch((error) => {
		debug(error);
		return { error };	
	})
}

module.exports = {
	searchForMedia,
	createQueue
}