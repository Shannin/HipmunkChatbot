var express = require('express')
var bodyParser = require('body-parser')
var multer = require('multer')
var upload = multer() // for parsing multipart/form-data
var pos = require('pos')
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
    'LOC_UNKNOWN': 1,
    'ACTION_NONE': 2,
    'UNKNOWN': 3
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

function respondMessage(message, res) {
    var messageComponents = parseMessage(message)

    if (messageComponents.location == null) {
        sendErrorMessage(res, ERROR_REASONS.LOC_NONE)
    } else {
        // get coordinates for location
        // get weather for location
        // send response

        var responseMessage = {
            type: 'text',
            text: 'So you want the weather in ' + messageComponents.location + '?'
        }

        sendResponse(res, [responseMessage])
    }
}


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
    res.setHeader('Access-Control-Allow-Origin', 'http://hipmunk.github.io');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('Access-Control-Allow-Methods', 'POST');

    res.json({
        messages: messages
    })
}


// HELPER FUNCTIONS

function parseMessage(message) {
    var words = new pos.Lexer().lex(message);
    var tagger = new pos.Tagger();
    var taggedWords = tagger.tag(words);

    var action = null
    var location = null

    var otherWords = []
    for (var i = 0; i < taggedWords.length; i++) {
        var word = taggedWords[i][0]
        var part = taggedWords[i][1]

        switch (part) {
            case 'NN':
            case 'NNP':
                // check to see if the noun is one of the potential commands
                if (ACTIONS[word.toUpperCase()]) {
                    action = word.toUpperCase()
                } else {
                    otherWords.push(word)
                }
                break;

            case 'CD':
                if (word.length == 5) {
                    // it's a zipcode so save that as the location
                    location = word
                }

                otherWords.push(word)
                break;
        }
    }

    if (location == null) {
        // if the location is not a zipcode, determine where we're checking the weather
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


