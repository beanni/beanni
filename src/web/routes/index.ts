import { DataStore } from '../../dataStore';
import { Router } from 'express';
import _ from 'lodash';
var router = Router();

/* GET home page. */
router.get('/', async function(req, res, next) {
    var dataStore = new DataStore();
    try
    {
        await dataStore.open();

        var balanceData = await dataStore.getAllBalances();

        var balanceHistoryChartData = {
            labels: _(balanceData).map(r => `${r.institution} ${r.accountNumber} ${r.accountName}`).value(),
            datasets: [{
                label: 'Current Balance ($)',
                data: _(balanceData).map(r => r.balance).value(),
                backgroundColor: [
                    'rgba(255, 99, 132, 0.2)',
                    'rgba(54, 162, 235, 0.2)',
                    'rgba(255, 206, 86, 0.2)',
                    'rgba(75, 192, 192, 0.2)',
                    'rgba(153, 102, 255, 0.2)',
                    'rgba(255, 159, 64, 0.2)'
                ],
                borderWidth: 1
            }]
        };

        res.render('index', {
            netWorth: await dataStore.getNetWorth(),
            balanceHistoryChartData: balanceHistoryChartData
        });
    }
    finally
    {
        await dataStore.close();
    }
});

export default router;
