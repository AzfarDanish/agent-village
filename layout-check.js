async page=>{
  let populated=false,tick=0;
  await page.route('**/api/village/state?*',route=>{
    const events=Array.from({length:100},(_,i)=>({id:'long-'+i,author:'CODER',kind:i%9===0?'tool_result':'message',text:('Line '+i+' — implementation output.\n').repeat(5)}));
    events.push({id:'tick-'+tick,author:'TESTER',kind:'status',text:'Checking '+tick});
    return route.fulfill({json:{repo:'/Users/azfardanish/.hermes/village',project:'layout check',engine:'opencode',current_agent:null,meeting:false,talks:[],memories:[],jobs:populated?[{id:'long',role:'CODER',message:'Check the session layout',status:'completed',events}]:[]}});
  });
  try{
    await page.setViewportSize({width:1440,height:900});await page.reload();await page.waitForFunction(()=>window.villageWorld);
    await page.waitForFunction(()=>document.querySelector('#models').children.length>0);
    if(!await page.locator('.empty-state').isVisible())throw Error('Missing empty state');
    const sizes=await page.evaluate(()=>{let main=document.querySelector('main').getBoundingClientRect(),aside=document.querySelector('aside').getBoundingClientRect(),world=document.querySelector('#stage').getBoundingClientRect();return{ratio:aside.width/main.width,worldRatio:world.width/world.height,header:document.querySelector('header').offsetHeight,conversation:document.querySelector('#conversation').clientHeight};});
    if(sizes.ratio<.45||sizes.ratio>.55||Math.abs(sizes.worldRatio-1)>.01||sizes.header>55||sizes.conversation<300)throw Error('Unbalanced layout '+JSON.stringify(sizes));
    if(await page.locator('.world-title').count())throw Error('Decorative overlay still present');
    await page.locator('#advanced>summary').click();await page.locator('#model-provider').selectOption('rapidscreen');await page.locator('#advanced>summary').click();
    populated=true;await page.waitForFunction(()=>document.querySelectorAll('#conversation .message').length>90);
    await page.locator('#conversation').evaluate(el=>el.scrollTop=0);
    await page.waitForTimeout(200);tick++;
    await page.waitForFunction(()=>document.querySelector('#conversation').textContent.includes('Checking 1'));
    if(await page.locator('#conversation').evaluate(el=>el.scrollTop)>30)throw Error('Stream forced scroll');
    await page.locator('#jump-latest').click();
    if(await page.locator('#conversation').evaluate(el=>el.scrollHeight-el.scrollTop-el.clientHeight)>10)throw Error('Jump failed');
    for(const width of [1100,900,768,390]){
      await page.setViewportSize({width,height:900});await page.waitForTimeout(200);
      const metrics=await page.evaluate(()=>({overflow:document.documentElement.scrollWidth>innerWidth,ratio:document.querySelector('#stage').clientWidth/document.querySelector('#stage').clientHeight}));
      if(metrics.overflow||Math.abs(metrics.ratio-1)>.01)throw Error('Responsive failure '+width+JSON.stringify(metrics));
    }
    await page.setViewportSize({width:1440,height:900});
    return {...sizes,streamScrollStable:true,providerFilter:true,responsive:true};
  }finally{await page.unroute('**/api/village/state?*');await page.reload();}
}
