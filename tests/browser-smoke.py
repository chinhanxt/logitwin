import json
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
identity = json.loads((ROOT / 'var/identity.json').read_text())

def login(page, role):
    user = next(u for u in identity['users'] if u['role'] == role)
    page.goto('http://127.0.0.1:5190')
    page.wait_for_load_state('networkidle')
    page.get_by_role('link', name='Đăng nhập qua Keycloak').click()
    page.locator('#username').fill(user['username'])
    page.locator('#password').fill(user['password'])
    page.locator('#kc-login').click()
    page.get_by_text('API đã kết nối', exact=True).wait_for()

with sync_playwright() as p:
    browser = p.chromium.launch(executable_path='/usr/bin/google-chrome', headless=True, args=['--no-sandbox'])
    context = browser.new_context(viewport={'width': 1536, 'height': 1050})
    reviewer = browser.new_context(viewport={'width': 1536, 'height': 1050})
    page, approval = context.new_page(), reviewer.new_page()
    errors = []
    page.on('pageerror', lambda e: errors.append(str(e)))
    approval.on('pageerror', lambda e: errors.append(str(e)))
    login(page, 'planner')
    page.get_by_role('button', name='Giám sát chuỗi lạnh', exact=True).click()
    page.get_by_label('Cửa hàng', exact=True).select_option('q7')
    page.get_by_label('Nhiệt độ mô phỏng (°C)').fill('12')
    page.get_by_role('button', name='Ghi bản đọc mô phỏng').click()
    page.get_by_role('status').wait_for()
    assert page.get_by_text('3 dòng hàng đang cách ly', exact=True).is_visible()
    page.screenshot(path=str(ROOT / 'docs/coldchain.png'), full_page=True)
    page.get_by_label('Nhiệt độ mô phỏng (°C)').fill('5')
    page.get_by_role('button', name='Ghi bản đọc mô phỏng').click()
    page.wait_for_function("Array.from(document.querySelectorAll('.tier-grid h3')).some(e=>e.textContent==='5°C')")
    assert page.get_by_text('3 dòng hàng đang cách ly', exact=True).is_visible()
    assert page.get_by_role('button', name='Xác nhận kiểm tra & giải phóng').is_disabled()
    login(approval, 'approver')
    approval.get_by_role('button', name='Giám sát chuỗi lạnh', exact=True).click()
    approval.get_by_label('Cửa hàng', exact=True).select_option('q7')
    approval.get_by_label('Lý do kiểm tra chất lượng').fill('Đã kiểm tra lại chất lượng hàng trong ca demo tự động.')
    approval.get_by_role('button', name='Xác nhận kiểm tra & giải phóng').click()
    approval.get_by_role('status').wait_for()
    assert approval.get_by_text('3 dòng hàng đang cách ly', exact=True).count() == 0
    page.get_by_role('button', name='Quyết định', exact=False).filter(has=page.locator('span')).first.click()
    if page.locator('.decision-card').count():
        page.locator('.decision-card').first.click()
        page.get_by_role('dialog').wait_for()
        page.keyboard.press('Escape')
        assert page.get_by_role('dialog').count() == 0
    page.set_viewport_size({'width': 390, 'height': 844})
    page.get_by_role('button', name='Tổng quan', exact=True).click()
    assert page.evaluate('document.documentElement.scrollWidth <= innerWidth')
    assert not errors, errors
    (ROOT / 'docs/browser-validation.json').write_text(json.dumps({'passed':True,'checks':['OIDC login','temperature quarantine','normal temperature retains hold','role gated release','authorized release','Escape dialog close','mobile no horizontal overflow'],'pageErrors':errors},ensure_ascii=False,indent=2))
    context.close()
    reviewer.close()
    browser.close()
    print('Browser smoke passed: cold chain, role enforcement, keyboard and mobile.')
