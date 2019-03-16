import express from "express";
import createError from "http-errors";
import path = require("path");
// tslint:disable-next-line:no-var-requires
const indexRouter = require("./routes/index").default;

export class Explorer {
    public port: number = 3000;
    private server = express();

    public async run(launchCallback: (url: string) => void) {
        const server = this.server;

        server.set("views", path.join(__dirname, "../../src/web/views"));
        server.set("view engine", "pug");

        server.use(express.static(path.join(__dirname, "../../src/web/public")));

        server.use("/", indexRouter);

        // catch 404 and forward to error handler
        server.use((req, res, next) => {
            next(createError(404));
        });

        // generic error handler
        server.use((err: any, req: any, res: any, next: any) => {
            res.locals.message = err.message;
            res.locals.error = err;
            res.status(err.status || 500);
            res.render("error");
        });

        const url = `http://localhost:${this.port}`;
        server.listen(
            this.port,
            () => { launchCallback(url); },
        );
    }
}
