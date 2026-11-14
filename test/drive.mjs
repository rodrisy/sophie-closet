import { chromium } from 'playwright';
const D = new URL('.', import.meta.url).pathname + 'fixtures';
const errs = [];
const browser = await chromium.launch();
const ctx = await browser.newContext({viewport:{width:1440,height:900}});
const page = await ctx.newPage();
page.on('console', m => { if(m.type()==='error') errs.push('console: '+m.text()); });
page.on('pageerror', e => errs.push('pageerror: '+e.message));

await page.goto('http://localhost:8070/index.html');
await page.screenshot({path:D+'/shots/01-gate.png'});

// wrong passcode shakes, right one enters
await page.fill('#code','nope'); await page.press('#code','Enter');
await page.waitForTimeout(300);
if(await page.locator('#app.on').count()) errs.push('wrong passcode let us in!');
await page.fill('#code','waterlady'); await page.press('#code','Enter');
await page.waitForSelector('#app.on');
await page.waitForTimeout(400);
await page.screenshot({path:D+'/shots/02-empty.png'});

// import the coat -> compact review
await page.setInputFiles('#file', D+'/garments/coat.png');
await page.waitForSelector('#modal.on', {timeout:8000});
await page.waitForTimeout(700);
await page.screenshot({path:D+'/shots/03-review.png'});

// expand to editor
await page.click('#askNo');
await page.waitForTimeout(400);
await page.screenshot({path:D+'/shots/04-editor.png'});

// poke a slider then done
await page.fill('#rScale','120');
await page.dispatchEvent('#rScale','input');
await page.waitForTimeout(300);
await page.click('#finDone');
await page.waitForTimeout(400);

// jeans -> accept straight away (Enter = looks good)
await page.setInputFiles('#file', D+'/garments/jeans.png');
await page.waitForSelector('#modal.on', {timeout:8000});
await page.waitForTimeout(600);
await page.keyboard.press('Enter');
await page.waitForTimeout(400);
await page.screenshot({path:D+'/shots/05-dressed.png'});

// save a look
await page.click('#saveLook');
await page.fill('#lookName','fit check');
await page.press('#lookName','Enter');
await page.waitForTimeout(800);
if(!await page.locator('#looks .look').count()) errs.push('look did not save');

// pose change keeps clothes on
await page.click('#poses .btn:nth-child(3)');
await page.waitForTimeout(600);
await page.screenshot({path:D+'/shots/06-walk.png'});

// shuffle
await page.click('#shuffle');
await page.waitForTimeout(600);

// export -> a real download
const dl = page.waitForEvent('download',{timeout:8000});
await page.click('#export');
const d1 = await dl;
if(!(await d1.path())) errs.push('export produced no file');

// backup -> download, then restore it back in (merge should add nothing)
const dl2 = page.waitForEvent('download',{timeout:8000});
await page.click('#backup');
const d2 = await dl2;
const bak = D+'/backup.json';
await d2.saveAs(bak);
await page.setInputFiles('#restoreFile', bak);
await page.waitForTimeout(800);
const n = await page.locator('#closet .thumb').count();
if(n!==2) errs.push('restore-merge duplicated items: closet has '+n);

// apply the saved look
await page.click('#looks .look');
await page.waitForTimeout(800);
await page.screenshot({path:D+'/shots/07-look-applied.png'});

// pencil opens editor; Escape closes it
await page.hover('#closet .thumb');
await page.click('#closet .thumb .edit');
await page.waitForSelector('#modal.wide');
await page.keyboard.press('Escape');
await page.waitForTimeout(300);
if(await page.locator('#modal.on').count()) errs.push('Escape did not close the sheet');

// reload: everything persisted?
await page.reload(); await page.waitForSelector('#app.on');
await page.waitForTimeout(600);
const persist = await page.evaluate(()=>({items:document.querySelectorAll('#closet .thumb').length, looks:document.querySelectorAll('#looks .look').length}));
if(persist.items!==2||persist.looks!==1) errs.push('persistence broken: '+JSON.stringify(persist));
await page.screenshot({path:D+'/shots/08-reloaded.png'});
await ctx.close();

// ---- phone pass ----
const ph = await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,deviceScaleFactor:1});
const pp = await ph.newPage();
pp.on('pageerror', e => errs.push('phone pageerror: '+e.message));
await pp.goto('http://localhost:8070/index.html');
await pp.fill('#code','waterlady'); await pp.press('#code','Enter');
await pp.waitForSelector('#app.on'); await pp.waitForTimeout(500);
await pp.screenshot({path:D+'/shots/09-phone.png'});
await pp.setInputFiles('#file', D+'/garments/coat.png');
await pp.waitForSelector('#modal.on',{timeout:8000}); await pp.waitForTimeout(600);
await pp.screenshot({path:D+'/shots/10-phone-review.png'});
await pp.click('#askNo'); await pp.waitForTimeout(500);
await pp.screenshot({path:D+'/shots/11-phone-editor.png'});
await ph.close();
await browser.close();

console.log(errs.length ? 'ISSUES:\n'+errs.join('\n') : 'ALL CLEAN');
