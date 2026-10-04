async page=>{
  await page.setViewportSize({width:1280,height:900});
  await page.reload();await page.waitForFunction(()=>window.villageWorld);
  await page.locator('#view-world').click();
  if(!await page.evaluate(()=>window.villageWorld.paused))await page.locator('#motion').click();
  const shots=[];
  for(const az of [45,135,225,315]){
    await page.evaluate(az=>window.villageWorld.orbitTo(az),az);
    await page.waitForTimeout(400);
    await page.screenshot({path:`audit-village-${az}.png`});
    shots.push(az);
  }
  const offices=[];
  for(const role of ['ARCHITECT','CODER','TESTER','MANAGER']){
    const target=await page.evaluate(role=>window.villageWorld.diagnostics().targets.find(t=>t.kind==='building'&&t.role===role),role);
    const canvas=await page.locator('#cv').boundingBox();
    await page.mouse.click(canvas.x+target.x,canvas.y+target.y);
    await page.waitForFunction(role=>window.villageWorld.diagnostics().view.role===role,role);
    await page.waitForFunction(()=>window.villageWorld.diagnostics().view.direction===0);
    await page.waitForTimeout(300);
    await page.screenshot({path:`audit-office-${role}.png`});
    offices.push(role);
    await page.locator('#exit-house').click();
    await page.waitForFunction(()=>window.villageWorld.diagnostics().view.role===null);
  }
  return {shots,offices};
}
