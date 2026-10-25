"""Real-clock interaction contracts observed on the reference. No clock/state injection."""
from playwright.sync_api import sync_playwright, expect
from browser_helpers import next_stop, finish_ending, click_action
from pathlib import Path
import json, os, subprocess, time

BASE=os.environ.get('BIRTH_TEST_URL','http://127.0.0.1:4173')
OUT=Path(os.environ.get('BIRTH_TEST_OUTPUT','test-results/feel')).resolve()
OUT.mkdir(parents=True,exist_ok=True)
fixtures=json.loads(subprocess.check_output(['node','tests/browser-fixtures.mjs'],text=True,encoding='utf-8'))
results=[]

def start(page,fixture):
    page.goto(BASE,wait_until='networkidle')
    page.locator('[data-duration="30"]').click()
    page.locator('#reflection-mode').uncheck()
    page.goto(BASE+f'/?seed={fixture["seed"]}&world={fixture["world"]}&year={fixture["year"]}',wait_until='networkidle')
    page.locator('#shared-birth').click()
    page.locator('[data-action=begin-life]').click()
    page.locator('[data-action=pause]').click()

with sync_playwright() as p:
    browser=p.chromium.launch(headless=True,executable_path=os.environ.get('CHROMIUM_PATH'))
    for width in [390,1440]:
        context=browser.new_context(viewport={'width':width,'height':844 if width<650 else 1000},locale='zh-CN')
        page=context.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
        page.set_default_timeout(15000)
        start(page,fixtures[0])
        assert not page.locator('.focus-box').is_visible()
        page.locator('[data-speed="16"]').click()
        expect(page.locator('[data-action=pause]')).to_have_attribute('aria-pressed','false')
        page.locator('[data-action=pause]').click()
        before=page.locator('.age-display strong').inner_text()
        page.wait_for_timeout(400)
        assert page.locator('.age-display strong').inner_text()==before
        began=time.monotonic();next_stop(page);fast_ms=round((time.monotonic()-began)*1000)
        assert page.locator('.choice-tag').inner_text().startswith('2 岁')
        assert page.locator('[data-choice]').count()==4
        assert page.locator('.choice-button small:visible').count()==0
        page.screenshot(path=str(OUT/f'choice-2-{width}.png'))
        page.locator('[data-action=choice-auto]').click()
        page.screenshot(path=str(OUT/f'auto-preview-{width}.png'))
        assert page.locator('.auto-preview').count()==1
        assert page.locator('[data-action=auto]').get_attribute('aria-pressed')=='true'
        page.locator('#modal-content h2').click()
        assert page.locator('.auto-preview').count()==0
        page.wait_for_timeout(3300)
        assert page.locator('.age-display strong').inner_text()=='2'
        assert page.locator('#modal').is_visible()
        page.locator('[data-action=auto-stop]').click()
        page.locator('[data-action=choice-auto]').click()
        page.locator('[aria-label="收起当前抉择"]').click()
        page.wait_for_timeout(4200)
        assert page.locator('.age-display strong').inner_text()=='2'
        assert not page.locator('#modal').is_visible()
        assert page.locator('[data-action=auto]').get_attribute('aria-pressed')=='true'
        page.locator('[data-action=decision]').click()
        page.locator('[data-action=choice-auto]').click()
        page.evaluate('''()=>{window.previewClosedMs=null;const start=performance.now();
            const observer=new MutationObserver(()=>{if(!document.querySelector('#modal').open){
                window.previewClosedMs=performance.now()-start;observer.disconnect();}});
            observer.observe(document.querySelector('#modal'),{attributes:true,attributeFilter:['open']});}''')
        expect(page.locator('#modal')).not_to_be_visible(timeout=5000)
        auto_ms=round(page.evaluate('previewClosedMs'))
        assert 2800<=auto_ms<=3250,auto_ms
        if not page.locator('[data-action=pause]').get_attribute('aria-pressed')=='true':
            page.locator('[data-action=pause]').click()
        page.screenshot(path=str(OUT/f'after-auto-{width}.png'))
        # Let the UI reach the next interest; turn global auto off while paused.
        if page.locator('[data-action=auto]').get_attribute('aria-pressed')=='true':
            click_action(page,'auto')
        next_stop(page)
        assert page.locator('.choice-tag').inner_text().startswith('7 岁')
        assert page.locator('[data-choice]').count()==3
        assert page.locator('.choice-button small:visible').count()==3
        page.screenshot(path=str(OUT/f'choice-7-{width}.png'))
        page.locator('[data-action=choice-auto]').click()
        began=time.monotonic()
        page.locator('[data-choice="1"]').click()
        assert not page.locator('#modal').is_visible()
        override_ms=round((time.monotonic()-began)*1000)
        assert override_ms<800,override_ms
        assert page.locator('[data-action=auto]').get_attribute('aria-pressed')=='true'
        assert page.locator('.focus-choices button').count()==5
        assert page.locator('.event').filter(has_text='慢慢长成自己的样子').count()==1
        assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
        page.screenshot(path=str(OUT/f'childhood-{width}.png'))
        assert not errors,errors
        results.append({'width':width,'firstChoiceAge':2,'firstOptions':4,'interestAge':7,'interestOptions':3,
            'fastForwardToFirstMs':fast_ms,'automaticPreviewMs':auto_ms,'blankClickCancelsCurrentOnly':True,
            'manualOverrideMs':override_ms,'manualOverrideKeepsGlobalAuto':True,
            'collapseFrozenForMs':4200,'speedResumes':True,'runtimeErrors':errors})
        context.close()
    for fixture in [x for x in fixtures if x.get('name')]:
        context=browser.new_context(viewport={'width':390,'height':844},reduced_motion='reduce')
        page=context.new_page();start(page,fixture)
        for _ in range(40):
            if page.locator('#ending-view').is_visible():break
            if page.locator('[data-choice]:visible').count():page.locator('[data-choice="0"]').click()
            else:next_stop(page)
        assert page.locator('#ending-view').is_visible()
        page.locator('.ending-skip').click()
        assert page.locator('#ending-view').is_visible()
        assert page.locator('.ending-skip').inner_text()=='再点一下就会关闭'
        page.locator('.ending-skip').click()
        expect(page.locator('body')).to_have_attribute('data-view','record')
        assert not page.locator('.record-texture').count()
        assert page.locator('.record-cause').is_visible()
        assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
        page.screenshot(path=str(OUT/f'{fixture["name"]}-record.png'),full_page=True)
        results.append({'case':fixture['name'],'seed':fixture['seed'],'age':fixture['age'],
            'doubleSkip':True,'conditionalJuvenileRecord':True})
        context.close()
    browser.close()
(OUT/'results.json').write_text(json.dumps(results,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps({'feelContracts':results},ensure_ascii=False))
