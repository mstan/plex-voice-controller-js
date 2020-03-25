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

function _getMediaIndex(mediaType) {
	switch(mediaType.toLowerCase() ) {
		case 'movie':
			return 1;
		case 'show':
			return 2;
		case 'season':
			return 3;
		case 'episode':
			return 4;
		case 'trailer':
			return 5;
		case 'comic':
			return 6;
		case 'person':
			return 7;
		case 'artist':
			return 8;
		case 'album':
			return 9;
		case 'track':
			return 10;
		case 'photoAlbum':
			return 11;	
		case 'picture':
			return 12;
		case 'photo':
			return 13;
		case 'clip':
			return 14;
		case 'playlistItem':
			return 15;
		default:
			return;
	}
}

async function createQueue(plexClient,options) {
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

	return plexClient.postQuery(url).then((result) => {
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
async function searchForMedia(plexClient,options) {
	debug(options);
	let { targetMediaName, targetMediaType } = options; 	
	/*
		media types -- type of media we're searching for:
		can be: "movie", "show", "season", "episode", "artist", "album", "track"
	*/
	let mediaTypeIndex = _getMediaIndex(targetMediaType);

	// Build the query endpoint.
	let endpoint = `/search?query=${targetMediaName}`;

	// Filter the endpoint by type, if a type was passed
	if(targetMediaType) {
		endpoint += `&type=${mediaTypeIndex}`;		
	}

	return plexClient.query(endpoint).then((result) => {
		let matches = result.MediaContainer.Metadata; // return everything that matched

		if(!matches || matches.length == 0) { // if an error occurred or 0 items were returned
			debug(`No matching media found for ${targetMediaName} (${targetMediaType}), returning...`);
			return null;
		} else {
			// TODO: Consider functionality that does a .filter on the array where the artist matches the targetMediaArtist when the type is an artist, album, or track.

			debug(`Media found for ${targetMediaName}, returning...`);
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