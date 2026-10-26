"""Observe real rendered motion and input boundaries, using visible controls."""
from pathlib import Path
from playwright.sync_api import sync_playwright,expect
from browser_helpers import next_stop,click_action
import json,os,subprocess,time

BASE=os.environ.get('BIRTH_TEST_URL','http://127.0.0.1:4173')
OUT=Path(os.environ.get('BIRTH_TEST_OUTPUT','test-results/motion')).resolve();OUT.mkdir(parents=True,exist_ok=True)
fixture=json.loads(subprocess.check_output(['node','tests/browser-fixtures.mjs'],text=True,encoding='utf-8'))[0]
results=[]
with sync_playwright() as p:
 browser=p.chromium.launch(headless=True,executable_path=os.environ.get('CHROMIUM_PATH'))
 for width in [1440,390]:
  for preference in ['no-preference','reduce']:
   ctx=browser.new_context(viewport={'width':width,'height':1000 if width>650 else 844},reduced_motion=preference)
   page=ctx.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
   page.goto(BASE,wait_until='networkidle')
   page.locator('[data-duration="30"]').click();page.locator('#reflection-mode').uncheck()
   page.goto(BASE+f'/?seed={fixture["seed"]}',wait_until='networkidle');page.locator('#shared-birth').click()
   page.locator('[data-action=begin-life]').click();page.locator('[data-action=pause]').click()
   page.evaluate('''()=>{
    window.birthRow=document.querySelector('.event');window.draws=[];
    new MutationObserver(()=>{
     const dialog=document.querySelector('#modal');if(!dialog.open)return;
     if(!dialog.querySelector('.choices'))return;
     const probe={started:performance.now(),frames:[]};draws.push(probe);
     function frame(){
      const choices=dialog.querySelector('.choices');if(!dialog.open||!choices)return;
      const c=getComputedStyle(dialog),o=getComputedStyle(choices);
      probe.frames.push({ms:performance.now()-probe.started,cardOpacity:+c.opacity,
       cardTransform:c.transform,choiceOpacity:+o.opacity,busy:choices.getAttribute('aria-busy')});
      if(performance.now()-probe.started<900)requestAnimationFrame(frame);
     }
     requestAnimationFrame(frame);
    }).observe(document.querySelector('#modal'),{attributes:true,attributeFilter:['open']});
   }''')
   next_stop(page)
   assert page.locator('.choice-tag').inner_text().startswith('2 岁')
   # Keyboard activation during the initial reveal must not consume a choice.
   if preference=='no-preference':
    page.locator('[data-choice="0"]').press('Enter')
    assert page.evaluate("JSON.parse(localStorage.getItem('birth.v1')).current.pending")==2
   expect(page.locator('.choices')).to_have_attribute('aria-busy','false')
   page.wait_for_timeout(180)
   probe=page.evaluate('draws[0]')
   assert probe['frames']
   if preference=='no-preference':
    assert min(f['cardOpacity'] for f in probe['frames'])<.98,probe
    assert min(f['choiceOpacity'] for f in probe['frames'])<.8,probe
    assert probe['frames'][-1]['cardOpacity']>.99 and probe['frames'][-1]['choiceOpacity']>.99
    assert any(f['cardTransform']!='none' for f in probe['frames'])
   else:
    assert all(f['cardOpacity']==1 and f['choiceOpacity']==1 and f['busy']=='false' for f in probe['frames'])
   page.screenshot(path=str(OUT/f'choice-{width}-{preference}.png'))
   page.locator('[aria-label="收起当前抉择"]').click();page.wait_for_timeout(900)
   assert page.locator('.age-display strong').inner_text()=='2'
   page.locator('[data-action=decision]').click()
   expect(page.locator('.choices')).to_have_attribute('aria-busy','false')
   page.locator('[data-choice="0"]').click()
   assert not page.locator('#modal').is_visible()
   assert page.evaluate("birthRow===document.querySelector('.event[data-eventid=\"0\"]')")
   assert len(page.evaluate("JSON.parse(localStorage.getItem('birth.v1')).current.deep.experience.chapters"))==1
   next_stop(page)
   expect(page.locator('.choices')).to_have_attribute('aria-busy','false')
   assert page.locator('.choice-tag').inner_text().startswith('7 岁')
   page.locator('[data-action=choice-auto]').click();page.wait_for_timeout(150)
   started=time.monotonic();page.locator('[data-choice="1"]').click()
   assert not page.locator('#modal').is_visible()
   override=round((time.monotonic()-started)*1000)
   assert override<500,override
   if page.locator('[data-action=auto]').get_attribute('aria-pressed')=='true':click_action(page,'auto')
   # University produces a second card in the same year. Its entrance and input
   # guard must be fresh, and a queued native close event cannot cancel it.
   while int(page.locator('.age-display strong').inner_text())<18:
    next_stop(page)
    expect(page.locator('.choices')).to_have_attribute('aria-busy','false')
    age=int(page.locator('.age-display strong').inner_text())
    page.locator('[data-choice="0"]').click()
    if age==18:break
   expect(page.locator('#modal')).to_be_visible()
   assert page.locator('.choice-tag').inner_text().startswith('18 岁')
   if preference=='no-preference':
    assert page.locator('.choices').get_attribute('aria-busy')=='true'
    before=page.evaluate("JSON.parse(localStorage.getItem('birth.v1')).current.deep.experience.chapters.length")
    page.locator('[data-choice="0"]').press('Enter')
    assert page.evaluate("JSON.parse(localStorage.getItem('birth.v1')).current.deep.experience.chapters.length")==before
   expect(page.locator('.choices')).to_have_attribute('aria-busy','false')
   page.locator('[data-choice="0"]').click();expect(page.locator('#modal')).not_to_be_visible()
   assert page.locator('.panel-collapse').count()==(6 if width<650 else 0)
   assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
   assert not errors,errors
   results.append({'width':width,'motionPreference':preference,'frames':probe['frames'],
    'oldRowRetained':True,'collapseAndReopen':True,'sameYearCards':True,'manualOverrideMs':override,'errors':errors})
   ctx.close()
 browser.close()
(OUT/'results.json').write_text(json.dumps(results,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps([{k:v for k,v in r.items() if k!='frames'} for r in results],ensure_ascii=False))
