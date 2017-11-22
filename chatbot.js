var express = require('express')
var bodyParser = require('body-parser')
var multer = require('multer')
var upload = multer() // for parsing multipart/form-data
var pos = require('pos')
var DarkSky = require('forecast.io')
var weather = new DarkSky({ APIKey: '8b4d5ca925446f9db4f7d7d0aac8b40c'})
var maps = require('@google/maps').createClient({key: 'AIzaSyD7W7v5psM8TDJwUV2WxsPkoYRtByh07Y0'})

var app = express()
app.use(bodyParser.json()) // for parsing application/json
app.use(bodyParser.urlencoded({ extended: true })) // for parsing application/x-www-form-urlencoded
app.set('port', 9000)

var ACTIONS = {
    'WEATHER': 'weather',
    'HUMIDITY': 'humidity'
}

var ERROR_REASONS = {
    'LOC_NONE': 1,
    'LOC_UNKNOWN': 2,
    'ACTION_NONE': 3,
    'WEATHER_UNKNOWN': 4,
    'UNKNOWN': 5
}

// this is to store some state information about various sessions
// it's based on the user_id that's sent with every message from the frontend
// not ideal in a production situation, but fine for a demo

/* {
    uid: {
        name: String,
        showedTutorial: BOOL,
        specifiedAction: ACTIONS
    }

} */


var sessionStorage = {}

app.post('/chat/messages', upload.array(), function(req, res) {
    switch (req.body.action) {
        case 'join':
            respondJoin(res, req.body.user_id, req.body.name)
            break

        case 'message':
        default:
            respondMessage(res, req.body.user_id, req.body.text)
            break
    }
})

app.get('/', function(req, res) {
    res.json({
        status: 'alive!'
    })
})

app.listen(app.get('port'), function () {
    console.log('Example app listening on port ' + app.get('port') + '!')
})

function respondJoin(res, uid, name) {
    var welcomeMessage = {
        type: 'text',
        text: 'Hello ' + name + '! I\'m here to tell you about the weather.'
    }

    var followupQuestion = {
        type: 'text',
        text: 'Where would you like to know the current conditions?'
    }

    sendResponse(res, [welcomeMessage, followupQuestion])

    sessionStorage[uid] = {
        name: name,
        showedTutorial: false,
        specifiedAction: ACTIONS.WEATHER
    }
}

function respondMessage(res, uid, message) {
    var messageComponents = parseMessage(message)

    if (messageComponents.location == null) {
        sendErrorMessage(res, ERROR_REASONS.LOC_NONE)
        return
    }

    var state = sessionStorage[uid]

    if (messageComponents.action == null) {
        if (state.specifiedAction == null) {
            sendErrorMessage(res, ERROR_REASONS.ACTION_NONE)
            return
        }

        messageComponents.action = state.specifiedAction
    }

    getLatLngFromLocation(messageComponents.location, function(coords) {
        if (coords == null) {
            sendErrorMessage(res, ERROR_REASONS.LOC_UNKNOWN)
            return
        }

        getCurrentWeather(coords.lat, coords.lng, function (conditions) {
            if (conditions == null) {
                sendErrorMessage(res, ERROR_REASONS.WEATHER_UNKNOWN)
                return
            }

            if (messageComponents.action == ACTIONS.WEATHER) {
                var responseString = generateWeatherString(conditions.sky, conditions.temp, conditions.humidity)
            } else if (messageComponents.action == ACTIONS.HUMIDITY) {
                var responseString = generateHumidityString(conditions.temp, conditions.humidity)
            }

            var response = []

            response.push({
                type: 'text',
                text: responseString
            })

            if (state.showedTutorial == false) {
                response.push({
                    type: 'text',
                    text: generateTutorialString()
                })

                state.showedTutorial = true
            }

            response.push({
                    type: 'text',
                    text: 'Anywhere else you\'d like to see the current conditions?  Just ask!'
                })

            sendResponse(res, response)

            state.specifiedAction = null
        })
    })
}

function sendErrorMessage(res, reason) {
    switch (reason) {
        case ERROR_REASONS.LOC_NONE:
            var sorryString = 'Sorry, but I can\'t help you without a location.'
            break
        case ERROR_REASONS.LOC_UNKNOWN:
            var sorryString = 'I\'m sorry, I don\'t know where that is.'
            break
        case ERROR_REASONS.ACTION_NONE:
            var sorryString = 'Well, you\'re going to have to tell me what you want to know.'
            break
        case ERROR_REASONS.WEATHER_UNKNOWN:
            var sorryString = 'Hmm... I guess I don\'t know what\'s going on there.'
            break
        case ERROR_REASONS.UNKNOWN:
        default:
            var sorryString = 'I\'m sorry, I don\'t quite understand what you mean by that.'
            break
    }

    var errorResponse = []

    errorResponse.push({
        type: 'text',
        text: sorryString
    })

    if (reason == ERROR_REASONS.ACTION_NONE) {
        errorResponse.push({
            type: 'text',
            text: generateTutorialString()
        })
    }

    errorResponse.push({
        type: 'text',
        text: 'Please ask me about the weather in a location of your choice'
    })

    sendResponse(res, errorResponse)
}

