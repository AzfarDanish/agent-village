async page=>{
  let populated=false,tick=0;
  await page.route('**/api/village/state?*',route=>{
    const events=Array.from({length:60},(_,i)=>({id:'long-'+i,author:'CODER',kind:i%9===0?'tool_result':'message',text:('Line '+i+' — implementation output.\n').repeat(5)}));
    events.push({id:'tick-'+tick,author:'TESTER',kind:'status',text:'Checking '+tick});
    return route.fulfill({json:{repo:'/Users/azfardanish/.hermes/village',project:'layout check',engine:'opencode',current_agent:null,meeting:false,talks:[],memories:[],jobs:populated?[{id:'long',role:'CODER',message:'Check the session layout',status:'completed',events}]:[]}});
  });
  try{
    await page.setViewportSize({width:1440,height:900});await page.reload();await page.waitForFunction(()=>window.villageWorld);
    await page.waitForFunction(()=>document.querySelector('#models').children.length>0);
    await page.locator('#view-world').click();
    const aside=await page.locator('aside').boundingBox();
    if(aside.width<280||aside.width>360)throw Error('Sidebar not narrow/fixed: '+aside.width);
    if(!await page.locator('#stage').isVisible()||await page.locator('#sheet').isVisible())throw Error('World not default view');
    await page.locator('#view-chat').click();
    if(!await page.locator('.empty-state').isVisible())throw Error('Missing empty state');
    await page.locator('#view-world').click();
    // Switch to conversation: single instance moves to the sheet, sidebar keeps controls only.
    await page.locator('#view-chat').click();
    await page.waitForFunction(()=>!document.querySelector('#stage').offsetParent&&!document.querySelector('#sheet').hidden);
    const locations=await page.evaluate(()=>({inSheet:!!document.querySelector('#sheet-slot #conversation'),count:document.querySelectorAll('#conversation').length,digest:!!document.querySelector('#side-digest')}));
    if(!locations.inSheet||locations.count!==1||!locations.digest)throw Error('Conversation misplaced or digest missing: '+JSON.stringify(locations));
    if(await page.locator('#task-form').isVisible()===false)throw Error('Sidebar controls missing in chat mode');
    await page.locator('#view-world').click();
    await page.waitForFunction(()=>!!document.querySelector('#stage').offsetParent);
    const back=await page.evaluate(()=>({single:document.querySelectorAll('#conversation').length===1,digest:document.querySelector('#digest-text').textContent.length>0}));
    if(!back.single||!back.digest)throw Error('Return to world failed');
    // Long stream stays stable and scannable.
    await page.locator('#view-chat').click();
    populated=true;await page.waitForFunction(()=>document.querySelectorAll('#conversation .tline').length>50);
    await page.locator('#conversation').evaluate(el=>el.scrollTop=0);
    await page.waitForTimeout(200);tick++;
    await page.waitForFunction(()=>document.querySelector('#conversation').textContent.includes('Checking 1'));
    if(await page.locator('#conversation').evaluate(el=>el.scrollTop)>30)throw Error('Stream forced scroll');
    await page.locator('#jump-latest').click();
    if(await page.locator('#conversation').evaluate(el=>el.scrollHeight-el.scrollTop-el.clientHeight)>10)throw Error('Jump failed');
    for(const width of [1100,900,768,390]){
      await page.setViewportSize({width,height:900});await page.waitForTimeout(250);
      const metrics=await page.evaluate(()=>({overflow:document.documentElement.scrollWidth>innerWidth,stageRatio:document.querySelector('#stage').clientWidth/Math.max(1,document.querySelector('#stage').clientHeight)}));
      if(metrics.overflow)throw Error('Responsive overflow at '+width);
    }
    await page.setViewportSize({width:1440,height:900});
    await page.locator('#view-world').click();
    return {sidebar:aside.width,singleViewToggle:true,noDuplicateThread:true,responsive:true};
  }finally{await page.unroute('**/api/village/state?*');await page.reload();}
}
