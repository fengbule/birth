"""Operate the same visible controls that desktop and compact layouts expose."""

def click_action(page, action):
    if page.locator('body').get_attribute('data-view') == 'home' and action in ['exit','home']:
        return
    if page.locator('body').get_attribute('data-view') == 'record' and action in ['history','exit','home']:
        page.locator('#record-view [data-action=home]').click()
        if action in ['exit','home']:return
    selector = '[data-action="'+action+'"]'
    visible = page.locator(selector+':visible')
    if visible.count():
        visible.first.click()
    else:
        menu = page.locator('.game-menu')
        if not menu.is_visible():
            page.locator('[data-action=game-menu]').click()
        page.locator(selector+':visible').first.click()

def click_tool(page, tool):
    selector = '[data-deep="'+tool+'"]'
    if not page.locator(selector+':visible').count():
        if not page.locator('.game-menu').is_visible():
            page.locator('[data-action=game-menu]').click()
    page.locator(selector+':visible').first.click()

def finish_ending(page):
    if page.locator('#ending-view').is_visible():
        page.locator('#ending-view [data-action=ending-skip]').click()
        page.locator('#ending-view [data-action=ending-skip]').click()


def next_stop(page):
    """Fast-forward through visible years; stop at a decision, reflection or end."""
    for _ in range(250):
        if page.locator('#modal[open]').is_visible() or page.locator('#ending-view').is_visible():
            return
        if page.locator('[data-action=moment-next]:visible').count():
            page.locator('[data-action=moment-next]').click()
            continue
        if page.locator('.moment-card.is-happening').is_visible():
            page.wait_for_function("()=>!document.querySelector('.moment-card.is-happening')",timeout=15000)
            continue
        button=page.locator('[data-action=next-choice]')
        if button.get_attribute('aria-pressed')!='true':button.click()
        page.wait_for_function('''()=>document.querySelector('#modal').open ||
            !document.querySelector('#ending-view').classList.contains('hidden') ||
            document.querySelector('[data-action="moment-next"]') ||
            document.querySelector('[data-action="next-choice"]').getAttribute('aria-pressed')==='false' ''',timeout=45000)
        if page.locator('#modal[open]').is_visible() or page.locator('#ending-view').is_visible():return
    raise AssertionError('Could not reach a stop through visible fast-forward controls')
