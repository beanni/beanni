import { Router } from "express";
import _ from "lodash";
import { DataStore } from "../../dataStore";
const router = Router();

router.get("/netWealth", async (_req, res, next) => {
  const dataStore = new DataStore();
  try {
    await dataStore.open();

    res.json({
      netWealth: await dataStore.getNetWealth(),
    });
  } catch (err) {
    next(err);
  } finally {
    await dataStore.close();
  }
});

router.get("/dataIssues", async (_req, res, next) => {
  const dataStore = new DataStore();
  try {
    await dataStore.open();

    const allBalances = await dataStore.getAllBalances();
    const dataIssuesCount = _(allBalances)
      .groupBy((r) => `${r.institution} ${r.accountNumber} ${r.accountName}`)
      .map((_value) => {
        const latestBalance = _(_value).maxBy((d) => d.date);
        const asAt = latestBalance?.date;
        const asAtDaysAgo =
          asAt === undefined
            ? "∞"
            : Math.floor(
                ((new Date(asAt).getTime() - new Date().getTime()) /
                  (1000 * 3600 * 24)) *
                  -1
              );
        return {
          balance: latestBalance?.balance,
          asAtDaysAgo: asAtDaysAgo,
        };
      })
      .filter(
        (b) => b.balance != undefined && b.balance != 0 && b.asAtDaysAgo > 1
      )
      .value().length;

    res.json({
      count: dataIssuesCount,
    });
  } catch (err) {
    next(err);
  } finally {
    await dataStore.close();
  }
});

export default router;
