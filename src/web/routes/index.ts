import { DataStore } from '../../dataStore';
import { Router } from 'express';
var router = Router();

/* GET home page. */
router.get('/', async function(req, res, next) {
    var dataStore = new DataStore();
    try
    {
        await dataStore.open();
        var netWorth = await dataStore.getNetWorth();
        res.render('index', {
            netWorth: netWorth
        });
    }
    finally
    {
        await dataStore.close();
    }
});

export default router;
