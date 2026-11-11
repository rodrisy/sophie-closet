import fs from 'fs';
const src = fs.readFileSync(new URL('../index.html', import.meta.url).pathname,'utf8').match(/<script>([\s\S]*)<\/script>/)[1];
const body = src.match(/function findImages\(html, base\)\{([\s\S]*?)\n\}/)[1];
const findImages = new Function('html','base',body);

const html = `
<html><head>
<meta property="og:image" content="https://static.shop.com/photos/9912/model-front.jpg?w=1200">
<meta name="twitter:image" content="//static.shop.com/photos/9912/model-front.jpg?w=600">
<link rel="icon" href="/favicon.svg">
<script type="application/ld+json">
{"@type":"Product","name":"Wool Coat",
 "image":["https://static.shop.com/photos/9912/flat-lay.jpg",
          "https://static.shop.com/photos/9912/detail-collar.jpg",
          "https://static.shop.com/photos/9912/model-back.jpg"]}
</script>
</head><body>
<img src="/assets/sprite-nav.png" alt="menu">
<img src="/assets/brand-logo.svg">
<img data-src="/photos/9912/still-life.jpg" class="lazy">
<img srcset="/photos/9912/alt-1_small.jpg 320w, /photos/9912/alt-1_large.jpg 1400w" src="/photos/9912/alt-1_small.jpg">
<img src="https://static.shop.com/photos/9912/flat-lay.jpg">
<img src="https://tracker.ads.net/pixel.gif?id=3">
<img src="data:image/gif;base64,R0lGODlh">
</body></html>`;

const out = findImages(html, 'https://shop.com/us/wool-coat-p123.html');
console.log('found', out.length);
out.forEach((u,i)=>console.log(' ', i+1, u));

const has = s => out.some(u=>u.includes(s));
const t = (name,ok)=>console.log((ok?'PASS  ':'FAIL  ')+name);
console.log('');
t('og:image picked up',            has('model-front'));
t('JSON-LD flat-lay picked up',    has('flat-lay'));
t('JSON-LD detail shot picked up', has('detail-collar'));
t('lazy data-src picked up',       has('still-life'));
t('srcset takes the LARGE variant',has('alt-1_large') && !has('alt-1_small'));
t('relative paths resolved',       out.every(u=>u.startsWith('http')));
t('protocol-relative resolved',    out.every(u=>!u.startsWith('//')));
t('sprite filtered',               !has('sprite-nav'));
t('logo filtered',                 !has('brand-logo'));
t('svg filtered',                  !out.some(u=>/\.svg/.test(u)));
t('tracking pixel filtered',       !has('pixel.gif'));
t('data: uri ignored',             !out.some(u=>u.startsWith('data:')));
t('duplicates collapsed',          new Set(out).size === out.length);
t('capped at 12',                  out.length<=12);
