"""Many complete lives through public UI controls; no clock or save-state injection."""
import asyncio, json, os, subprocess, time
from pathlib import Path
from playwright.async_api import async_playwright

BASE=os.environ.get('BIRTH_TEST_URL','http://127.0.0.1:4173')
OUT=Path(os.environ.get('BIRTH_TEST_OUTPUT','test-results/bulk')).resolve()
OUT.mkdir(parents=True,exist_ok=True)
fixtures=json.loads(subprocess.check_output(['node','tests/browser-fixtures.mjs'],text=True,encoding='utf-8'))[:12]
results=[]

async def state(page):
    return await page.evaluate("JSON.parse(localStorage.getItem('birth.v1')).current")

async def action(page,key):
    target=page.locator(f'[data-action="{key}"]:visible')
    if not await target.count():
        if not await page.locator('.game-menu').is_visible():
            await page.locator('[data-action=game-menu]').click()
        target=page.locator(f'[data-action="{key}"]:visible')
    await target.first.click()

async def shop(page,result):
    # A running life must retain its play state while this panel freezes the year.
    await page.locator('[data-speed="16"]').click()
    if not await page.locator('[data-deep=finance]:visible').count():
        await page.locator('[data-action=game-menu]').click()
    await page.locator('[data-deep=finance]:visible').click()
    before=await state(page); began=time.monotonic()
    await page.wait_for_timeout(3250)
    assert (await state(page))['age']==before['age']
    result['panelFrozenMs']=round((time.monotonic()-began)*1000)
    await page.screenshot(path=str(OUT/f'{result["country"]}-finance.png'))
    for item in ['dinner','train-technical','certificate','jobhunt','match','foreign']:
        if await page.locator('.shop-more').get_attribute('open') is None:
            await page.locator('.shop-more summary').click()
        button=page.locator(f'[data-consume="{item}"]')
        if await button.count() and await button.is_enabled():
            await button.click()
            assert await page.locator('#modal').is_visible()
            result['purchases'].append(item)
            cooldown=page.locator(f'[data-consume="{item}"]')
            if await page.locator('.shop-more').get_attribute('open') is None:
                await page.locator('.shop-more summary').click()
            assert await cooldown.is_disabled()
    assert await page.locator('[data-action=pause]').get_attribute('aria-pressed')=='false'
    await page.locator('[data-action=close]').click()
    await page.locator('[data-action=pause]').click()
    assert (await state(page))['age']==before['age']

