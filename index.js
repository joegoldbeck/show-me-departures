var _ = require('underscore');
var express = require('express');
var exphbs  = require('express-handlebars');
var request = require('request');
var moment = require('moment-timezone');


var app = express();

app.engine('handlebars', exphbs({defaultLayout: 'main'}));
app.set('view engine', 'handlebars');

app.get('/', function(req, res){

	request.get('http://developer.mbta.com/lib/gtrtfs/Departures.csv', function(err, response, body){

		res.setHeader("content-type", "text/html");
		if(err || response.statusCode !== 200){
			console.error('Error: Departures csv is unavailable');
			return res.status(500).send("<body><p>Sorry, we had trouble getting that information. Please try again shortly.</p></body>")
		}

		// Note: can factor this out into a function for unit testing

		var expectedColumns = ['ScheduledTime','Origin','Destination','Trip','Track','Status','Lateness'];

		// convert csv to json-like object
		var responseArray = _.map(body.split('\r\n'), function(rowString){ return rowString.split(',')});
		var headerRow = responseArray[0];

		// check that all required info is here
		if (!_.isEmpty(_.difference(expectedColumns, headerRow))){
			console.error('Error: Departures csv is missing required columns');
			return res.status(500).send("<body><p>Sorry, we had trouble getting that information. Please try again shortly.</p></body>")
		}

		var dataRows = _.rest(responseArray);

		var trainObjects = _.chain(dataRows)
			.reject(function(row){
				return row.length <= 1 // remove blank rows
			})
			.map(function(row){ // convert each row into an object with named properties
				return _.object(headerRow, row)
			})
			.map(function(trainDetails){
				return {
					time: moment(trainDetails.ScheduledTime * 1000).tz("America/New_York").format('h:mm a'),
					origin: trainDetails.Origin,
					destination: trainDetails.Destination,
					train: trainDetails.Trip,
					track: trainDetails.Track || 'TBD',
					status: trainDetails.Status === 'Delayed' ?
						'Delayed By ' + Math.round(trainDetails.Lateness / 60) + ' minutes' : trainDetails.Status
				}
			})
			.value()

		res.render('departures', {trainObjects: trainObjects});
	})
});

app.listen(process.env.PORT || 3000);
