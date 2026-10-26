import { test, expect } from '@playwright/test';
import { OrthographicCamera, Vector3 } from 'three';
test.beforeEach(async ({page}) => {
 await page.emulateMedia({reducedMotion:'reduce'});
 await page.goto('/');
 await page.getByRole('button',{name:'Tạm dừng mô phỏng'}).click();
 await expect(page.getByTestId('warehouse-scene')).toHaveAttribute('data-ready','true',{timeout:30000});
});
test('map opens uncluttered; five sites and every entity are accessible on demand',async({page})=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await expect(page.locator('.inspector,.fleet-board,.shipment-tracking')).toHaveCount(0);
 await expect(page.locator('.metric')).toHaveCount(0);
 await page.getByRole('button',{name:'Chỉ số vận hành',exact:true}).click();
 await expect(page.locator('.metric')).toHaveCount(3);
 await page.getByRole('button',{name:'Chỉ số vận hành',exact:true}).click();
 await expect(page.getByLabel('Địa điểm kho').locator('option')).toHaveCount(5);
 const bar=(await page.locator('.topbar').boundingBox())!;
 expect(bar.width).toBeLessThan(600);expect(bar.height).toBeLessThanOrEqual(60);
 await page.screenshot({path:'docs/rebuild-desktop.png',fullPage:true});
 for(const [id,title]of [['sgn','Bến Sông Hub'],['han','Bắc Thành DC'],['dad','Đông Hải Cold Store'],['bdg','Nam Bình Cross-Dock'],['hph','Tây Cảng Robotics']]){
  await page.getByLabel('Địa điểm kho').selectOption(id);
  if(await page.locator('.inspector').count()===0)await page.getByRole('button',{name:'Thông tin kho',exact:true}).click();
  await expect(page.getByTestId('object-title')).toHaveText(title);
 }
 await page.getByLabel('Địa điểm kho').selectOption('sgn');await page.getByRole('button',{name:'Thông tin kho',exact:true}).click();
 for(const [value,title]of [['forklift:sgn-f1','FL-01'],['pallet:sgn-p1','Thùng carton (M)'],['charger:sgn-c3','C3'],['dock:sgn-d1','Bay 1'],['truck:sgn-t2','TRK-2068']]){
  await page.getByLabel('Chọn đối tượng trong kho').selectOption(value);await expect(page.getByTestId('object-title')).toHaveText(title);
 }
 await page.getByRole('button',{name:'Hành trình lô hàng',exact:true}).click();
 await expect(page.locator('.inspector')).toHaveCount(0);
 await expect(page.locator('.timeline-step')).toHaveCount(5);
 await expect(page.locator('.shipment-card')).toContainText('SHP-78443');
 await expect(page.locator('.shipment-tracking')).toContainText('Dỡ hàng');
 expect(errors).toEqual([]);
});
test('fleet and global search share selection and keyboard shortcuts',async({page})=>{
 await page.getByRole('button',{name:'Đội vận hành',exact:true}).click();
 await page.getByRole('tab',{name:/Xe tải/}).click();
 await page.locator('.fleet-row').filter({hasText:'TRK-2085'}).click();
 await expect(page.getByTestId('object-title')).toHaveText('TRK-2085');
 await expect(page.locator('.fleet-board')).toHaveCount(0);
 await page.keyboard.press('/');
 await expect(page.getByLabel('Tìm kho, xe, pallet, lô hàng')).toBeFocused();
 await page.getByLabel('Tìm kho, xe, pallet, lô hàng').fill('TRK-2085');
 await page.locator('.search-results button').filter({hasText:'TRK-2085'}).click();
 await expect(page.getByTestId('object-title')).toHaveText('TRK-2085');
 await page.keyboard.press('Escape');await expect(page.getByTestId('object-title')).toHaveCount(0);
 await page.keyboard.press('/');await page.getByLabel('Tìm kho, xe, pallet, lô hàng').fill('TRK-2251');
 await page.keyboard.press('Enter');await expect(page.getByTestId('object-title')).toHaveText('TRK-2251');
 await expect(page.getByLabel('Địa điểm kho')).toHaveValue('dad');
 await page.keyboard.press('/');await page.getByLabel('Tìm kho, xe, pallet, lô hàng').fill('NO-MATCH');
 await expect(page.locator('.search-results')).toContainText('Không tìm thấy');await page.keyboard.press('Escape');
 await expect(page.getByTestId('object-title')).toHaveText('TRK-2251');
});
test('raycast selection, camera controls and simulation clock',async({page})=>{
 const box=(await page.locator('canvas').boundingBox())!;
 const camera=new OrthographicCamera(-box.width/2,box.width/2,box.height/2,-box.height/2,.1,800);
 camera.position.set(38,31,43);camera.lookAt(0,0,1);
 camera.zoom=Math.min((box.width-160)/48,box.height/34);
 camera.setViewOffset(box.width,box.height,0,-15,box.width,box.height);camera.updateProjectionMatrix();camera.updateMatrixWorld();
 await page.evaluate(()=>new Promise<void>(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>resolve()))));
 const point=new Vector3(-8.25,1.6,4.5).project(camera);
 await page.mouse.click(box.x+(point.x+1)*box.width/2,box.y+(1-point.y)*box.height/2);
 await expect(page.getByTestId('object-title')).toHaveText('TRK-2051');
 for(const label of ['Phóng to','Thu nhỏ','Xoay trái','Xoay phải','Đặt lại góc nhìn'])await page.getByRole('button',{name:label,exact:true}).click();
 const clock=await page.locator('.live-clock b').textContent();
 await page.waitForTimeout(300);await expect(page.locator('.live-clock b')).toHaveText(clock!);
 await page.getByRole('button',{name:'Cài đặt hiển thị',exact:true}).click();
 await page.getByLabel('Tốc độ mô phỏng').selectOption('24');
 await page.getByRole('button',{name:'Cài đặt hiển thị',exact:true}).click();await page.getByRole('button',{name:'Tiếp tục mô phỏng'}).click();
 await expect.poll(()=>page.locator('.live-clock b').textContent(),{timeout:15000}).not.toBe(clock);
});
test('data exports and dialogs preserve keyboard focus',async({page})=>{
 await page.getByRole('button',{name:'Cài đặt hiển thị',exact:true}).click();
 await page.getByRole('button',{name:'Tồn kho',exact:true}).click();
 await page.getByLabel('Tìm trong danh sách').fill('SKU-1000');await expect(page.locator('tbody tr')).toHaveCount(1);await page.keyboard.press('Escape');
 await expect(page.getByRole('button',{name:'Cài đặt hiển thị',exact:true})).toBeFocused();
 await page.getByRole('button',{name:'Cài đặt hiển thị',exact:true}).click();
 await page.getByRole('button',{name:'Lô hàng',exact:true}).click();
 const download=page.waitForEvent('download');await page.getByRole('button',{name:'Xuất CSV'}).click();
 expect((await download).suggestedFilename()).toBe('waretrack-shipments.csv');await page.keyboard.press('Escape');
 await page.getByRole('button',{name:'Cài đặt hiển thị',exact:true}).click();
 await page.getByRole('button',{name:'Hướng dẫn',exact:true}).click();
 await expect(page.getByRole('button',{name:'Đóng hướng dẫn'})).toBeFocused();
 await page.keyboard.press('Shift+Tab');
 await expect(page.getByRole('button',{name:'Bắt đầu khám phá'})).toBeFocused();await page.keyboard.press('Escape');
 await expect(page.getByRole('button',{name:'Hướng dẫn',exact:true})).toBeFocused();
});
for(const width of [390,768,1920])test('responsive map '+width,async({page})=>{
 await page.setViewportSize({width,height:width===1920?1080:900});
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 expect(await page.evaluate(()=>document.documentElement.scrollHeight<=innerHeight)).toBe(true);
 await page.screenshot({path:'docs/rebuild-'+width+'.png',fullPage:true});
 await page.getByRole('button',{name:'Tìm kiếm',exact:true}).click();
 await expect(page.getByLabel('Tìm kho, xe, pallet, lô hàng')).toBeFocused();
 await page.keyboard.press('Escape');
 await page.getByRole('button',{name:'Đội vận hành',exact:true}).click();
 await page.getByRole('tab',{name:/Xe nâng/}).click();await page.locator('.fleet-row').filter({hasText:'FL-03'}).click();
 await expect(page.getByTestId('object-title')).toHaveText('FL-03');
 await page.getByLabel('Chọn đối tượng trong kho').selectOption('charger:sgn-c3');await expect(page.getByTestId('object-title')).toHaveText('C3');
 await page.screenshot({path:'docs/rebuild-detail-'+width+'.png',fullPage:true});
});

