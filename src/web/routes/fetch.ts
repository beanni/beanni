import { Router } from "express";
import { DataStore } from "../../dataStore";
import { Core } from "../../core";
import { DynamicSecretStore } from "../../dynamicSecretStore";
import * as util from "util";
const router = Router();

/* POST /fetch/ */
router.post("/", async (_req, res, next) => {
  const dataStore = new DataStore();
  const secretStore = new DynamicSecretStore();
  const core = new Core(dataStore, secretStore);
  try {
    await dataStore.open();

    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.setHeader("Transfer-Encoding", "chunked");
    res.write("<!doctype html><html><body><pre>");
    res.write("Fetching\n");

    await core.fetch({ debug: false }, (message, params) => {
      res.write(util.format(message, params));
      res.write("\n");
    });

    res.write("Fetch complete\n");
    res.end();
  } catch (err) {
    next(err);
  } finally {
    await dataStore.close();
  }
});

export default router;