function sendResponse(res, messages) {
    res.setHeader('Access-Control-Allow-Origin', 'http://hipmunk.github.io')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
    res.setHeader('Access-Control-Allow-Methods', 'POST')

    res.json({
        messages: messages
    })
}


// MESSAGE PARSING FUNCTIONS

function parseMessage(message) {
    // tag each word with part of speach (noun, adjective, etc.)
    var words = new pos.Lexer().lex(message)
    var tagger = new pos.Tagger()
    var taggedWords = tagger.tag(words)

    // what we want to extract from the message
    var action = null
    var location = null

    // iterate over each word to see if we can gain meaning from it
    var otherWords = []
    for (var i = 0; i < taggedWords.length; i++) {
        var word = taggedWords[i][0]
        var part = taggedWords[i][1]

        switch (part) {
            case 'NN':
            case 'NNP':
                // check to see if the noun is one of the potential actions
                if (ACTIONS[word.toUpperCase()]) {
                    action = ACTIONS[word.toUpperCase()]
                } else {
                    otherWords.push(word)
                }
                break

            case 'CD':
                if (word.length == 5) {
                    // it's a zipcode so save that as the location
                    location = word
                }

                otherWords.push(word)
                break
        }
    }

    if (location == null) {
        // if the location is not already set to a zipcode, combine the remaining words into a location
        // note: it would be better to check if all the words happened sequentially in the sentence and
        //       then determine what would most likely be a location
        var locationProcess = otherWords.join(' ')
        locationProcess = locationProcess.trim()

        if (locationProcess.length > 0) {
            location = locationProcess
        }
    } 

    return {
        action: action,
        location: location
    }
}

function getLatLngFromLocation(location, completion) {
    maps.geocode({
        address: location
    }, function(err, response) {
        if (err || response.json.results.length == 0) {
            console.log(err)
            completion(null)
            return
        }

        var locationCoordinates = response.json.results[0].geometry.location
        completion(locationCoordinates)
    })
}

function getCurrentWeather(lat, lng, completion) {
    weather.get(lat, lng, function (err, res, data) {
        if (err || data == null) {
            completion(null)
            return
        }

        completion({
            sky: data.currently.icon,
            temp: Math.round(data.currently.temperature),
            humidity: data.currently.humidity
        })
    })
}


// GENERATE RESPONSE STRING FUNCTIONS

function generateWeatherString(skyCondition, temp, humidity) {
    switch (skyCondition) {
        case 'clear-day':
        case 'clear-night':
            if (temp > 55) {
                var weatherString = 'It\'s beautiful out with a current temperature of ' + temp + '°F'
            } else {
                var weatherString = 'It\'s beautiful, but a little cold. ' + temp + '°F'
            }
            break

        case 'cloudy':
        case 'partly-cloudy-day':
        case 'partly-cloudy-night':
            if (temp <= 32) {
                var weatherString = 'Cloudy, but hey- it could be snowing... ' + temp + '°F'
            } else {
                var weatherString = 'Cloud be worse. ' + temp + '°F'
            }
            break;

        case 'rain':
        case 'snow':
            var weatherString = 'Ugh.  It\'s ' + skyCondition + 'ing and ' + temp + '°F'
            break

        case 'sleet':
        case 'wind':
        default:
            var weatherString = 'It\'s currently ' + temp + '°F.'
    }

    return weatherString
}

function generateHumidityString(temp, humidity) {
    var humidityWholeNumber = Math.round(humidity * 100)

    if (humidityWholeNumber > 75 && temperature > 80) {
        var humidityString = 'Damn, is it muggy or what? ' + humidityWholeNumber + '% humidity.'
    } else if (humidityWholeNumber < 10 && temperature > 70) {
        var humidityString = 'So this is what it\'s like in a desert. ' + humidityWholeNumber + '% humidity.'
    } else {
        var humidityString = 'The current humidity level is ' + humidityWholeNumber + '%.'
    }

    return humidityString
}

function generateTutorialString() {
    return 'Right now I can tell you about the [weather] or [humidity], if you ask nicely.'
}

