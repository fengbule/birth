"""The visible interaction loop: choose, walk, act, reveal, continue."""
from pathlib import Path
from playwright.sync_api import sync_playwright,expect
from browser_helpers import next_stop,click_action
import json,os,subprocess,time
BASE=os.environ.get('BIRTH_TEST_URL','http://127.0.0.1:4173')
OUT=Path(os.environ.get('BIRTH_TEST_OUTPUT','test-results/town')).resolve();OUT.mkdir(parents=True,exist_ok=True)
fixture=json.loads(subprocess.check_output(['node','tests/browser-fixtures.mjs'],text=True,encoding='utf-8'))[0]
results=[]
with sync_playwright() as p:
 browser=p.chromium.launch(headless=True,executable_path=os.environ.get('CHROMIUM_PATH'))
 for width in [390,1440]:
  context=browser.new_context(viewport={'width':width,'height':900 if width<800 else 1050},locale='zh-CN')
  page=context.new_page();page.set_default_timeout(15000);errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
  page.goto(BASE,wait_until='networkidle');page.locator('#reflection-mode').uncheck()
  page.goto(BASE+f'/?seed={fixture["seed"]}',wait_until='networkidle');page.locator('#shared-birth').click()
  page.locator('[data-action=begin-life]').click();page.locator('[data-action=pause]').click()
  expect(page.locator('.town-landscape')).to_be_visible()
  page.wait_for_function("()=>{const img=document.querySelector('.town-landscape');return img?.complete&&img.naturalWidth>0}")
  assert page.locator('[data-town-place]').count()==1
  assert not page.locator('.identity-card').is_visible()
  assert not page.locator('.timeline').is_visible()
  assert not page.locator('.town-focus').count()
  page.screenshot(path=str(OUT/f'birth-{width}.png'),full_page=True)
  page.locator('[data-town-place=home]').click()
  page.screenshot(path=str(OUT/f'home-activity-{width}.png'),full_page=True)
  before=page.evaluate("JSON.parse(localStorage.getItem('birth.v1')).current")
  page.locator('[data-town-activity=town-home]').click()
  assert page.locator('.moment-card.is-happening').is_visible()
  during=page.evaluate("JSON.parse(localStorage.getItem('birth.v1')).current")
  assert during['relationships']==before['relationships']
  page.wait_for_timeout(400)
  assert page.evaluate("JSON.parse(localStorage.getItem('birth.v1')).current.deep.annual.actions.length")==0
  # Pausing the activity holds both animation and its eventual effects.
  page.locator('[data-action=pause]').click();page.wait_for_timeout(2100)
  assert page.locator('.moment-card.is-happening').is_visible()
  assert page.evaluate("JSON.parse(localStorage.getItem('birth.v1')).current.deep.annual.actions.length")==0
  page.locator('[data-speed="2"]').click()
  assert page.locator('[data-action=pause]').get_attribute('aria-pressed')=='false'
  expect(page.locator('.moment-card.is-happening')).not_to_be_visible(timeout=6000)
  assert page.locator('.moment-card h2').inner_text()=='和家人待一会儿'
  after=page.evaluate("JSON.parse(localStorage.getItem('birth.v1')).current")
  assert after['relationships']>before['relationships']
  assert after['deep']['annual']['actions']==['town-home']
  page.wait_for_timeout(800)
  assert page.locator('.age-display strong').inner_text()=='0'
  page.screenshot(path=str(OUT/f'home-result-{width}.png'),full_page=True)
  page.locator('[data-action=moment-next]').click()
  assert page.locator('[data-town-activity=town-home]').is_disabled()
  # An interrupted trip must not charge or apply an activity.
  page.locator('[data-town-activity=town-rest]').click()
  page.locator('[data-action=activity-cancel]').click()
  assert page.evaluate("JSON.parse(localStorage.getItem('birth.v1')).current.deep.annual.actions")==['town-home']
  page.locator('[data-action=place-close]').click()
  next_stop(page)
  assert page.locator('.choice-tag').inner_text().startswith('2 岁')
  page.locator('[data-choice="0"]').click()
  assert page.locator('[data-action=moment-next]').is_visible()
  next_stop(page)
  assert page.locator('.choice-tag').inner_text().startswith('7 岁')
  page.locator('[data-choice="1"]').click();page.locator('[data-action=moment-next]').click()
  page.locator('[data-town-place=lake]').click()
  page.locator('[data-town-activity=town-lake]').click()
  assert page.locator('.town-avatar.walking').count()==1
  expect(page.locator('.moment-card.is-happening')).not_to_be_visible(timeout=12000)
  page.locator('[data-action=moment-next]').click()
  assert page.locator('[data-town-place=school]').is_visible()
  page.locator('[data-town-place=school]').click()
  page.locator('[data-town-activity=town-read]').click()
  assert page.locator('.town-avatar.walking').count()==1
  page.screenshot(path=str(OUT/f'walking-to-school-{width}.png'),full_page=True)
  expect(page.locator('.moment-card.is-happening')).not_to_be_visible(timeout=12000)
  assert page.locator('.town-avatar').get_attribute('data-activity')=='school'
  assert page.locator('.moment-card h2').inner_text()=='读一点感兴趣的书'
  page.screenshot(path=str(OUT/f'school-result-{width}.png'),full_page=True)
  page.locator('[data-action=moment-next]').click()
  page.locator('.journal-archive summary').click()
  assert page.locator('.timeline').is_visible()
  assert not page.locator('.identity-card').is_visible()
  page.locator('.event').first.locator('h3').click();page.locator('.event-star').first.click()
  page.reload(wait_until='networkidle');page.locator('#resume-button').click();page.locator('[data-action=pause]').click()
  assert not page.locator('.timeline').is_visible()
  page.locator('.journal-archive summary').click()
  assert page.locator('.event-star').first.get_attribute('aria-pressed')=='true'
  # Reach adulthood through the same staged public controls, then buy on the map.
  for _ in range(30):
   if int(page.locator('.age-display strong').inner_text())>=25:break
   next_stop(page)
   if page.locator('[data-choice]:visible').count():page.locator('[data-choice="1"]').click()
  assert int(page.locator('.age-display strong').inner_text())>=25
  while page.locator('[data-action=moment-next]:visible').count():page.locator('[data-action=moment-next]').click()
  if page.locator('[data-choice]:visible').count():
   page.locator('[data-choice="0"]').click()
   while page.locator('[data-action=moment-next]:visible').count():page.locator('[data-action=moment-next]').click()
  page.locator('[data-town-place=market]').click()
  before_money=page.evaluate("JSON.parse(localStorage.getItem('birth.v1')).current.money")
  page.locator('[data-town-activity=dinner]').click()
  assert page.evaluate("JSON.parse(localStorage.getItem('birth.v1')).current.money")==before_money
  # Refreshing during a trip cancels its uncommitted cost and effect.
  page.reload(wait_until='networkidle');page.locator('#resume-button').click()
  assert page.evaluate("JSON.parse(localStorage.getItem('birth.v1')).current.money")==before_money
  page.locator('[data-town-place=market]').click();page.locator('[data-town-activity=dinner]').click()
  assert page.evaluate("JSON.parse(localStorage.getItem('birth.v1')).current.money")==before_money
  expect(page.locator('.moment-card.is-happening')).not_to_be_visible(timeout=15000)
  assert page.evaluate("JSON.parse(localStorage.getItem('birth.v1')).current.money")<before_money
  while page.locator('[data-action=moment-next]:visible').count():page.locator('[data-action=moment-next]').click()
  assert page.locator('[data-town-activity=dinner]').is_disabled()
  page.evaluate('scrollTo(0,0)');page.wait_for_timeout(300)
  page.screenshot(path=str(OUT/f'adult-town-{width}.png'),full_page=True)
  assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
  assert not errors,errors
  results.append({'width':width,'deferredEffects':True,'pauseFreezesActivity':True,'cancelHasNoEffects':True,
    'storyWaitsForReader':True,'walkingToSchool':True,'progressiveLocations':True,'recordsFolded':True,
    'adultMapPurchaseDeferred':True,'refreshCancelsUncommittedPurchase':True,'runtimeErrors':errors})
  context.close()
 browser.close()
(OUT/'results.json').write_text(json.dumps(results,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps({'townInteraction':results},ensure_ascii=False))
