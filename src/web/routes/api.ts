import { Router } from "express";
import { DataStore } from "../../dataStore";
const router = Router();

router.get("/netWealth", async (_req, res, next) => {
    const dataStore = new DataStore();
    try {
        await dataStore.open();

        res.json({
            netWealth: await dataStore.getNetWealth()
        });
    } catch (err) {
        next(err);
    } finally {
        await dataStore.close();
    }
});

export default router;
