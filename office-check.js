async page => {
  await page.setViewportSize({width:1440,height:960});
  let active=null;
  await page.route('**/api/village/state?*',route=>route.fulfill({json:{repo:'/Users/azfardanish/.hermes/village',project:'Office check',engine:'opencode',current_agent:active,meeting:false,jobs:[],talks:[],memories:[],warning:''}}));
  try {
    await page.reload();await page.waitForFunction(()=>window.villageWorld);
    await page.locator('#view-world').click();
    if(!await page.evaluate(()=>window.villageWorld.paused))await page.locator('#motion').click();
    const base=await page.evaluate(()=>window.villageWorld.diagnostics().view.camera);
    const canvas=await page.locator('#cv').boundingBox();
    async function clickHouse(role){
      const target=await page.evaluate(role=>window.villageWorld.diagnostics().targets.find(t=>t.kind==='building'&&t.role===role),role);
      await page.mouse.click(canvas.x+target.x,canvas.y+target.y);
    }
    const offices=[];
    for(const role of ['ARCHITECT','CODER','TESTER','MANAGER']){
      await clickHouse(role);
      await page.waitForFunction(role=>window.villageWorld.diagnostics().view.role===role,role);
      await page.waitForFunction(()=>window.villageWorld.diagnostics().view.direction===0);
      const d=await page.evaluate(()=>window.villageWorld.diagnostics());
      if(d.houses.some(h=>h.structureSize[0]>2.6||h.structureSize[2]>2.6))throw Error('House frame bounds include yard or inflated geometry');
      if(d.office.walls!==2)throw Error('Office must have two walls');
      for(const item of ['table','laptop','computer','printer','wall picture','pencil','lamp','books'])if(!d.office.furniture.includes(item))throw Error('Missing '+item);
      await page.mouse.move(canvas.x+canvas.width/2,canvas.y+canvas.height/2);
      if(await page.evaluate(()=>window.villageWorld.diagnostics().outlineVisible))throw Error('Interior hover frame enabled');
      offices.push(d.office.name);
      await page.locator('#exit-house').click();
      await page.waitForFunction(()=>window.villageWorld.diagnostics().view.role===null);
      const restored=await page.evaluate(()=>window.villageWorld.diagnostics().view.camera);
      if(restored.some((v,i)=>Math.abs(v-base[i])>.001))throw Error('Camera not restored');
    }
    // Reverse an entrance before it settles.
    await clickHouse('CODER');await page.locator('#exit-house').click();
    await page.waitForFunction(()=>window.villageWorld.diagnostics().view.role===null);
    await page.locator('#motion').click();active='CODER';
    await page.waitForFunction(()=>window.villageWorld.diagnostics().charactersState.find(v=>v.role==='CODER').phase==='approaching');
    await page.waitForFunction(()=>window.villageWorld.diagnostics().houses[1].door>.2,{},{timeout:25000});
    await page.waitForFunction(()=>window.villageWorld.diagnostics().charactersState[1].phase==='inside',{},{timeout:10000});
    await page.waitForFunction(()=>window.villageWorld.diagnostics().houses[1].door<.05);
    await clickHouse('CODER');await page.waitForFunction(()=>window.villageWorld.diagnostics().office?.occupant===true);
    if(await page.evaluate(()=>window.villageWorld.diagnostics().charactersState[1].visible))throw Error('Duplicate outdoor character');
    active=null;
    await page.waitForFunction(()=>window.villageWorld.diagnostics().charactersState[1].phase==='outside',{},{timeout:10000});
    await page.waitForFunction(()=>!window.villageWorld.diagnostics().office.occupant);
    await page.locator('#exit-house').click();await page.waitForFunction(()=>window.villageWorld.diagnostics().view.role===null);
    // Reduced motion enters without travel; hover still stays off.
    await page.emulateMedia({reducedMotion:'reduce'});await clickHouse('ARCHITECT');
    await page.waitForFunction(()=>window.villageWorld.diagnostics().view.progress===1);
    await page.locator('#exit-house').click();await page.waitForFunction(()=>window.villageWorld.diagnostics().view.role===null);
    await page.emulateMedia({reducedMotion:'no-preference'});
    return {offices,furniture:true,twoWalls:true,doorEntryExit:true,insideWorker:true,reverseCamera:true,reducedMotion:true};
  } finally {await page.unroute('**/api/village/state?*');await page.reload();}
}
