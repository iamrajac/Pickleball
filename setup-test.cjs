const fs = require('fs');
const code = "TEST12";
const data = {
  "players": ["A", "B", "C", "D"],
  "rounds": [
    [
      { "played": true, "teamA": ["A"], "teamB": ["B"], "scoreA": 11, "scoreB": 5, "duration": 120 }
    ]
  ]
};

// We will inject this directly into localStorage!
const script = `
const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();
  
  page.on('console', msg => {
    if (msg.type() === 'error') console.log('BROWSER ERROR:', msg.text());
  });
  page.on('pageerror', err => {
    console.log('PAGE EXCEPTION:', err.message);
  });

  await page.goto('http://localhost:5178/');
  await page.evaluate(() => {
    localStorage.setItem('pickleball_recent', 'TEST12');
  });

  // Now reload so it reads localStorage
  await page.reload();
  await page.waitForTimeout(2000);

  console.log("Looking for standings rows...");
  const rows = await page.$$('.standings-grid');
  console.log("Found rows:", rows.length);
  if (rows.length > 0) {
    console.log("Clicking row...");
    await rows[0].click();
    await page.waitForTimeout(1000);
    console.log("Clicked row.");
  }
  
  await browser.close();
})();
`;
fs.writeFileSync('test-puppeteer.cjs', script);
