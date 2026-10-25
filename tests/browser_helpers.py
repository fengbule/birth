"""Operate the same visible controls that desktop and compact layouts expose."""

def click_action(page, action):
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
    if not page.locator(selector).is_visible():
        if not page.locator('.game-menu').is_visible():
            page.locator('[data-action=game-menu]').click()
    page.locator(selector).click()

def finish_ending(page):
    if page.locator('#ending-view').is_visible():
        page.locator('#ending-view [data-action=ending-record]').last.click()
