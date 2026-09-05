/**
 * Read-only inspection of the actual DOM/asset geometry behind the brand
 * logo "too much empty space" report, against production.
 * Usage: npx tsx scripts/probe-brand-logo-whitespace-inspect.ts
 */
import { chromium } from 'playwright-core';

async function main() {
  const browser = await chromium.launch({ headless: true, channel: 'chrome' }).catch(() => chromium.launch({ headless: true }));
  const page = await (await browser.newContext({ viewport: { width: 1440, height: 1200 } })).newPage();

  // --- Brand Details page ---
  await page.goto('https://choosify.bd/brands/test', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(3000);
  const detailInfo = await page.evaluate(() => {
    // The circular logo frame (rounded-full white circle) sits inside the
    // hero, distinct from the rectangular cover <img> earlier in the DOM.
    const circleFrame = Array.from(document.querySelectorAll<HTMLElement>('div'))
      .find((d) => d.className.includes('rounded-full') && d.className.includes('bg-white') && d.querySelector('img'));
    const logoImg = circleFrame?.querySelector('img') as HTMLImageElement | null;
    if (!logoImg) return { error: 'logo img not found', foundCircleFrame: Boolean(circleFrame) };
    const imgRect = logoImg.getBoundingClientRect();
    let frame: HTMLElement | null = logoImg.parentElement;
    // walk up to the circular frame (rounded-full, white bg, border)
    for (let i = 0; i < 4 && frame; i++) {
      if (frame.className && String(frame.className).includes('rounded-full')) break;
      frame = frame.parentElement;
    }
    const frameRect = frame ? frame.getBoundingClientRect() : null;
    const cs = window.getComputedStyle(logoImg);
    return {
      src: logoImg.src,
      naturalWidth: logoImg.naturalWidth,
      naturalHeight: logoImg.naturalHeight,
      imgRect: { w: imgRect.width, h: imgRect.height },
      frameRect: frameRect ? { w: frameRect.width, h: frameRect.height } : null,
      computedMaxWidth: cs.maxWidth,
      computedMaxHeight: cs.maxHeight,
      computedObjectFit: cs.objectFit,
      frameClass: frame?.className,
      imgClass: logoImg.className,
    };
  });
  console.log('=== Brand Details logo ===');
  console.log(JSON.stringify(detailInfo, null, 2));

  // --- Brands listing card ---
  await page.goto('https://choosify.bd/brands', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(3500);
  const cardInfo = await page.evaluate(() => {
    const imgs = Array.from(document.querySelectorAll('img'));
    const logoImg = imgs.find((im) => im.src.includes('/media/brands/')) as HTMLImageElement | undefined;
    if (!logoImg) return null;
    const imgRect = logoImg.getBoundingClientRect();
    const container = logoImg.parentElement;
    const containerRect = container ? container.getBoundingClientRect() : null;
    const cs = window.getComputedStyle(logoImg);
    return {
      src: logoImg.src,
      naturalWidth: logoImg.naturalWidth,
      naturalHeight: logoImg.naturalHeight,
      imgRect: { w: imgRect.width, h: imgRect.height },
      containerRect: containerRect ? { w: containerRect.width, h: containerRect.height } : null,
      computedMaxWidth: cs.maxWidth,
      computedMaxHeight: cs.maxHeight,
      imgClass: logoImg.className,
      containerClass: container?.className,
    };
  });
  console.log('=== Brands listing card logo ===');
  console.log(JSON.stringify(cardInfo, null, 2));

  await browser.close();
}
main().catch((e) => { console.error(e); process.exit(1); });
