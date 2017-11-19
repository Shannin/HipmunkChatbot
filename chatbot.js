var express = require('express')
var bodyParser = require('body-parser')
var multer = require('multer')
var upload = multer() // for parsing multipart/form-data
var app = express()

app.use(bodyParser.json()) // for parsing application/json
app.use(bodyParser.urlencoded({ extended: true })) // for parsing application/x-www-form-urlencoded
app.set('port', 9000)

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

    sendResponse([welcomeMessage, followupQuestion], res)
}

function respondMessage(message, res) {

    sendResponse([], res)
}


function sendResponse(messages, res) {
    res.setHeader('Access-Control-Allow-Origin', 'http://hipmunk.github.io');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('Access-Control-Allow-Methods', 'POST');

    res.json({
        messages: messages
    })
}