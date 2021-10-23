import express from "express";
import createError from "http-errors";
import path = require("path");
import indexRouter = require("./routes/index");

export class Explorer {
    public port = 3000;
    private server = express();

    public async run(launchCallback: (url: string) => void) : Promise<void> {
        const server = this.server;

        server.set("views", path.join(__dirname, "../../src/web/views"));
        server.set("view engine", "pug");

        server.use(express.static(path.join(__dirname, "../../src/web/public")));

        server.use("/", indexRouter.default);

        // catch 404 and forward to error handler
        server.use((req, res, next) => {
            next(createError(404));
        });

        // // generic error handler
        // server.use((err, req, res, next) => {
        //     res.locals.message = err.message;
        //     res.locals.error = err;
        //     res.status(err.status || 500);
        //     res.render("error");
        // });

        const url = `http://localhost:${this.port}`;
        server.listen(
            this.port,
            () => { launchCallback(url); },
        );
    }
}
