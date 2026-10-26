import json
from pathlib import Path
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1]
user=next(u for u in json.loads((ROOT/'var/identity.json').read_text())['users'] if u['role']=='approver')
def login(page):
 page.goto('http://127.0.0.1:5190');page.wait_for_load_state('networkidle');page.get_by_role('link',name='Đăng nhập qua Keycloak').click();page.locator('#username').fill(user['username']);page.locator('#password').fill(user['password']);page.locator('#kc-login').click();page.get_by_label('Không gian 3D vận hành logistics').wait_for()
with sync_playwright() as p:
 browser=p.chromium.launch(executable_path='/usr/bin/google-chrome',headless=True,args=['--no-sandbox'])
 page=browser.new_page(viewport={'width':1600,'height':1100});errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 login(page);page.locator('.twin-stage canvas').wait_for();page.wait_for_timeout(1200);page.evaluate('scrollTo(0,0)');page.screenshot(path=str(ROOT/'docs/waretrack-merged-desktop.png'),full_page=True)
 page.get_by_role('button',name='Ẩn nhãn mô hình').click();page.locator('.twin-map-label').wait_for(state='hidden');page.get_by_role('button',name='Hiện nhãn mô hình').click();page.locator('.twin-map-label').wait_for(state='visible')
 page.get_by_label('Chọn đối tượng').select_option('stock:q7-salad');assert page.get_by_label('Khuôn viên đang xem').input_value()=='q7';assert page.get_by_role('button',name='Đóng mái kho').is_visible()
 page.get_by_role('button',name='Xem gần đối tượng').click();page.wait_for_timeout(1500);page.evaluate('scrollTo(0,0)');page.screenshot(path=str(ROOT/'docs/twin-focus.png'),full_page=True)
 page.get_by_role('button',name='Toàn màn hình 3D').click();page.wait_for_function('Boolean(document.fullscreenElement)');page.evaluate('document.exitFullscreen()')
 page.get_by_role('button',name='Góc nhìn từ trên').click();page.get_by_role('button',name='Khôi phục góc nhìn').click();page.set_viewport_size({'width':390,'height':844});assert page.evaluate('document.documentElement.scrollWidth<=innerWidth');page.evaluate('scrollTo(0,0)');page.screenshot(path=str(ROOT/'docs/waretrack-merged-mobile.png'),full_page=True);assert not errors,errors
 context=browser.new_context();context.add_init_script("const original=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(type,...args){return type==='webgl2'||type==='webgl'?null:original.call(this,type,...args);};")
 fallback=context.new_page();login(fallback);fallback.get_by_role('heading',name='Chế độ vận hành dạng bảng').wait_for();fallback.get_by_label('Chọn đối tượng').select_option('stock:q1-salad');assert fallback.get_by_label('Thông tin đối tượng vận hành').get_by_text('q1-salad',exact=True).is_visible();assert fallback.locator('.twin-stage canvas').count()==0
 fallback.screenshot(path=str(ROOT/'docs/twin-fallback.png'),full_page=True)
 (ROOT/'docs/twin-browser-validation.json').write_text(json.dumps({'passed':True,'checks':['WebGL rendering','labels hide/show','stock selector changes warehouse and opens roof','focus camera','fullscreen enter/exit','camera top/reset','mobile has no horizontal overflow','no-WebGL accessible data fallback'],'pageErrors':errors},ensure_ascii=False,indent=2))
 browser.close();print('3D browser controls and no-WebGL fallback passed.')
