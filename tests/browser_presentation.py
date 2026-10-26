"""Responsive town layout, progressive disclosure, keyboard, dark mode and preferences."""
from playwright.sync_api import sync_playwright,expect
from browser_helpers import click_action,next_stop
from pathlib import Path
import json,os,subprocess
BASE=os.environ.get('BIRTH_TEST_URL','http://127.0.0.1:4173')
OUT=Path(os.environ.get('BIRTH_TEST_OUTPUT','test-results/presentation')).resolve();OUT.mkdir(parents=True,exist_ok=True)
fixture=json.loads(subprocess.check_output(['node','tests/browser-fixtures.mjs'],text=True,encoding='utf-8'))[0]
errors=[];results=[]
with sync_playwright() as p:
 browser=p.chromium.launch(headless=True,executable_path=os.environ.get('CHROMIUM_PATH'))
 delayed=[];ctx=browser.new_context();page=ctx.new_page()
 page.route('**/data/land.json',lambda route:delayed.append(route))
 page.goto(BASE,wait_until='domcontentloaded');expect(page.locator('#birth-button')).to_be_enabled()
 page.locator('#birth-button').click();expect(page.locator('#registration-view')).to_be_visible()
 assert delayed;delayed[0].continue_();expect(page.locator('.certificate-map svg')).to_be_visible(timeout=30000);ctx.close()
 for width in [360,390,768,1280,1440,1920]:
  ctx=browser.new_context(viewport={'width':width,'height':1000 if width>650 else 844},reduced_motion='reduce')
  page=ctx.new_page();page.on('pageerror',lambda e:errors.append(str(e)))
  page.goto(BASE,wait_until='networkidle')
  assert page.locator('#reflection-mode').is_checked()
  expect(page.locator('.country-row')).to_have_count(10)
  page.locator('[data-world=future]').click();expect(page.locator('#data-description')).to_contain_text('2050')
  page.locator('[data-world=today]').click();page.locator('#reflection-mode').uncheck()
  page.locator('[data-duration="90"]').click();page.locator('#origin-select').select_option('CHN')
  page.reload(wait_until='networkidle');assert page.locator('[data-duration="90"]').get_attribute('aria-pressed')=='true'
  assert page.locator('#origin-select').input_value()=='CHN'
  page.screenshot(path=str(OUT/f'home-{width}.png'))
  page.goto(BASE+f'/?seed={fixture["seed"]}',wait_until='networkidle');page.locator('#shared-birth').click()
  page.screenshot(path=str(OUT/f'certificate-{width}.png'))
  page.locator('[data-action=begin-life]').click();page.locator('[data-action=pause]').click()
  assert not page.locator('.identity-card').is_visible();assert not page.locator('.timeline').is_visible()
  assert not page.locator('.town-focus').count();assert page.locator('[data-town-place]').count()==1
  world=page.locator('.town-world').bounding_box();journal=page.locator('.town-journal').bounding_box()
  if width<=850:assert world['y']<journal['y']
  else:assert world['x']+world['width']<journal['x'] and abs(world['y']-journal['y'])<10
  assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
  page.screenshot(path=str(OUT/f'game-{width}.png'),full_page=True)
  page.locator('.journal-archive summary').click();row=page.locator('.event').first
  row.press('Enter');expect(row).to_have_attribute('aria-expanded','true')
  row.locator('.event-star').click();expect(row.locator('.event-star')).to_have_attribute('aria-pressed','true')
  row.press('Enter');expect(row).to_have_attribute('aria-expanded','false')
  page.locator('.journal-archive summary').click();assert not page.locator('.timeline').is_visible()
  page.locator('[data-action=town-profile]:visible').first.click();assert page.locator('.identity-card').is_visible()
  assert page.locator('.dossier-peers>div').count()==4
  page.locator('.character-dossier summary').click()
  click_action(page,'music');assert page.locator('[data-action=music]:visible').get_attribute('aria-pressed')=='true'
  page.keyboard.press('Escape');assert not page.locator('.game-menu').is_visible()
  next_stop(page);assert page.locator('.choice-tag').inner_text().startswith('2 岁')
  page.locator('[aria-label="收起当前抉择"]').click();assert page.locator('[data-action=decision]').is_visible()
  page.locator('[data-action=decision]').click();page.locator('[data-choice="0"]').click()
  next_stop(page);page.locator('[data-choice="0"]').click();page.locator('[data-action=moment-next]').click()
  if page.locator('.town-focus').get_attribute('open') is None:page.locator('.town-focus summary').click()
  page.locator('[data-focus=health]').click();assert page.locator('[data-focus=health]').get_attribute('aria-pressed')=='true'
  assert page.evaluate("JSON.parse(localStorage.getItem('birth.v1')).current.deep.autoFocus===false")
  click_action(page,'reflection-toggle');assert page.evaluate("JSON.parse(localStorage.getItem('birth.v1')).current.deep.reflectionsEnabled")
  click_action(page,'reflection-toggle');click_action(page,'theme')
  assert page.locator('body').evaluate('(x)=>x.classList.contains("dark")')
  assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
  page.keyboard.press('Escape');page.evaluate('scrollTo(0,0)');page.screenshot(path=str(OUT/f'game-dark-{width}.png'),full_page=True)
  results.append({'width':width,'sideBySide':width>850,'foldedArchives':True,'progressiveLocations':True,'keyboardAndTheme':True,'overflow':False})
  ctx.close()
 assert not errors,errors
 browser.close()
(OUT/'results.json').write_text(json.dumps({'viewports':results,'runtimeErrors':errors,'delayedMapRecovered':True},ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps({'viewports':results,'runtimeErrors':errors,'delayedMapRecovered':True},ensure_ascii=False))
