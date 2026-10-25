"""Responsive presentation and new controls, without public API mutations."""
from playwright.sync_api import sync_playwright, expect
from browser_helpers import click_action, finish_ending, next_stop
from pathlib import Path
import json, os

BASE = os.environ.get('BIRTH_TEST_URL', 'http://127.0.0.1:4173')
OUT = Path(os.environ.get('BIRTH_TEST_OUTPUT', 'test-results')).resolve()
OUT.mkdir(parents=True, exist_ok=True)
errors, results = [], []

def assert_fits(page):
    if not page.evaluate('document.documentElement.scrollWidth <= innerWidth'):
        page.screenshot(path=str(OUT/'overflow.png'),full_page=True)
        print(page.evaluate('''()=>[...document.querySelectorAll('body *')].filter(e=>{
            const r=e.getBoundingClientRect();return r.width&&r.right>innerWidth+1;
            }).map(e=>({tag:e.tagName,cls:e.className,text:e.textContent.slice(0,60),rect:e.getBoundingClientRect().toJSON()})).slice(0,20)'''),flush=True)
        raise AssertionError('Horizontal overflow')

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True, executable_path=os.environ.get('CHROMIUM_PATH'))
    delayed = []
    ctx = browser.new_context()
    page = ctx.new_page()
    page.on('pageerror', lambda e: errors.append(str(e)))
    page.route('**/data/land.json', lambda route: delayed.append(route))
    page.goto(BASE, wait_until='domcontentloaded')
    expect(page.locator('#birth-button')).to_be_enabled()
    page.locator('#birth-button').click()
    expect(page.locator('#registration-view')).to_be_visible()
    assert page.locator('.certificate-map svg').count() == 0
    assert delayed
    delayed[0].continue_()
    expect(page.locator('.certificate-map svg')).to_be_visible(timeout=30000)
    ctx.close()
    for width in [360, 390, 768, 1280, 1440, 1920]:
        ctx = browser.new_context(viewport={'width': width, 'height': 1000 if width>650 else 844}, reduced_motion='reduce')
        page = ctx.new_page()
        page.add_init_script('crypto.getRandomValues = a => {a.fill(9);return a;}')
        page.on('pageerror', lambda e: errors.append(str(e)))
        page.goto(BASE, wait_until='networkidle')
        assert_fits(page)
        assert page.locator('#reflection-mode').is_checked()
        assert page.locator('.country-row').count() == 10
        widths = page.locator('.country-fill').evaluate_all('(xs)=>xs.map(x=>x.getBoundingClientRect().width)')
        assert abs(widths[-1] - widths[0]) < 2
        page.screenshot(path=str(OUT/f'home-{width}.png'))
        page.locator('[data-world=future]').click()
        expect(page.locator('#data-description')).to_contain_text('2050')
        assert page.locator('[data-world=future]').get_attribute('aria-pressed') == 'true'
        page.locator('[data-world=any]').click()
        page.locator('#reflection-mode').uncheck()
        page.locator('[data-duration="90"]').click()
        page.locator('#origin-select').select_option('CHN')
        page.reload(wait_until='networkidle')
        assert page.locator('[data-duration="90"]').get_attribute('aria-pressed') == 'true'
        assert page.locator('#origin-select').input_value() == 'CHN'
        assert page.locator('#world-select').input_value() == 'any'
        assert not page.locator('#reflection-mode').is_checked()
        page.locator('#birth-button').click()
        expect(page.locator('body')).to_have_attribute('data-view', 'registration')
        assert_fits(page)
        state = page.evaluate("JSON.parse(localStorage.getItem('birth.v1')).current")
        assert state['deep']['world'] in ['today', 'past', 'future']
        assert state['duration'] == 90 and state['origin'] == 'CHN'
        assert state['year'] in [1970, 1990, 2010, 2050, 2026]
        assert page.locator('.certificate-peer-grid > div').count() == 4
        page.screenshot(path=str(OUT/f'certificate-{width}.png'))
        page.locator('[data-action=begin-life]').click()
        page.locator('[data-action=pause]').click()
        assert not page.locator('#focus-select').is_visible()
        assert not page.locator('.focus-choices').is_visible()
        assert page.locator('.life-squares i').count() == 70
        page.locator('.event h3').first.click()
        expect(page.locator('.event').first).to_have_attribute('aria-expanded','true')
        page.locator('.event-star').first.click()
        expect(page.locator('.event-star').first).to_have_attribute('aria-pressed','true')
        page.locator('.event').first.press('Enter')
        expect(page.locator('.event').first).to_have_attribute('aria-expanded','false')
        assert_fits(page)
        if width <= 650:
            scene_y = page.locator('.scene-card').bounding_box()['y']
            timeline_y = page.locator('.story-column').bounding_box()['y']
            identity_y = page.locator('.identity-card').bounding_box()['y']
            assert scene_y < timeline_y < identity_y
            assert page.locator('.compact-stats').is_visible()
            assert page.locator('.panel-collapse:visible').count() == 6
            page.locator('.panel-collapse[data-panel="1"]').click()
            assert not page.locator('.profile-stats').is_visible()
            page.locator('.panel-collapse[data-panel="1"]').press('Enter')
            assert page.locator('.profile-stats').is_visible()
            page.evaluate('scrollTo(0,0)')
        elif width >= 1280:
            bounds = [page.locator(x).bounding_box() for x in ['.profile-column','.life-main','.game-insights']]
            assert bounds[0]['x'] < bounds[1]['x'] < bounds[2]['x']
            assert max(x['y'] for x in bounds) - min(x['y'] for x in bounds) < 2
        page.screenshot(path=str(OUT/f'game-{width}.png'))
        page.locator('[data-action=game-menu]').click()
        expect(page.locator('[data-action=game-menu]')).to_have_attribute('aria-expanded', 'true')
        page.keyboard.press('Escape')
        assert not page.locator('.game-menu').is_visible()
        next_stop(page)
        assert page.locator('#modal').bounding_box()['width'] <= 561
        page.locator('[aria-label="收起当前抉择"]').click()
        assert page.locator('.age-display strong').inner_text() == '2'
        page.locator('[data-action=decision]').click()
        page.locator('[data-choice="0"]').click()
        next_stop(page)
        page.locator('[data-choice="0"]').click()
        page.locator('[data-focus=health]').click()
        assert page.locator('[data-focus=health]').get_attribute('aria-pressed') == 'true'
        assert page.evaluate("JSON.parse(localStorage.getItem('birth.v1')).current.focus") == 'health'
        click_action(page, 'reflection-toggle')
        assert page.evaluate("JSON.parse(localStorage.getItem('birth.v1')).current.deep.reflectionsEnabled") is True
        click_action(page, 'reflection-toggle')
        click_action(page, 'theme')
        assert page.locator('body').evaluate('(x)=>x.classList.contains("dark")')
        assert_fits(page)
        if width == 1920:
            next_stop(page)
            page.locator('[data-action=choice-auto]').click()
            expect(page.locator('#modal')).not_to_be_visible(timeout=6000)
            assert page.evaluate("JSON.parse(localStorage.getItem('birth.v1')).current.auto") is True
        if width == 390:
            page.screenshot(path=str(OUT/'mobile-menu-dark.png'))
            click_action(page, 'theme')
            for _ in range(120):
                if page.locator('#ending-view').is_visible(): break
                if page.locator('[data-choice]').first.is_visible(): page.locator('[data-choice="1"]').click()
                else: next_stop(page)
            assert page.locator('#ending-view').is_visible()
            page.screenshot(path=str(OUT/'ending-mobile.png'))
            finish_ending(page)
            expect(page.locator('#memory-note')).to_be_visible()
            page.locator('[data-action=replay-ending]').click()
            expect(page.locator('#ending-view')).to_be_visible()
            page.locator('.ending-skip').click()
            assert page.locator('#ending-view').is_visible()
            page.locator('.ending-skip').click()
            expect(page.locator('#memory-note')).to_be_visible()
            assert page.evaluate("JSON.parse(localStorage.getItem('birth.v1')).history.length") == 1
        results.append({'width': width, 'overflow': False, 'world': state['deep']['world'], 'year': state['year']})
        ctx.close()
    assert not errors, errors
    print(json.dumps({'viewports': results, 'runtimeErrors': errors, 'endingReplayAndSkip': True, 'delayedMapRecovered': True, 'comparisonRegressions': ['infantFocusHidden','birthPeers','barScale','lifeGrid','expandAndStar','mobileCollapse','choiceCollapse','choiceAuto']}))
    browser.close()
