const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

const targetDir = 'C:\\Users\\Eating\\.gemini\\antigravity-ide\\brain\\30f1c644-b3b6-41f7-9d54-909053154532';

async function run() {
  console.log('Launching browser...');
  const browser = await puppeteer.launch({ 
    headless: "new",
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    defaultViewport: { width: 1280, height: 800 } 
  });
  const page = await browser.newPage();
  
  try {
    console.log('Navigating to app...');
    await page.goto('http://127.0.0.1:5174', { waitUntil: 'domcontentloaded' });
    
    console.log('Waiting for load...');
    await new Promise(r => setTimeout(r, 2000));
    
    await page.screenshot({ path: path.join(targetDir, 'demo_step1.png') });
    
    console.log('Logging in...');
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const loginBtn = btns.find(b => b.textContent.includes('本地測試模式'));
      if (loginBtn) loginBtn.click();
    });
    
    console.log('Wait for global sidebar...');
    await page.waitForSelector('.global-sidebar', { timeout: 10000 });
    await new Promise(r => setTimeout(r, 2000));
    
    console.log('Taking screenshot of Notes App...');
    await page.screenshot({ path: path.join(targetDir, 'demo_notes.png') });
    
    console.log('Switching to Accounting App...');
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('.nav-tab'));
      const accBtn = btns.find(b => b.textContent.includes('記帳本'));
      if (accBtn) accBtn.click();
    });
    
    await new Promise(r => setTimeout(r, 1000));
    
    console.log('Taking screenshot of Accounting App...');
    await page.screenshot({ path: path.join(targetDir, 'demo_accounting.png') });
  } catch (err) {
    console.error(err);
    await page.screenshot({ path: path.join(targetDir, 'demo_error.png') });
  } finally {
    console.log('Closing browser...');
    await browser.close();
    console.log('Done!');
  }
}

run().catch(console.error);
