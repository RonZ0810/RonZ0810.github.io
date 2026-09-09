import { expect, test } from '@playwright/test';
import { writeFile } from 'node:fs/promises';

for (const [name,width,height] of [['desktop',1440,900],['phone',390,844]]) {
  test(`record ${name} frame timing and transferred assets`, async ({page},testInfo)=> {
    await page.setViewportSize({width,height}); await page.goto('/');
    await expect(page.locator('[data-study-scene]')).toHaveAttribute('data-assets','ready',{timeout:45000});
    await page.locator('[data-office-motion]').click();
    await page.locator('[data-room-list]').click();await page.locator('#room-objects [data-object-action=fan]').click();
    await expect(page.locator('[data-study-scene]')).toHaveAttribute('data-fan','off');
    await page.locator('[data-room-list]').click(); await page.locator('#room-objects a[href="/projects/"]').click();
    await page.locator('[data-panel-close]').click();
    for(let i=0;i<12;i++) await page.locator('[data-study-scene]').press('ArrowUp');
    await page.locator('[data-office-motion]').click();
    const sample=()=>page.evaluate(()=>new Promise(resolve=> {
      const times=[];let last;const tick=t=> {if(last!==undefined)times.push(t-last);last=t;if(times.length<24)requestAnimationFrame(tick);else {times.sort((a,b)=>a-b);resolve({meanMs:times.reduce((a,b)=>a+b,0)/times.length,p95Ms:times[Math.floor(times.length*.95)]});}};requestAnimationFrame(tick);
    }));
    const stopped=await sample();
    await page.locator('[data-office-motion]').click();
    await page.locator('[data-room-list]').click();await page.locator('#room-objects [data-object-action=fan]').click();
    await expect(page.locator('[data-study-scene]')).toHaveAttribute('data-fan','on');
    await page.locator('[data-room-list]').click();await page.locator('#room-objects a[href="/projects/"]').click();
    await page.locator('[data-panel-close]').click();
    for(let i=0;i<12;i++) await page.locator('[data-study-scene]').press('ArrowUp');
    await page.locator('[data-office-motion]').click();
    const running=await sample();
    const resources=await page.evaluate(()=>performance.getEntriesByType('resource').map(r=>({path:new URL(r.name).pathname,bytes:r.transferSize,encodedBytes:r.encodedBodySize})));
    const report={viewport:{width,height},renderer:await page.locator('[data-study-scene]').getAttribute('data-renderer'),stopped,running,lastRenderSubmissionMs:Number(await page.locator('[data-study-scene]').getAttribute('data-render-ms')),lastRenderIntervalMs:Number(await page.locator('[data-study-scene]').getAttribute('data-render-interval-ms')),drawCalls:Number(await page.locator('[data-study-scene]').getAttribute('data-draw-calls')),totalTransferredBytes:resources.reduce((a,r)=>a+r.bytes,0),resources};
    await writeFile(testInfo.outputPath('performance.json'),JSON.stringify(report,null,2));
    console.log(`${name} performance: ${JSON.stringify({...report,resources:undefined})}`);
  });
}