async def run_life(browser,sem,index,fixture):
    async with sem:
        width=[360,390,768,1440][index%4]
        context=await browser.new_context(viewport={'width':width,'height':900},locale='zh-CN')
        page=await context.new_page();page.set_default_timeout(12000)
        errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
        result={**fixture,'width':width,'purchases':[],'decisions':[],'reloadStar':False,'runtimeErrors':errors}
        began=time.monotonic();shopped=False;starred=False
        try:
            await page.goto(BASE,wait_until='networkidle')
            await page.locator('[data-duration="30"]').click()
            await page.locator('#reflection-mode').uncheck()
            await page.goto(BASE+f'/?seed={fixture["seed"]}&world={fixture["world"]}&year={fixture["year"]}',wait_until='networkidle')
            await page.locator('#shared-birth').click()
            await page.locator('[data-action=begin-life]').click()
            await page.locator('[data-action=pause]').click()
            for turn in range(1200):
                s=await state(page)
                assert s['country']==fixture['country']
                if await page.locator('#ending-view').is_visible():break
                if await page.locator('.moment-card.is-happening').is_visible():
                    await page.wait_for_function("()=>!document.querySelector('.moment-card.is-happening')",timeout=15000)
                    continue
                if await page.locator('[data-action=moment-next]:visible').count():
                    await page.locator('[data-action=moment-next]').click();continue
                choices=page.locator('[data-choice]:visible')
                if await choices.count():
                    count=await choices.count()
                    selected=1 if s['age']==18 else (index+len(result['decisions']))%count
                    if index%4==3 and len(result['decisions'])<2:
                        await page.locator('[data-action=choice-auto]').click()
                        await page.wait_for_function("() => !document.querySelector('#modal').open",timeout=6000)
                        if await page.locator('[data-action=pause]').get_attribute('aria-pressed')=='false':
                            await page.locator('[data-action=pause]').click()
                        # Explicitly reclaim manual play after observing the reading preview.
                        if (await state(page))['auto']:await action(page,'auto')
                    else:await page.locator(f'[data-choice="{selected}"]').click()
                    result['decisions'].append({'age':s['age'],'count':count,'kind':s['pending']})
                    continue
                if s['pending']:
                    await page.locator('[data-action=decision]').click();continue
                if s['age']>=8 and not starred:
                    await page.locator('.journal-archive summary').click()
                    row=page.locator('.event').first
                    await row.locator('h3').click()
                    star=row.locator('[data-star]');event_id=await star.get_attribute('data-star')
                    await star.click();starred=True
                    await page.reload(wait_until='networkidle')
                    await page.locator('#resume-button').click()
                    await page.locator('[data-action=pause]').click()
                    await page.locator('.journal-archive summary').click()
                    restored=page.locator(f'[data-star="{event_id}"]')
                    assert await restored.get_attribute('aria-pressed')=='true'
                    assert await restored.locator('xpath=ancestor::article').get_attribute('aria-expanded')=='false'
                    result['reloadStar']=True
                if s['age']>=25 and not shopped:
                    await shop(page,result);shopped=True
                if s['age']>=8 and s['age']%12==0:
                    if await page.locator('.town-focus').get_attribute('open') is None:
                        await page.locator('.town-focus summary').click()
                    await page.locator('[data-focus=health]').click()
                    assert (await state(page))['deep'].get('autoFocus') is False
                assert await page.evaluate('document.documentElement.scrollWidth<=innerWidth')
                forward=page.locator('[data-action=next-choice]')
                if await forward.get_attribute('aria-pressed')!='true':await forward.click()
                await page.wait_for_function('''()=>document.querySelector('#modal').open ||
                    document.querySelector('.moment-card.is-happening') ||
                    document.querySelector('[data-action="moment-next"]') ||
                    !document.querySelector('#ending-view').classList.contains('hidden')''',timeout=10000)
            else:raise AssertionError('1200 UI turns did not finish the life')
            assert await page.locator('#ending-view').is_visible()
            ending_start=time.monotonic()
            await page.screenshot(path=str(OUT/f'{fixture["country"]}-ending-start.png'))
            if index==0:
                await page.wait_for_function("() => !document.querySelector('.ending-final').classList.contains('hidden')",timeout=65000)
                result['endingFinalDomMs']=round((time.monotonic()-ending_start)*1000)
                await page.wait_for_function("() => getComputedStyle(document.querySelector('.ending-final [data-action=ending-record]')).opacity > .99",timeout=10000)
                result['endingReadableMs']=round((time.monotonic()-ending_start)*1000)
                await page.screenshot(path=str(OUT/'adult-ending-settled.png'))
                await page.locator('[data-action=ending-record]').click()
            else:
                await page.locator('.ending-skip').click()
                assert await page.locator('#ending-view').is_visible()
                await page.locator('.ending-skip').click()
            assert await page.locator('body').get_attribute('data-view')=='record'
            assert await page.locator('.record-texture').count()==1
            assert await page.evaluate('document.documentElement.scrollWidth<=innerWidth')
            assert len((await page.evaluate("JSON.parse(localStorage.getItem('birth.v1')).history")))==1
            await page.screenshot(path=str(OUT/f'{fixture["country"]}-record.png'),full_page=True)
            await page.locator('[data-action=replay-ending]').click()
            await page.locator('.ending-skip').click();await page.locator('.ending-skip').click()
            assert await page.evaluate('scrollY')==0
            assert await page.evaluate("document.activeElement.dataset.action")=='home'
            assert not errors,errors
            result.update({'endedAge':(await state(page))['age'],'replayReturnsToTop':True,'seconds':round(time.monotonic()-began,2)})
            results.append(result)
            print(json.dumps({'completed':len(results),'country':fixture['country'],'age':result['endedAge'],'decisions':len(result['decisions']),'purchases':result['purchases']},ensure_ascii=False),flush=True)
        except Exception as error:
            await page.screenshot(path=str(OUT/f'FAIL-{fixture["country"]}.png'),full_page=True)
            (OUT/f'FAIL-{fixture["country"]}.json').write_text(json.dumps({'error':str(error),'result':result,'state':await state(page)},ensure_ascii=False,indent=2),encoding='utf-8')
            raise
        finally:await context.close()

async def main():
    async with async_playwright() as p:
        browser=await p.chromium.launch(headless=True,executable_path=os.environ.get('CHROMIUM_PATH'))
        try:await asyncio.gather(*(run_life(browser,async_sem,i,f) for i,f in enumerate(fixtures)))
        finally:await browser.close()

async_sem=asyncio.Semaphore(4)
asyncio.run(main())
(OUT/'results.json').write_text(json.dumps(results,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps({'completeLives':len(results),'runtimeErrors':sum(len(r['runtimeErrors']) for r in results)},ensure_ascii=False))
