import express from 'express';
import createError from 'http-errors';
import path = require('path');
var indexRouter = require('./routes/index').default;

export class Explorer
{
    private server = express()
    port: number = 3000;

    async run(launchCallback: (url : string) => void)
    {
        var server = this.server;

        server.set('views', path.join(__dirname, '../../src/web/views'));
        server.set('view engine', 'pug');

        server.use(express.static(path.join(__dirname, '../../src/web/public')));

        server.use('/', indexRouter);

        // catch 404 and forward to error handler
        server.use(function(req, res, next) {
            next(createError(404));
        });

        // generic error handler
        server.use(function(err:any, req:any, res:any, next:any) {
            res.locals.message = err.message;
            res.locals.error = err;
            res.status(err.status || 500);
            res.render('error');
        });

        var url = `http://localhost:${this.port}`;
        server.listen(
            this.port,
            () => { launchCallback(url); }
        );
    }
}
