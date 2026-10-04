async page=>{
  await page.setViewportSize({width:1280,height:900});
  try{
  await page.reload();await page.waitForFunction(()=>window.villageWorld);
  await page.locator('#view-world').click();
  if(await page.evaluate(()=>window.villageWorld.paused))await page.locator('#motion').click();
  let active=null;
  await page.route('**/api/village/state?*',route=>route.fulfill({json:{repo:'x',project:'x',engine:'opencode',current_agent:active,meeting:false,jobs:[],talks:[],memories:[]}}));
  const coder=()=>page.evaluate(()=>window.villageWorld.diagnostics().charactersState[1]);
  const door=()=>page.evaluate(()=>window.villageWorld.diagnostics().houses[1].door);
  // 1. Entry: walk, door opens, inside, door closes, outdoor hidden.
  active='CODER';
  await page.waitForFunction(()=>window.villageWorld.diagnostics().charactersState[1].phase==='approaching');
  await page.waitForFunction(()=>window.villageWorld.diagnostics().houses[1].door>.2,{},{timeout:25000});
  await page.waitForFunction(()=>window.villageWorld.diagnostics().charactersState[1].phase==='inside',{},{timeout:15000});
  await page.waitForFunction(()=>window.villageWorld.diagnostics().houses[1].door<.05);
  if(await page.evaluate(()=>window.villageWorld.diagnostics().charactersState[1].visible))throw Error('Outdoor character visible while inside');
  // 2. Completion exit: door opens from inside, steps out, returns, door closes.
  active=null;
  await page.waitForFunction(()=>window.villageWorld.diagnostics().houses[1].door>.2,{},{timeout:10000});
  await page.waitForFunction(()=>window.villageWorld.diagnostics().charactersState[1].phase==='outside',{},{timeout:10000});
  await page.waitForFunction(()=>window.villageWorld.diagnostics().houses[1].door<.05);
  if(!await page.evaluate(()=>window.villageWorld.diagnostics().charactersState[1].visible))throw Error('Character missing after exit');
  // 3. Cancel mid-approach: no stuck door, no frozen mid-step.
  active='CODER';
  await page.waitForFunction(()=>window.villageWorld.diagnostics().charactersState[1].phase==='approaching');
  active=null;
  await page.waitForFunction(()=>window.villageWorld.diagnostics().charactersState[1].phase==='outside',{},{timeout:10000});
  await page.waitForFunction(()=>window.villageWorld.diagnostics().houses[1].door<.05);
  // 4. TEAM handoff: ARCHITECT exits as CODER enters; only the worker is inside.
  active='ARCHITECT';
  await page.waitForFunction(()=>window.villageWorld.diagnostics().charactersState[0].phase==='inside',{},{timeout:30000});
  active='CODER';
  await page.waitForFunction(()=>window.villageWorld.diagnostics().charactersState[0].phase==='outside',{},{timeout:15000});
  await page.waitForFunction(()=>window.villageWorld.diagnostics().charactersState[1].phase==='inside',{},{timeout:25000});
  const phases=await page.evaluate(()=>window.villageWorld.diagnostics().charactersState.map(v=>v.phase));
  if(phases[0]!=='outside'||phases[1]!=='inside')throw Error('Handoff inconsistent: '+JSON.stringify(phases));
  active=null;
  await page.waitForFunction(()=>window.villageWorld.diagnostics().charactersState[1].phase==='outside',{},{timeout:15000});
  await page.waitForFunction(()=>window.villageWorld.diagnostics().houses[1].door<.05&&window.villageWorld.diagnostics().houses[0].door<.05);
  return {entryExit:true,cancelClean:true,handoff:true,doorsClosed:true};
  }finally{await page.unroute('**/api/village/state?*');await page.reload();}
}
