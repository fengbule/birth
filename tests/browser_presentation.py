"""Continuous timeline layout, disclosure, keyboard, theme and reload at six widths."""
from playwright.sync_api import sync_playwright, expect
from browser_helpers import click_action
from pathlib import Path
import json, os, subprocess

BASE=os.environ.get('BIRTH_TEST_URL','http://127.0.0.1:4173')
OUT=Path(os.environ.get('BIRTH_TEST_OUTPUT','test-results/presentation')).resolve()
OUT.mkdir(parents=True,exist_ok=True)
fixture=next(f for f in json.loads(subprocess.check_output(['node','tests/browser-fixtures.mjs'],text=True,encoding='utf-8')) if f['country']=='CHN')
errors=[];results=[]
with sync_playwright() as p:
 browser=p.chromium.launch(headless=True,executable_path=os.environ.get('CHROMIUM_PATH'))
 for width in [360,390,768,1280,1440,1920]:
  ctx=browser.new_context(viewport={'width':width,'height':1000 if width>650 else 844},reduced_motion='reduce')
  page=ctx.new_page();page.on('pageerror',lambda e:errors.append(str(e)))
  page.goto(BASE,wait_until='networkidle')
  assert page.locator('#origin-select option').count()==173
  page.locator('#reflection-mode').uncheck();page.locator('[data-duration="30"]').click()
  page.locator('#origin-select').select_option('CHN')
  page.reload(wait_until='networkidle')
  assert page.locator('#origin-select').input_value()=='CHN'
  page.screenshot(path=str(OUT/f'home-{width}.png'))
  page.goto(BASE+f'/?seed={fixture["seed"]}',wait_until='networkidle')
  page.locator('#shared-birth').click()
  page.locator('[data-action=begin-life]').click();page.locator('[data-action=pause]').click()
  expect(page.locator('.identity-card')).to_be_visible()
  expect(page.locator('.timeline')).to_be_visible()
  expect(page.locator('.focus-box')).to_be_visible()
  expect(page.locator('.event')).to_have_count(1)
  assert page.locator('.event h3,.town-world,[data-action=moment-next]').count()==0
  scene=page.locator('.scene-card').bounding_box()
  feed=page.locator('.timeline').bounding_box()
  focus=page.locator('.focus-box').bounding_box()
  identity=page.locator('.identity-card').bounding_box()
  stats=page.locator('.profile-card').bounding_box()
  family=page.locator('.insight-card').first.bounding_box()
  if width<650:
   assert scene['y']<feed['y']<focus['y']<stats['y']<identity['y']<family['y']
   expect(page.locator('.compact-stats')).to_be_visible()
  elif width>=1280:
   assert identity['x']<scene['x']<family['x']
   assert abs(identity['y']-scene['y'])<5 and abs(family['y']-scene['y'])<5
  assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
  row=page.locator('.event').first
  row.press('Enter');expect(row).to_have_attribute('aria-expanded','true')
  star=row.locator('[data-star]');event_id=star.get_attribute('data-star')
  star.click();expect(star).to_have_attribute('aria-pressed','true')
  row.press('Enter');expect(row).to_have_attribute('aria-expanded','false')
  page.screenshot(path=str(OUT/f'game-{width}.png'),full_page=True)
  page.reload(wait_until='networkidle');page.locator('#resume-button').click()
  page.locator('[data-action=pause]').click()
  expect(page.locator(f'[data-star="{event_id}"]')).to_have_attribute('aria-pressed','true')
  click_action(page,'theme')
  assert page.locator('body').evaluate('(x)=>x.classList.contains("dark")')
  page.keyboard.press('Escape');page.evaluate('scrollTo(0,0)')
  assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
  page.screenshot(path=str(OUT/f'game-dark-{width}.png'),full_page=True)
  results.append({'width':width,'timelineVisible':True,'mobileOrder':width<650,'keyboardStarReload':True,'theme':True,'overflow':False})
  ctx.close()
 assert not errors,errors
 browser.close()
(OUT/'results.json').write_text(json.dumps({'viewports':results,'runtimeErrors':errors},ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps({'viewports':results,'runtimeErrors':errors},ensure_ascii=False))
