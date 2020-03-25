// This endpoint serves to return all available casting servers for a plex client
async function getServers(plexClient) {
	return plexClient.query('/servers/').then((result) => {
		return result.MediaContainer.Server;
	})
	.catch((error) => {
		debug(error);
		return { error };	
	})
}

module.exports = {
	getServers
}