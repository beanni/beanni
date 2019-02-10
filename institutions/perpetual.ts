import puppeteer = require('puppeteer');

(async () => {
    const browser = await puppeteer.launch();
    const page = await browser.newPage();
    await page.goto("https://www.perpetual.com.au/loginsecure");
    const title = await page.title();
    console.log("Loaded page '%s'", title);

    await browser.close();
})();

