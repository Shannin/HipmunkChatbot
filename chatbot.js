var express = require('express')
var bodyParser = require('body-parser')
var multer = require('multer') // v1.0.5
var upload = multer() // for parsing multipart/form-data
var app = express()

app.use(bodyParser.json()) // for parsing application/json
app.use(bodyParser.urlencoded({ extended: true })) // for parsing application/x-www-form-urlencoded
app.set('port', 9000)

app.post('/chat/messages', function(req, res) {
    console.log('chat message rec!')
})

app.get('/', function(req, res) {
    // return profile of selected user

    res.json({
        status: 'alive!'
    })
})

app.listen(app.get('port'), function () {
    console.log('Example app listening on port ' + app.get('port') + '!')
})
