"""Capture matching public UI steps on the reference and a deployment.

This reports observed differences; a successful capture is not an equivalence pass.
Reference requests are read-only. No original application source/assets are copied.
"""
from playwright.sync_api import sync_playwright
from pathlib import Path
from datetime import datetime, timezone
import html, json, os, re

REFERENCE = os.environ.get('BIRTH_REFERENCE_URL', 'https://1in8b.life/zh-hans/')
DEPLOYED = os.environ.get('BIRTH_TEST_URL', 'http://127.0.0.1:4173')
OUT = Path(os.environ.get('BIRTH_TEST_OUTPUT', 'test-results/comparison')).resolve()
OUT.mkdir(parents=True, exist_ok=True)
report = {'time': datetime.now(timezone.utc).isoformat(), 'reference': REFERENCE,
          'deployed': DEPLOYED, 'scope': 'Rendered UI samples, not rule equivalence',
          'randomIdentity': 'Drawn separately; character values are not directly comparable',
          'screens': {}, 'pairs': [], 'errors': {}}


def visible_style(page, selector):
    return page.locator(selector).evaluate_all('''xs=>xs.filter(x=>x.checkVisibility()).slice(0,1).map(x=>{
      const r=x.getBoundingClientRect(),s=getComputedStyle(x);
      return {x:r.x,y:r.y,width:r.width,height:r.height,fontSize:s.fontSize,fontWeight:s.fontWeight};})''')


def capture(page, side, stage, width):
    name = f'{side}-{stage}-{width}'
    page.screenshot(path=str(OUT/(name+'.png')))
    data = {'overflow': page.evaluate('document.documentElement.scrollWidth>innerWidth'),
            'heading': visible_style(page, 'h1'),
            'pauseButton': visible_style(page, '#pauseBtn' if side=='reference' else '[data-action=pause]'),
            # The identity portrait contains another clipped SVG with the same class.
            'scene': visible_style(page, '#scene' if side=='reference' else '.scene-card > .life-scene'),
            'gridCells': page.locator('#grid > *' if side=='reference' else '.life-squares > *').count(),
            'focusButtonsVisible': page.locator('#focusChips button:visible' if side=='reference' else '.focus-choices button:visible').count(),
            'focusSelectVisible': page.locator('#focus-select:visible').count(),
            'screenshot': name+'.png'}
    report['screens'][name] = data
    return name+'.png'


with sync_playwright() as p:
    browser = p.chromium.launch(headless=True, executable_path=os.environ.get('CHROMIUM_PATH'))
    for width, height in [(1440,1000), (390,844)]:
        contexts, pages = [], {}
        for side, url in [('reference',REFERENCE), ('deployed',DEPLOYED)]:
            ctx = browser.new_context(viewport={'width':width,'height':height},
                device_scale_factor=1, locale='zh-CN', timezone_id='Asia/Shanghai',
                is_mobile=width<650, has_touch=width<650, color_scheme='light',
                reduced_motion='reduce', extra_http_headers={'DNT':'1','Sec-GPC':'1'})
            contexts.append(ctx)
            if side=='reference':
                ctx.add_init_script("Object.defineProperty(navigator,'globalPrivacyControl',{get:()=>true});")
                ctx.route('**/*', lambda route: route.continue_() if route.request.method in ['GET','HEAD','OPTIONS'] else route.abort())
            page = ctx.new_page()
            key = f'{side}-{width}'
            report['errors'][key] = []
            page.on('pageerror', lambda error,key=key: report['errors'][key].append(str(error)))
            page.set_default_timeout(15000)
            page.goto(url, wait_until='networkidle', timeout=60000)
            pages[side] = page
            if side=='reference':
                version = re.search(r'v0\.\d+\.\d+', page.locator('body').inner_text())
                report['referenceVersion'] = version.group() if version else 'unidentified'
            capture(page, side, 'home', width)
        for stage in ['home','birth','game','menu']:
            if stage != 'home':
                for side, page in pages.items():
                    page.bring_to_front()
                    if stage=='birth':
                        if side=='reference':
                            page.get_by_role('button',name='约30分钟',exact=True).click()
                            page.locator('#homeSel').select_option('CHN')
                            page.locator('#startBtn').click()
                            page.locator('#beginBtn').wait_for(timeout=45000)
                        else:
                            page.locator('[data-duration="30"]').click()
                            page.locator('#origin-select').select_option('CHN')
                            page.locator('#birth-button').click()
                    elif stage=='game':
                        page.locator('#beginBtn' if side=='reference' else '[data-action=begin-life]').click()
                        page.locator('#pauseBtn' if side=='reference' else '[data-action=pause]').click()
                    elif stage=='menu':
                        if side=='reference' and width<650: page.locator('#moreBtn').click()
                        elif side=='deployed' and page.locator('[data-action=game-menu]').is_visible(): page.locator('[data-action=game-menu]').click()
                    capture(page, side, stage, width)
            report['pairs'].append({'title':f'{width}px · {stage}',
                'reference':f'reference-{stage}-{width}.png','deployed':f'deployed-{stage}-{width}.png'})
        for ctx in contexts: ctx.close()
    browser.close()

(OUT/'comparison.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
pairs = ''.join(f'''<section><h2>{html.escape(x['title'])}</h2><div class="pair"><figure><figcaption>原站</figcaption><a href="{x['reference']}"><img src="{x['reference']}" alt="原站截图"></a></figure><figure><figcaption>部署版</figcaption><a href="{x['deployed']}"><img src="{x['deployed']}" alt="部署版截图"></a></figure></div></section>''' for x in report['pairs'])
document = '''<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>BIRTH 实测对照</title><style>
body{margin:24px auto;padding:0 20px;max-width:1500px;font:16px/1.7 system-ui;background:#ebf0ed;color:#13212a}header{position:sticky;top:0;background:#ebf0edf5;padding:10px;z-index:5;border-bottom:1px solid #c7d2ce}h1{font-size:26px}h2{font-size:20px}.pair{display:grid;grid-template-columns:1fr 1fr;gap:16px}figure{margin:0;min-width:0}img{width:100%;display:block;border:1px solid #c7d2ce}figcaption{padding:6px;font-weight:700}.overlay .pair{display:block;position:relative}.overlay figure:nth-child(2){position:absolute;inset:0;opacity:var(--opacity,.5)}.overlay figcaption{display:none}section{margin:30px 0}select,input{margin-left:12px}@media(max-width:700px){.pair{grid-template-columns:1fr}}
</style><header><h1>原站与部署版 · 实际浏览器对照</h1><p>相同浏览器、视口、30 分钟与家乡中国设置。两边随机身份不同；不以人物数值或原始像素差推断规则等价。截图采集成功也不表示复现通过。</p><label>视图<select id="mode"><option value="">并排</option><option value="overlay">叠加</option></select></label><label>部署版透明度<input id="opacity" type="range" min="0" max="100" value="50"></label> · <a href="comparison.json">布局尺寸与运行记录 JSON</a></header>''' + pairs + '''<script>document.querySelector('#mode').onchange=e=>document.body.className=e.target.value;document.querySelector('#opacity').oninput=e=>document.body.style.setProperty('--opacity',e.target.value/100);</script></html>'''
(OUT/'comparison.html').write_text(document,encoding='utf-8')
print(json.dumps({'comparisonCaptured':True,'referenceVersion':report.get('referenceVersion'),
                  'pairs':len(report['pairs']),'runtimeErrors':report['errors'],
                  'equivalence':'not asserted','report':str(OUT/'comparison.html')},ensure_ascii=False))
