async page=>{
  await page.setViewportSize({width:1440,height:900});
  try{
  await page.reload();await page.waitForFunction(()=>window.villageWorld);
  await page.locator('#view-world').click();
  await page.locator('#browse').click();
  await page.waitForFunction(()=>document.querySelector('#folder-list').children.length>0);
  await page.locator('#folder-path').fill('/Users/azfardanish/.hermes/village');
  await page.locator('#folder-go').click();
  await page.waitForFunction(()=>document.querySelector('#folder-path').value==='/Users/azfardanish/.hermes/village');
  await page.locator('#folder-select').click();
  await page.locator('#engine').selectOption('hermes');
  await page.waitForFunction(()=>document.querySelector('#session').options.length>1);
  // Engine isolation: opencode and hermes lists share no ids.
  const lists=await page.evaluate(async()=>{
    const get=async engine=>(await(await fetch('/api/village/sessions?repo='+encodeURIComponent('/Users/azfardanish/.hermes/village')+'&engine='+engine)).json());
    return {opencode:await get('opencode'),hermes:await get('hermes')};
  });
  const ocIds=new Set(lists.opencode.sessions.map(s=>s.id)), heIds=new Set(lists.hermes.sessions.map(s=>s.id));
  if([...ocIds].some(id=>heIds.has(id)))throw Error('Session lists mixed across engines');
  if(!lists.hermes.sessions.length)throw Error('Expected real Hermes sessions for this repo');
  // Select a session: single place, visible active context.
  await page.locator('#engine').selectOption('hermes');
  await page.waitForFunction(()=>document.querySelector('#session').options.length>1);
  const target=lists.hermes.sessions[0].id;
  await page.locator('#session').selectOption(target);
  await page.waitForFunction(()=>document.querySelector('#active-role').textContent.includes('⧉'));
  // Switching engines resets the selection, never carries it.
  await page.locator('#engine').selectOption('opencode');
  await page.waitForFunction(()=>document.querySelector('#session').value===''&&!document.querySelector('#active-role').textContent.includes('⧉'));
  await page.locator('#engine').selectOption('hermes');
  await page.waitForFunction(()=>document.querySelector('#session').options.length>1);
  // New-session arming shows title fields; dispatch carries session payload.
  await page.locator('#session-new').click();
  if(!await page.locator('#session-title-fields').isVisible())throw Error('New-session title fields missing');
  let captured=null;
  await page.route('**/api/village/dispatch',route=>{captured=route.request().postDataJSON();return route.fulfill({status:400,body:'{"error":"intercepted"}'});});
  await page.locator('#session-title').fill('Browser check title');
  await page.locator('#message').fill('check payload');
  await page.locator('#send').click();
  await page.waitForFunction(()=>document.querySelector('#notice').textContent.length>0);
  if(!captured||captured.new_session!==true||captured.new_title!=='Browser check title')throw Error('Dispatch missed new-session payload: '+JSON.stringify(captured));
  await page.locator('#session').selectOption(target);
  await page.locator('#message').fill('check attach');
  await page.locator('#send').click();
  await page.waitForFunction(()=>document.querySelector('#notice').textContent.length>0);
  if(!captured||captured.session_id!==target||captured.new_session!==false)throw Error('Dispatch missed session attach: '+JSON.stringify(captured));
  await page.unroute('**/api/village/dispatch');
  // Delete is two-click with engine-side effect surfaced; rename explains the OpenCode gap.
  await page.locator('#session').selectOption(target);
  await page.locator('#session-delete').click();
  if(await page.locator('#session-delete').textContent()!=='Confirm delete?')throw Error('Delete confirm step missing');
  const rename=await page.evaluate(async()=>(await(await fetch('/api/village/sessions/rename',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({engine:'opencode',id:'ses_x',title:'y'})})).json()));
  if(!/serve/.test(rename.error||''))throw Error('OpenCode rename gap unexplained: '+JSON.stringify(rename));
  // Locked controls during a live run.
  await page.route('**/api/village/state?*',route=>route.fulfill({json:{repo:'x',project:'x',engine:'hermes',current_agent:'CODER',meeting:false,jobs:[{id:'live',role:'CODER',message:'m',status:'running',current_agent:'CODER',events:[]}],talks:[],memories:[]}}));
  await page.waitForFunction(()=>document.querySelector('#session').disabled);
  if(!await page.locator('#session-new').isDisabled())throw Error('Session controls not locked mid-run');
  await page.unroute('**/api/village/state?*');
  await page.locator('#view-world').click();
  return {engineIsolation:true,singlePicker:true,newArming:true,dispatchPayload:true,renameGap:true,runLock:true};
  }finally{await page.unroute('**/api/village/state?*');await page.unroute('**/api/village/dispatch');await page.reload();}
}
