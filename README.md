# Plex Voice Controller JS

A JavaScript first library for controlling Plex via voice commands.

## Description

This is a JavaScript library written to wrap the (undocumented) Plex API in order to control it through simple commands. 

The library was written with the intent of being "voice-first". This means commands are intentionally simplified and make assumptions for the user to simply the user experience.

## Usage

`npm install plex-voice-controller-js`

```
let plexVoiceController = require('plex-voicecontroller-js');

plexVoiceController.setup().then((plexClient) => {
	let parameters = {
		targetClientName: "Living Room TV", // optional
		targetMediaName: "Tom and Jerry",
		targetMediaType: "show", // optional
		action: "play"
	}

	plexVoiceController.voiceCommand(plexClient, parameters).then((response) => {
		if(response && response.error) {
			console.log('something went wrong', response.error );
		} else {
			console.log('success!', response);
		}
	})
	.catch((error) => {
		console.log(error);
	})
})


```

## Configuration
Presently, this application requires a bit of configuration before it can be used. By default, [dotenv](https://www.npmjs.com/package/dotenv) is recommended for configuration. 

An .env.sample is provided as part of this .env package, but it is important that this file is setup and configured in _your_ project's main directory (along with dotenv in your entry file (e.g. index.js)) and is NOT configured in this NPM package (as it will not be recognized).

To make use of this .env file, in your proejct's working directory, do the command:
`cp .env. node_modules/plex-voice-controller-js/.env.sample`

If you already have your own .env file, navigate to the above path (or view it [here](https://github.com/mstan/plex-voice-controller-js/blob/master/.env.sample) on Github) and ensure that all the provided environment variables are copied to your project's .env file.

```
## Your Server's IP
# This is the IP of your local Plex server. If you're running this script on the same machine, it will be 127.0.0.1. 
# Otherwise, it will likely be a machine in your home network (10.x.x.x or 192.168.x.x)
PLEX_HOSTNAME=

## Your server's Port
# By default this typically 32400
PLEX_PORT=32400 

# Your Plex Username
PLEX_USERNAME=

# Your Plex Password
PLEX_PASSWORD=

## Unique identifier
# Some unique identifier for this client. This is entirely arbitrary, but recommended you fill it out.
# Otherwise, Plex will generate a new one each time and this adds a lot of clutter
PLEX_IDENTIFIER="Plex Voice Controller JS" 

## Default Media Player (OPTIONAL)
# Default media player you'd want to cast media to. 
# If you don't know how to get this ID, include this library in your project, call setup() and then voiceCommand(), passing no device ID
# If debugging is enabled, you should get debug logs out giving available client by name + machine ID
PLEX_DEFAULT_TARGET_CLIENT_MACHINE_ID=

## Default Plex Server (OPTIONAL)
# Default server that media is to be played from.
# You can get this by including this library and calling setup(). 
# If debugging is enabled, you should get a list of available servers by name + machine ID
PLEX_DEFAULT_SERVER_MACHINE_ID=

# Get this by: https://forums.plex.tv/t/how-to-request-a-x-plex-token-token-for-your-app/84551
PLEX_ACCESS_TOKEN=

## Debugging
# Debug logs. If you leave the below 'plex-controller:*' in, your console should output debug logs
DEBUG=plex-controller:* 
```

## Documentation

### setup()

#### arguments: (none)

No arguments are explicitly passed. Pulls all arguments from environment variables (.env file)

Returns a plexClient object. This object is meant to be passed as the first argument of voiceCommand for contextualizing request

### voiceCommand(plexClient,parameters)

#### arguments: plexCLient (obj) and parameters (obj)

##### _plexClient_ should be gotten from the output of setup()

##### _parameters_ is object with a series of parameters to define the media and intent

**Example**
```
let parameters = {
	targetClientName: "LG 75SK8070AUB",
	targetMediaName: "tom and jerry",
	targetMediaType: "show",
	action: "shuffle"
}
```

_targetClientName_ (optional, string):

(friendly) name of your Plex Client. This is based on the name Plex knows this client as.

Passing targetClientName is not mandatory.

If targetClientName is passed and the player cannot be failed, voiceCommand will error out, saying the specified target cannot be found.

If targetClientName is not passed, Plex Voice Controller will try to instead target the default targeted client (environment variable PLEX_DEFAULT_TARGET_CLIENT_MACHINE_ID) instead.  

If PLEX_DEFAULT_TARGET_CLIENT_MACHINE_ID is not set or cannot be found in the list of clients, and exactly one client was returned as available, voiceCommand will execute on this target client.

If PLEX_DEFAULT_TARGET_CLIENT_MACHINE_ID is not set or cannot be found in the list of clients, and multiple (or zero) clients were returned as available, voiceCommand will fail.

_targetMediaName_ (optional\*, string)

targetMedaiName is mandatory _only when_ "action" is either "play" or "shuffle". Otherwise, targetMediaName is ignored entirely.

targetMediaName is a string that is passed when querying for media on Plex Server.

_targetMediaType_ (optional, string)

This string is always optional, but recommend if similar media under different categories exist.

Possible arguments this can be: 

* 'movie' (represents a single movie) 
* 'show' (represnets a TV show entity as a whole)
* 'season' (represents a single season of a TV show)
* 'episode' (represents a single episode of a TV show)
* 'artist' (represents creator of an album)
* 'album' (represents an album)
* 'track' (represents a single song)

_action_ (mandatory, string)

Mandatory. Determines the intent of the action (are we playing a movie? Pausing? Stopping? Skipping to the next in queue?)  

Possible arguments this can be:

* 'play' (must be passed with targetMediaName. Queries targetMediaName and begins playing first result)
* 'shuffle' (must be passed with targetMediaName. Queries targetMediaName and begins playing first result. If the result is a TV show or season, it will play it out of order )
* 'resume' (resumes any paused media on client)
* 'pause' (pause media on client)
* 'stop' (stops playing media on client)
* 'stepBack' (Go back 30 seconds on the currently playing media)
* 'stepForward' (Go forward 30 seconds on the currently paying media)
* 'skipNext' (Skip to the next item in the queue)
* 'skipPrevious' (Skip to the previous item in the queue)
