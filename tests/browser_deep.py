"""End-to-end gameplay and memorial persistence smoke test; cleans its public fixture."""
from playwright.sync_api import sync_playwright, expect
from pathlib import Path
import os,json
BASE=os.environ.get('BIRTH_TEST_URL','http://127.0.0.1:4173')
OUT=Path(os.environ.get('BIRTH_TEST_OUTPUT','test-results')).resolve()
OUT.mkdir(parents=True,exist_ok=True)
with sync_playwright() as p:
    b=p.chromium.launch(headless=True,executable_path=os.environ.get('CHROMIUM_PATH'))
    ctx=b.new_context(viewport={'width':1440,'height':1000})
    page=ctx.new_page();errors=[]
    page.on('pageerror',lambda e:errors.append(str(e)))
    page.on('console',lambda m:errors.append(m.text) if m.type=='error' else None)
    page.goto(BASE,wait_until='networkidle')
    page.locator('#world-select').select_option('past-1990')
    assert '1990' in page.locator('#data-description').inner_text()
    page.locator('#reflection-mode').check()
    page.locator('#birth-button').click()
    assert '1990' in page.locator('.birth-info').inner_text()
    page.locator('[data-action=begin-life]').click()
    page.locator('[data-action=pause]').click()
    page.locator('[data-action=next-choice]').click()
    assert page.locator('#reflection-text').is_visible()
    page.locator('#reflection-text').fill('认真看见这个人的世界。')
    page.locator('[data-deep=save-reflection]').click()
    for _ in range(35):
        age=int(page.locator('.age-display strong').inner_text())
        if age>=28:break
        if page.locator('[data-choice]').first.is_visible():
            # Work at 18 to keep enough cash for the adult systems.
            choice='1' if age==18 else '0'
            page.locator('[data-choice="'+choice+'"]').click()
        elif page.locator('#reflection-text').is_visible():
            page.locator('[data-deep=skip-reflection]').click()
        else:page.locator('[data-action=next-choice]').click()
    if page.locator('[data-choice]').first.is_visible():page.locator('[data-choice="0"]').click()
    if page.locator('#reflection-text').is_visible():page.locator('[data-deep=skip-reflection]').click()
    page.screenshot(path=str(OUT/'deep-game-desktop.png'),full_page=True)
    page.locator('[data-deep=family]').click()
    assert page.locator('.person-card').count()>=2
    page.screenshot(path=str(OUT/'family-panel.png'))
    page.locator('[data-life-action=parents]').click()
    page.locator('[data-action=close]').click()
    page.locator('[data-deep=finance]').click()
    page.locator('#trade-amount').fill('10')
    page.locator('#trade-type').select_option('stocks')
    page.locator('[data-deep=trade]').click()
    state=page.evaluate("JSON.parse(localStorage.getItem('birth.v1')).current")
    assert state['deep']['assets']['stocks']==10
    page.screenshot(path=str(OUT/'finance-panel.png'))
    page.locator('[data-action=close]').click()
    page.locator('[data-deep=career]').click()
    assert page.locator('.balance-grid').is_visible()
    page.locator('[data-action=close]').click()
    page.locator('[data-deep=migration]').click()
    options=page.locator('#migration-target option').evaluate_all('(xs)=>xs.map(x=>x.value)')
    target='BDI' if 'BDI' in options else 'MWI'
    page.locator('#migration-target').select_option(target)
    page.screenshot(path=str(OUT/'migration-panel.png'))
    page.locator('[data-deep=move]').click()
    state=page.evaluate("JSON.parse(localStorage.getItem('birth.v1')).current")
    assert state['deep']['residence']==target
    page.locator('[data-action=close]').click()
    page.reload(wait_until='networkidle')
    page.locator('#resume-button').click()
    assert page.evaluate("JSON.parse(localStorage.getItem('birth.v1')).current.deep.assets.stocks")==10
    page.locator('[data-action=pause]').click()
    for _ in range(100):
        if page.locator('#memory-note').count():break
        if page.locator('[data-choice]').first.is_visible():page.locator('[data-choice="1"]').click()
        elif page.locator('#reflection-text').is_visible():page.locator('[data-deep=skip-reflection]').click()
        else:page.locator('[data-action=next-choice]').click()
    assert page.locator('#memory-note').is_visible()
    page.locator('#memory-note').fill('自动验收临时人生，完成后撤回。')
    page.locator('[data-deep=publish-preview]').click()
    assert page.locator('.public-preview').is_visible()
    page.locator('[data-deep=publish]').click()
    page.locator('[data-deep=candle]').wait_for()
    tokens=page.evaluate("JSON.parse(localStorage.getItem('birth.memorialOwners'))")
    public_id=list(tokens)[-1]
    try:
        page.screenshot(path=str(OUT/'public-memorial.png'))
        visitor=b.new_context(viewport={'width':390,'height':844},is_mobile=True,has_touch=True)
        other=visitor.new_page();other.on('pageerror',lambda e:errors.append(str(e)))
        other.goto(BASE+'/?memorial='+public_id,wait_until='networkidle')
        other.locator('[data-deep=candle]').click()
        other.locator('[data-deep=candle]').wait_for()
        expect(other.locator('[data-deep=candle]')).to_contain_text('1')
        other.locator('[data-deep=candle]').click()
        other.locator('[data-deep=candle]').wait_for()
        expect(other.locator('[data-deep=candle]')).to_contain_text('1')
        other.locator('#public-message').fill('愿每一种人生都被温柔看见。')
        other.locator('[data-deep=public-comment]').click()
        other.get_by_text('愿每一种人生都被温柔看见。',exact=True).wait_for()
        assert other.evaluate('document.documentElement.scrollWidth<=innerWidth')
        other.screenshot(path=str(OUT/'public-memorial-mobile.png'),full_page=True)
        page.locator('[data-deep=confirm-delete-memorial]').click()
        page.locator('[data-deep=delete-memorial]').click()
        page.get_by_role('heading',name='每一种人生，都被看见。').wait_for()
        assert page.request.get(BASE+'/api/memorials/'+public_id).status==404
        page.locator('[data-action=close]').click()
        page.locator('[data-action=exit]').click()
        page.set_viewport_size({'width':390,'height':844})
        page.locator('#resume-button').count()
        assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
        print(json.dumps({'runtimeErrors':errors,'year':state['year'],'migratedTo':target,'publicFixtureRemoved':True},ensure_ascii=False))
        assert not errors,errors
    finally:
        cleanup=page.request.delete(BASE+'/api/memorials/'+public_id,headers={'Authorization':'Bearer '+tokens[public_id]})
        assert cleanup.status in (200,404), 'Could not clean test memorial'
    b.close()
