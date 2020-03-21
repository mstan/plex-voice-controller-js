async function getServers(client) {
	return client.query('/servers/').then((result) => {
		return result.MediaContainer.Server;
	})
	.catch((error) => {
		debug(error);
		return { error};	
	})
}

module.exports = {
	getServers
}