test('compact controls keep search, settings and map mutually usable',async({page})=>{
 await page.getByRole('button',{name:'Tìm kiếm',exact:true}).click();
 await expect(page.getByLabel('Tìm kho, xe, pallet, lô hàng')).toBeFocused();
 await page.keyboard.press('Escape');
 await expect(page.getByLabel('Tìm kho, xe, pallet, lô hàng')).toHaveCount(0);
 await expect(page.getByRole('button',{name:'Tìm kiếm',exact:true})).toBeFocused();
 await page.getByRole('button',{name:'Chỉ số vận hành',exact:true}).click();
 await expect(page.locator('.metric')).toHaveCount(3);
 await page.getByRole('button',{name:'Đội vận hành',exact:true}).click();
 await expect(page.locator('.metric')).toHaveCount(0);
 await page.keyboard.press('Escape');await expect(page.locator('.fleet-board')).toHaveCount(0);
 await page.getByRole('button',{name:'Trong kho',exact:true}).click();
 await expect(page.getByRole('button',{name:'Trong kho',exact:true})).toHaveAttribute('aria-pressed','true');
 await page.getByRole('button',{name:'Trong kho',exact:true}).click();
 await page.getByRole('button',{name:'Cài đặt hiển thị',exact:true}).click();
 await page.getByLabel('Nhãn bản đồ').uncheck();await expect(page.getByLabel('Nhãn bản đồ')).not.toBeChecked();
 await page.getByLabel('Chất lượng đồ họa').selectOption('low');
 await page.keyboard.press('Escape');await expect(page.locator('.settings-popover')).toHaveCount(0);
});

