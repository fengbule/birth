"""Exercise reference and replica through the same visible controls and real clock.

The assertions cover observed interaction contracts, not equivalence of hidden rules.
Reference traffic is read-only; no original state, clock or RNG is changed.
"""
from pathlib import Path
from playwright.sync_api import sync_playwright
import json, os, time

OUT=Path(os.environ.get('BIRTH_TEST_OUTPUT','test-results/timeline-compare')).resolve()
OUT.mkdir(parents=True,exist_ok=True)
BASE=os.environ.get('BIRTH_TEST_URL','http://127.0.0.1:4173')
results=[]

with sync_playwright() as p:
 browser=p.chromium.launch(headless=True,executable_path=os.environ.get('CHROMIUM_PATH'))
 for width in [1440,390]:
  for reference in [True,False]:
   side='reference' if reference else 'replica'
   ctx=browser.new_context(viewport={'width':width,'height':1000 if width>650 else 844},locale='zh-CN',extra_http_headers={'DNT':'1','Sec-GPC':'1'})
   if reference:
    ctx.add_init_script("Object.defineProperty(navigator,'globalPrivacyControl',{get:()=>true})")
    ctx.route('**/*',lambda r:r.continue_() if r.request.method in ['GET','HEAD','OPTIONS'] else r.abort())
   page=ctx.new_page();page.set_default_timeout(20000);errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
   page.goto('https://1in8b.life/zh-hans/' if reference else BASE,wait_until='networkidle',timeout=60000)
   if reference:
    page.get_by_role('button',name='约30分钟',exact=True).click();page.locator('#startBtn').click();page.locator('#beginBtn').wait_for(timeout=45000);page.locator('#beginBtn').click()
   else:
    page.locator('[data-duration="30"]').click();page.locator('#reflection-mode').uncheck();page.locator('#birth-button').click();page.locator('[data-action=begin-life]').click()
   pause='#pauseBtn' if reference else '[data-action=pause]'
   page.locator(pause).click()
   row='#feed>li' if reference else '.timeline>.event'
   age='#ageNum' if reference else '.age-display strong'
   feed='#feed' if reference else '.timeline'
   scene='#scene' if reference else '.scene-card>.life-scene'
   focus='#status' if reference else '.focus-box'
   initial_rows=page.locator(row).count()
   assert initial_rows>=1
   if not reference:assert initial_rows==1
   assert page.locator(focus).is_visible()
   assert not page.evaluate('document.documentElement.scrollWidth>innerWidth')
   page.screenshot(path=str(OUT/f'{side}-birth-{width}.png'))
   page.evaluate('''({feed,age})=>{window.tickTrace=[];const start=performance.now();
     const save=()=>tickTrace.push({ms:Math.round(performance.now()-start),age:document.querySelector(age).textContent,rows:document.querySelector(feed).children.length});
     new MutationObserver(save).observe(document.body,{childList:true,subtree:true});save();}''',{'feed':feed,'age':age})
   began=time.monotonic()
   page.get_by_role('button',name='16×',exact=True).click() if reference else page.locator('[data-speed="16"]').click()
   if reference:
    page.wait_for_function("()=>getComputedStyle(document.querySelector('#modal')).display!=='none'",timeout=20000)
    choices='#modal .opt'
    # Source uses ordinary buttons, identify choices by their visible number.
    options=page.locator('#modal button').filter(has_text='1').count()
    choice_buttons=page.locator('#modal button').filter(has=page.locator('.n'))
    option_count=page.locator('#modal button').count()-2
   else:
    page.wait_for_function("()=>document.querySelector('#modal').open",timeout=20000)
    option_count=page.locator('[data-choice]').count()
   assert page.locator(age).inner_text().replace('岁','').strip()=='2'
   assert option_count==4,option_count
   ticks=page.evaluate('tickTrace');groups={}
   for tick in ticks:groups.setdefault(tick['age'],set()).add(tick['rows'])
   assert any(len(counts)>=2 for counts in groups.values()),groups
   page.screenshot(path=str(OUT/f'{side}-choice-2-{width}.png'))
   (OUT/f'{side}-ticks-{width}.json').write_text(json.dumps(ticks,ensure_ascii=False,indent=2),encoding='utf-8')
   collapse='#decMin' if reference else '[aria-label="收起当前抉择"]'
   page.locator(collapse).click();before=page.locator(age).inner_text();page.wait_for_timeout(2300)
   assert page.locator(age).inner_text()==before
   assert not page.locator('#modal').is_visible()
   page.get_by_role('button',name='重新展开',exact=True).click();page.wait_for_timeout(1200)
   if reference:page.locator('#modal button').nth(1).click()
   else:page.locator('[data-choice="0"]').click()
   if reference:
    page.wait_for_timeout(500)
    if page.locator('#modal').is_visible():page.locator('#modal button').nth(1).click()
   assert not page.locator('#modal').is_visible(), (side,width,page.locator('#modal').inner_text())
   assert not page.get_by_role('button',name='继续阅读',exact=True).count()
   assert not errors,errors
   results.append({'side':side,'width':width,'initialRows':initial_rows,'firstChoiceAge':2,'options':option_count,'recordsAppearWithinYear':True,'collapsedChoiceFreezesMs':2300,'choiceContinuesTimeline':True,'firstChoiceMs':round((time.monotonic()-began-2.3)*1000),'errors':errors})
   ctx.close()
 browser.close()
(OUT/'results.json').write_text(json.dumps({'contracts':results,'scope':'Observed timing and interaction contracts; random identities differ; no hidden-rule or pixel-equivalence claim'},ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps(results,ensure_ascii=False))
