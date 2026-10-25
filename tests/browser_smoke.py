from playwright.sync_api import sync_playwright
from pathlib import Path
import json,os
out=Path(os.environ.get('BIRTH_TEST_OUTPUT','test-results')).resolve()
out.mkdir(parents=True,exist_ok=True)
with sync_playwright() as p:
    b=p.chromium.launch(headless=True, executable_path=os.environ.get('CHROMIUM_PATH'))
    page=b.new_page(viewport={'width':1440,'height':1000},device_scale_factor=1)
    errors=[]
    page.on('pageerror', lambda e:errors.append(str(e)))
    page.goto(os.environ.get('BIRTH_TEST_URL','http://127.0.0.1:4173'),wait_until='networkidle')
    page.locator('#birth-button').wait_for(state='visible')
    assert page.locator('#birth-button').is_enabled()
    page.screenshot(path=str(out/'home-desktop.png'),full_page=True)
    page.locator('[data-action=statistics]').first.click()
    assert page.locator('#data-rows tr').count()==217
    page.locator('#country-search').fill('中国')
    assert page.locator('#data-rows tr').count()>=1
    page.locator('[data-action=close]').click()
    page.locator('#birth-button').click()
    page.screenshot(path=str(out/'birth-desktop.png'))
    page.locator('[data-action=begin-life]').click()
    page.locator('[data-action=pause]').click()
    page.locator('[data-action=next-choice]').click()
    assert page.locator('.choice-tag').inner_text().startswith('6 岁')
    page.screenshot(path=str(out/'decision-desktop.png'))
    page.locator('[data-choice="0"]').click()
    page.locator('#focus-select').select_option('health')
    page.reload(wait_until='networkidle')
    assert page.locator('#resume-button').is_visible()
    page.locator('#resume-button').click()
    assert '6' in page.locator('.age-display').inner_text()
    assert page.locator('#focus-select').input_value()=='health'
    page.locator('[data-action=pause]').click()
    page.screenshot(path=str(out/'game-desktop.png'),full_page=True)
    loops=0
    while page.locator('#memory-note').count()==0 and loops<80:
        if page.locator('#modal').is_visible():
            page.locator('[data-choice="0"]').click()
        else:
            page.locator('[data-action=next-choice]').click()
        loops+=1
    assert page.locator('#memory-note').is_visible()
    page.locator('#memory-note').fill('换一个起点，仍然认真生活。')
    page.locator('[data-action=save-note]').click()
    page.screenshot(path=str(out/'memory-desktop.png'))
    with page.expect_download() as download:
        page.locator('[data-action=download-card]').click()
    download.value.save_as(str(out/'life-card.png'))
    page.locator('[data-action=close]').click()
    page.locator('[data-action=history]').first.click()
    with page.expect_download() as download:
        page.locator('[data-action=export]').click()
    download.value.save_as(str(out/'test-export.json'))
    saved=json.loads((out/'test-export.json').read_text('utf-8'))
    assert saved['history'][0]['note']=='换一个起点，仍然认真生活。'
    page.locator('[data-action=close]').click()
    page.locator('[data-action=exit]').click()
    page.locator('[data-action=theme]').click()
    page.screenshot(path=str(out/'home-dark.png'),full_page=True)
    page.locator('[data-action=theme]').click()
    mobile=b.new_page(viewport={'width':390,'height':844},device_scale_factor=1,is_mobile=True,has_touch=True)
    mobile.on('pageerror',lambda e:errors.append(str(e)))
    mobile.goto(os.environ.get('BIRTH_TEST_URL','http://127.0.0.1:4173'),wait_until='networkidle')
    assert mobile.evaluate('document.documentElement.scrollWidth<=innerWidth')
    mobile.screenshot(path=str(out/'home-mobile.png'),full_page=True)
    mobile.locator('#birth-button').click()
    mobile.locator('[data-action=begin-life]').click()
    mobile.locator('[data-action=pause]').click()
    assert mobile.evaluate('document.documentElement.scrollWidth<=innerWidth')
    mobile.screenshot(path=str(out/'game-mobile.png'),full_page=True)
    print(json.dumps({'browserErrors':errors,'lifeEndedAt':saved['history'][0]['age'],'decisionsAndSkips':loops,'screenshots':str(out)},ensure_ascii=False))
    assert not errors
    b.close()

# Additional persistence, seed, playback and import checks.
from playwright.sync_api import sync_playwright
from pathlib import Path
import json,os
base=os.environ.get('BIRTH_TEST_URL','http://127.0.0.1:4173')
with sync_playwright() as p:
    b=p.chromium.launch(headless=True,executable_path=os.environ.get('CHROMIUM_PATH'))
    page=b.new_page()
    errors=[]
    page.on('pageerror',lambda e:errors.append(str(e)))
    page.on('console',lambda m:errors.append(m.text) if m.type=='error' else None)
    page.goto(base+'/?seed=7788&mode=population',wait_until='networkidle')
    page.locator('#shared-birth').click()
    actual=page.evaluate("JSON.parse(localStorage.getItem('birth.v1')).current")
    expected=page.evaluate("""async()=>{const m=await import('/engine.js');const d=await fetch('/data/countries.json').then(r=>r.json());return m.createLife(d.countries,{seed:7788,mode:'population'});} """)
    assert actual['country']==expected['country'] and actual['name']==expected['name']
    page.locator('[data-action=begin-life]').click()
    page.locator('[data-action=auto]').click()
    page.locator('[data-speed="16"]').click()
    for attempt in range(200):
        if int(page.locator('.age-display strong').inner_text())>=8:break
        page.wait_for_timeout(200)
    assert int(page.locator('.age-display strong').inner_text())>=8
    page.locator('[data-action=pause]').click()
    assert not page.locator('#modal').is_visible()
    page.locator('[data-action=music]').click()
    assert page.locator('[data-action=music]').get_attribute('aria-pressed')=='true'
    page.locator('[data-action=music]').click()
    assert page.locator('[data-action=music]').get_attribute('aria-pressed')=='false'
    page.locator('[data-action=exit]').click()
    page.locator('#birth-button').click()
    page.locator('[data-action=confirm-birth]').click()
    page.locator('[data-action=begin-life]').click()
    page.locator('[data-action=pause]').click()
    page.locator('[data-action=next-choice]').click()
    page.keyboard.press('Escape')
    assert page.locator('.pending-banner').is_visible()
    age=page.locator('.age-display strong').inner_text()
    page.locator('[data-action=next-year]').click()
    assert page.locator('.choice-tag').inner_text().startswith(age+' 岁')
    page.locator('[data-choice="2"]').click()
    page.locator('[data-action=history]').first.click()
    assert page.locator('.history-grid .life-card').count()==1
    page.locator('.history-grid .life-card').click()
    page.locator('[data-resume-memory]').click()
    current=page.evaluate("JSON.parse(localStorage.getItem('birth.v1')).current")
    assert current['seed']==7788
    page.locator('[data-action=exit]').click()
    page.locator('[data-action=history]').first.click()
    with page.expect_file_chooser() as fc:
        page.locator('[data-action=import]').click()
    fc.value.set_files(str(out/'test-export.json'))
    page.locator('.history-grid .life-card').nth(1).wait_for()
    assert not errors,errors
    print(json.dumps({'extraBrowserErrors':errors,'sharedSeedCountry':actual['country'],'autoProgressReached':int(age),'importedHistory':page.evaluate("JSON.parse(localStorage.getItem('birth.v1')).history.length")},ensure_ascii=False))
    b.close()
