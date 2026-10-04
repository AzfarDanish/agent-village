async page => {
  await page.setViewportSize({width:1440,height:960});
  await page.goto('http://127.0.0.1:8787');
  await page.waitForFunction(()=>window.villageWorld);
  const diagnostics=await page.evaluate(()=>window.villageWorld.diagnostics());
  if(diagnostics.characters!==4||diagnostics.buildings!==4)throw Error('3D models missing');
  await page.locator('#browse').click();
  await page.locator('#folder-path').fill('/Users/azfardanish/.hermes/village');
  await page.locator('#folder-go').click();
  await page.waitForFunction(()=>document.querySelector('#folder-path').value==='/Users/azfardanish/.hermes/village'&&document.querySelector('#folder-list').textContent.includes('web'));
  await page.locator('#folder-select').click();
  if(await page.locator('#repo').inputValue()!=='/Users/azfardanish/.hermes/village')throw Error('Folder selection failed');
  await page.locator('#engine').selectOption('hermes');
  await page.waitForFunction(()=>[...document.querySelector('#models').children].some(o=>o.value.startsWith('deepseek/')));
  if(await page.locator('#models option[value^="rapidscreen/"]').count())throw Error('Engine catalogs mixed');
  await page.locator('#engine').selectOption('llm');
  if(!await page.locator('#custom-fields').isVisible())throw Error('Custom endpoint missing');
  await page.locator('#engine').selectOption('opencode');
  await page.locator('.agent-button[data-role="TESTER"]').click();
  if(await page.locator('#role').inputValue()!=='TESTER')throw Error('Role selection failed');
  await page.locator('#motion').click();
  await page.locator('#night').click();
  await page.locator('#reset-camera').click();
  // Exercise state polling with distinct new messages, then measure real DOM boxes.
  let count=0;
  await page.route('**/api/village/state?*',async route=>{
    count++;
    await route.fulfill({json:{repo:'/Users/azfardanish/.hermes/village',project:'Browser fixture',engine:'opencode',status:'running',current_agent:'MANAGER',meeting:true,talks:[],memories:[],jobs:[{id:'fixture',role:'TEAM',message:'Fixture task',status:'running',current_agent:'MANAGER',events:[{id:'fixture-'+count+'a',author:'ARCHITECT',kind:'message',text:'A longer architectural message for spacing and leader-line verification.'},{id:'fixture-'+count+'b',author:'MANAGER',kind:'message',text:'Reviewing acceptance criteria together in the town square.'}]}]}});
  });
  await page.waitForFunction(()=>document.querySelectorAll('.bubble').length===2);
  const boxes=await page.locator('.bubble').evaluateAll(elements=>elements.map(e=>{const r=e.getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height,opacity:getComputedStyle(e).opacity};}));
  const [a,b]=boxes;
  if(a.x<b.x+b.w&&a.x+a.w>b.x&&a.y<b.y+b.h&&a.y+a.h>b.y)throw Error('Speech bubbles overlap');
  if(boxes.some(b=>b.opacity==='0'))throw Error('Expected visible bubbles');
  await page.screenshot({path:'village-3d-verified.png'});
  await page.setViewportSize({width:390,height:844});
  await page.waitForTimeout(300);
  const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth);
  if(overflow)throw Error('Mobile horizontal overflow');
  await page.unroute('**/api/village/state?*');
  await page.setViewportSize({width:1440,height:960});
  await page.reload();
  return {diagnostics,bubbleBoxes:boxes,folderSelection:true,engineIsolation:true,customEndpoint:true,roleSelection:true,mobileOverflow:false};
}
