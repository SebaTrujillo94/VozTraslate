import puppeteer from 'puppeteer';

(async () => {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  
  page.on('console', msg => {
    if (msg.type() === 'error') {
      console.log('BROWSER ERROR:', msg.text());
    }
  });

  page.on('pageerror', error => {
    console.log('PAGE FATAL ERROR:', error.message);
  });

  try {
    await page.goto('http://localhost:5173');
    await page.waitForSelector('input[type="text"]', { timeout: 3000 });
    await page.type('input[type="text"]', 'testuser');
    
    const btns = await page.$$('button');
    for (const b of btns) {
      const text = await page.evaluate(el => el.textContent, b);
      if (text.includes('Continue')) await b.click();
    }
    await new Promise(r => setTimeout(r, 500));
    for (const b of btns) {
      const text = await page.evaluate(el => el.textContent, b);
      if (text.includes('Continue')) await b.click();
    }
    
    await new Promise(r => setTimeout(r, 1000));
    
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const getStarted = btns.find(b => b.textContent.includes('Get Started'));
      if (getStarted) getStarted.click();
    });
    
    await new Promise(r => setTimeout(r, 1000));
    
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const joinBtn = btns.find(b => b.textContent.includes('Create & Join'));
      if (joinBtn) joinBtn.click();
    });

    await new Promise(r => setTimeout(r, 2000));
    
    await page.type('.chat-input-area input[type="text"]', 'hello world');
    
    await page.evaluate(() => {
      const form = document.querySelector('form');
      if (form) form.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
    });
    
    await new Promise(r => setTimeout(r, 4000));

    console.log('Test completed');
  } catch (err) {
    console.error('Puppeteer script error:', err);
  } finally {
    await browser.close();
  }
})();
