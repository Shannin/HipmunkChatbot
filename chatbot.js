var express = require('express')
var bodyParser = require('body-parser')
var multer = require('multer')
var upload = multer() // for parsing multipart/form-data
var pos = require('pos')
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
    'UNKNOWN': 4
}

app.post('/chat/messages', upload.array(), function(req, res) {
    switch (req.body.action) {
        case 'join':
            respondJoin(req.body.name, res)
            break

        case 'message':
        default:
            respondMessage(req.body.text, res)
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

function respondJoin(name, res) {
    var welcomeMessage = {
        type: 'text',
        text: 'Hello ' + name + '! I\'m here to tell you about the weather.'
    }

    var followupQuestion = {
        type: 'text',
        text: 'Where would you like to know the current conditions?'
    }

    sendResponse(res, [welcomeMessage, followupQuestion])
}

function respondMessage(message, res) {
    var messageComponents = parseMessage(message)

    if (messageComponents.location == null) {
        sendErrorMessage(res, ERROR_REASONS.LOC_NONE)
        return
    }

    getLatLngFromLocation(messageComponents.location, function(coords) {
        if (coords == null) {
            sendErrorMessage(res, ERROR_REASONS.LOC_UNKNOWN)
            return
        }

        // get weather for coordinates

        var response = {
            type: 'text',
            text: 'I think I found the location!: ' + coords.lat + ', ' + coords.lng
        }

        sendResponse(res, [response])


    })
}

function sendErrorMessage(res, reason) {
    switch (reason) {
        case ERROR_REASONS.LOC_NONE:
            var sorryString = 'Sorry, but I can\'t help you without a location.'
            break
        case ERROR_REASONS.LOC_UNKNOWN:
            var sorryString = 'I\m sorry, I don\'t know where that is.'
            break
        case ERROR_REASONS.ACTION_NONE:
            var sorryString = 'Well, you\'re going to have to tell me what you want to know.'
            break
        case ERROR_REASONS.UNKNOWN:
            var sorryString = 'I\m sorry, I don\'t quite understand what you mean by that.'
            break
    }

    var sorryMessage = {
        type: 'text',
        text: sorryString
    }

    var instructionMessage = {
        type: 'text',
        text: 'Please ask me about the weather in a location of your choice'
    }

    sendResponse(res, [sorryMessage, instructionMessage])
}

function sendResponse(res, messages) {
    res.setHeader('Access-Control-Allow-Origin', 'http://hipmunk.github.io')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
    res.setHeader('Access-Control-Allow-Methods', 'POST')

    res.json({
        messages: messages
    })
}


// HELPER FUNCTIONS

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
                    action = word.toUpperCase()
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
        // note: it would be better to check if all the words happened sequentially in the sentence
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


