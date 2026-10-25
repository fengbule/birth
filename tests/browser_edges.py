"""Browser boundary checks, using isolated contexts and no public writes."""
from playwright.sync_api import sync_playwright, expect
from pathlib import Path
import copy, json, os

BASE = os.environ.get('BIRTH_TEST_URL', 'http://127.0.0.1:4173')
OUT = Path(os.environ.get('BIRTH_TEST_OUTPUT', 'test-results')).resolve()
OUT.mkdir(parents=True, exist_ok=True)
errors = []

def import_archive(page, value):
    with page.expect_file_chooser() as chooser:
        page.locator('[data-action=import]').click()
    chooser.value.set_files({
        'name': 'boundary-test.json', 'mimeType': 'application/json',
        'buffer': json.dumps(value, ensure_ascii=False).encode('utf-8')
    })

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True, executable_path=os.environ.get('CHROMIUM_PATH'))
    page = browser.new_page(viewport={'width': 1440, 'height': 1000})
    page.on('pageerror', lambda e: errors.append(str(e)))
    page.goto(BASE, wait_until='networkidle')
    assert page.locator('[data-duration][aria-pressed=true]').get_attribute('data-duration') == '60'
    assert page.locator('[data-duration]').evaluate_all('(xs)=>xs.map(x=>x.dataset.duration)') == ['30', '60', '90']
    page.locator('#birth-button').click()
    page.locator('[data-action=begin-life]').click()
    page.locator('[data-action=pause]').click()
    assert page.locator('[data-speed]').evaluate_all('(xs)=>xs.map(x=>x.dataset.speed)') == ['1', '2', '4', '8', '12', '16']
    for speed in ['2', '4', '8', '12', '16', '1']:
        page.locator('[data-speed="'+speed+'"]').click()
        assert page.locator('[data-speed="'+speed+'"]').get_attribute('aria-pressed') == 'true'
    paused_age = page.locator('.age-display strong').inner_text()
    page.wait_for_timeout(1300)
    assert page.locator('.age-display strong').inner_text() == paused_age
    saved = page.evaluate("JSON.parse(localStorage.getItem('birth.v1'))")
    page.locator('[data-action=history]').first.click()
    invalid = copy.deepcopy(saved)
    del invalid['current']['deep']['assets']['stocks']
    import_archive(page, invalid)
    expect(page.locator('#toast')).to_contain_text('无法导入')
    assert page.evaluate("JSON.parse(localStorage.getItem('birth.v1'))") == saved
    assert page.locator('.history-grid .life-card').count() == 0
    invalid = copy.deepcopy(saved)
    invalid['memorialOwners'] = {'bad': 'credential'}
    import_archive(page, invalid)
    expect(page.locator('#toast')).to_contain_text('无法导入')
    assert page.evaluate("JSON.parse(localStorage.getItem('birth.v1'))") == saved
    assert page.evaluate("localStorage.getItem('birth.memorialOwners')") is None
    safe = copy.deepcopy(saved)
    payload = '<img src=x onerror="window.injected=true">'
    safe['current']['name'] = payload
    safe['current']['id'] += '-escaped'
    safe['current']['events'][0]['text'] = payload
    import_archive(page, safe)
    expect(page.locator('#toast')).to_contain_text('档案已合并')
    page.locator('.history-grid .life-card').click()
    assert page.locator('#modal-content').get_by_text(payload, exact=True).count() >= 1
    assert page.evaluate('window.injected === undefined')
    assert page.locator('#modal-content img[src="x"]').count() == 0

    # Simulate a browser that stops allowing progress writes after startup.
    quota = browser.new_page()
    quota.on('pageerror', lambda e: errors.append(str(e)))
    quota.goto(BASE, wait_until='networkidle')
    quota.evaluate("""() => {
        const original = Storage.prototype.setItem;
        Storage.prototype.setItem = function(key, value) {
            if (key === 'birth.v1') throw new DOMException('Full', 'QuotaExceededError');
            return original.call(this, key, value);
        };
    }""")
    quota.locator('#birth-button').click()
    expect(quota.locator('#toast')).to_contain_text('浏览器无法保存进度')
    quota.locator('[data-action=begin-life]').click()
    quota.locator('[data-action=pause]').click()
    quota.locator('[data-action=history]').first.click()
    with quota.expect_download() as download:
        quota.locator('[data-action=export]').click()
    destination = OUT / 'quota-recovery-test.json'
    download.value.save_as(str(destination))
    recovered = json.loads(destination.read_text('utf-8'))
    assert recovered['current']['stage'] == 'living'
    assert not errors, errors
    print(json.dumps({'browserErrors': errors, 'speedControls': 6,
                      'invalidImportPreservedProgress': True,
                      'escapedImportedMarkup': True, 'quotaExportRecovery': True}))
    browser.close()