test('vehicle animation stays continuous and freezes exactly when paused',async({page})=>{
 await page.getByRole('button',{name:'Tiếp tục mô phỏng'}).click();
 const motion=await page.evaluate(async()=>{
  const {_roots}=await import('/node_modules/.vite/deps/@react-three_fiber.js');
  const root=[..._roots.values()][0].store.getState();
  const model=root.scene.getObjectByName('sgn-t3');
  const samples:{x:number;z:number;heading:number;time:number}[]=[];
  await new Promise<void>(resolve=>{
   const frame=()=>{samples.push({x:model.position.x,z:model.position.z,heading:model.rotation.y,time:performance.now()});if(samples.length<45)requestAnimationFrame(frame);else resolve();};
   requestAnimationFrame(frame);
  });
  let maxSpeed=0;
  for(let i=1;i<samples.length;i++){
   const a=samples[i-1],b=samples[i];maxSpeed=Math.max(maxSpeed,Math.hypot(b.x-a.x,b.z-a.z)/Math.max(.001,(b.time-a.time)/1000));
  }
  return {distance:Math.hypot(samples.at(-1)!.x-samples[0].x,samples.at(-1)!.z-samples[0].z),maxSpeed,bodyType:model.children.find((child:{isMesh?:boolean})=>child.isMesh)?.type};
 });
 expect(motion.distance).toBeGreaterThan(.5);expect(motion.maxSpeed).toBeLessThan(30);expect(motion.bodyType).toBe('Mesh');
 await page.getByRole('button',{name:'Tạm dừng mô phỏng'}).click();
 const pause=await page.evaluate(async()=>{
  const {_roots}=await import('/node_modules/.vite/deps/@react-three_fiber.js');
  const root=[..._roots.values()][0].store.getState();
  const models=['sgn-t3','sgn-f1'].map(id=>root.scene.getObjectByName(id));
  const before=models.map(model=>[...model.position.toArray(),model.rotation.y]);
  await new Promise<void>(resolve=>{let n=0;const frame=()=>{if(++n===20)resolve();else requestAnimationFrame(frame);};requestAnimationFrame(frame);});
  return {before,after:models.map(model=>[...model.position.toArray(),model.rotation.y])};
 });
 expect(pause.after).toEqual(pause.before);
});
