const puppeteer = require('puppeteer');
const path = require('path');

const targetDir = 'C:\\Users\\Eating\\.gemini\\antigravity-ide\\brain\\97b101e8-0552-4aff-995f-97817e3ddbbb';

async function run() {
  console.log('Launching browser...');
  const browser = await puppeteer.launch({ 
    headless: "new",
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    defaultViewport: { width: 1280, height: 800 } 
  });
  
  try {
    const page = await browser.newPage();
    
    console.log('Navigating to app...');
    await page.goto('http://localhost:5173', { waitUntil: 'domcontentloaded' });
    
    console.log('Waiting for load...');
    await new Promise(r => setTimeout(r, 2000));
    
    console.log('Logging in...');
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const loginBtn = btns.find(b => b.textContent.includes('本地測試模式'));
      if (loginBtn) loginBtn.click();
    });
    
    console.log('Wait for global sidebar...');
    await page.waitForSelector('.global-sidebar', { timeout: 10000 });
    await new Promise(r => setTimeout(r, 2000));
    
    console.log('Switching to Accounting App...');
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('.nav-tab'));
      const accBtn = btns.find(b => b.textContent.includes('記帳本'));
      if (accBtn) accBtn.click();
    });
    
    await new Promise(r => setTimeout(r, 2000));
    
    console.log('Screenshot 1: Empty state');
    await page.screenshot({ path: path.join(targetDir, 'demo_acc_1.png') });
    
    console.log('Typing expense...');
    await page.focus('input[placeholder="分類 (例如：飲食)"]');
    await page.keyboard.down('Control');
    await page.keyboard.press('KeyA');
    await page.keyboard.up('Control');
    await page.keyboard.press('Backspace');
    await page.type('input[placeholder="分類 (例如：飲食)"]', '超好吃的示範午餐', { delay: 100 });
    
    await page.focus('input[placeholder="金額"]');
    await page.keyboard.down('Control');
    await page.keyboard.press('KeyA');
    await page.keyboard.up('Control');
    await page.keyboard.press('Backspace');
    await page.type('input[placeholder="金額"]', '150', { delay: 100 });
    
    console.log('Screenshot 2: Filled form');
    await page.screenshot({ path: path.join(targetDir, 'demo_acc_2.png') });
    
    console.log('Submitting...');
    await page.click('button[type="submit"]');
    
    console.log('Waiting for list update...');
    await new Promise(r => setTimeout(r, 1500));
    
    console.log('Screenshot 3: Item added');
    await page.screenshot({ path: path.join(targetDir, 'demo_acc_3.png') });
    
  } catch (err) {
    console.error(err);
  } finally {
    console.log('Closing browser...');
    await browser.close();
    console.log('Done!');
  }
}

run().catch(console.error);
