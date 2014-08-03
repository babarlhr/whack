
/* --- libraries --- */

var nunjucks     = require('nunjucks');
var Whack        = require('./whack.js').Whack;
var express      = require('express');
var path         = require('path');
var favicon      = require('static-favicon');
var logger       = require('morgan');
var cookieParser = require('cookie-parser');
var bodyParser   = require('body-parser');

/* --- routes --- */

var routes = require('./routes/index');
var api    = require('./routes/api');

/* --- whack --- */

var whack = new Whack();

/* --- express --- */

var app = express();

/* --- templating engine setup --- */

nunjucks.configure('views',{
    autoescape: true,
    express: app,
});


/* --- Express modules --- */

app.use(function(req,res,next){
    req.whack = whack;
    next();
});

app.use(favicon());
app.use(logger('dev'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded());
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

app.use('/api', api);
app.use('/', routes);

/// catch 404 and forward to error handler
app.use(function(req, res, next) {
    var err = new Error('Not Found');
    err.status = 404;
    next(err);
});

/// error handlers

// development error handler
// will print stacktrace
if (app.get('env') === 'development') {
    app.use(function(err, req, res, next) {
        res.status(err.status || 500);
        res.render('error.html', {
            message: err.message,
            error: err
        });
    });
}

// production error handler
// no stacktraces leaked to user
app.use(function(err, req, res, next) {
    res.status(err.status || 500);
    res.render('error.html', {
        message: err.message,
        error: {}
    });
});

whack.load_db(function(){
    console.log('Listening on port 3000');
    app.listen(3000);
});


module.exports = app;
