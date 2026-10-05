async page=>{
  await page.setViewportSize({width:1440,height:900});
  try{
  await page.reload();await page.waitForFunction(()=>window.villageWorld);
  const long='word '.repeat(120);
  const events=[
    {id:'u1',author:'YOU · CODER',kind:'user',text:'Refactor the auth module'},
    {id:'m1',author:'CODER',kind:'message',text:'Starting the refactor now. '+long},
    {id:'t1',author:'CODER',kind:'tool',text:'read src/auth.ts'},
    {id:'r1',author:'CODER',kind:'tool_result',text:'line1\nline2\nline3'},
    {id:'s1',author:'CODER',kind:'status',text:'Coder started'},
    {id:'e1',author:'CODER',kind:'error',text:'provider exploded: boom'},
  ];
  await page.route('**/api/village/state?*',route=>route.fulfill({json:{repo:'x',project:'termcheck',engine:'opencode',current_agent:'CODER',meeting:false,jobs:[{id:'j1',role:'CODER',message:'Refactor the auth module',status:'running',current_agent:'CODER',events}],talks:[],memories:[]}}));
  await page.locator('#view-chat').click();
  await page.waitForFunction(()=>document.querySelectorAll('#conversation .tline').length>=6);
  const d=await page.evaluate(()=>{
    const lines=[...document.querySelectorAll('#conversation .tline')];
    const kinds=lines.map(l=>l.className);
    const pfx=lines.map(l=>l.querySelector('.pfx')?.textContent);
    const noBubbles=!document.querySelector('#conversation .message:not(.tline)');
    const indentOk=lines.every(l=>{const p=l.querySelector('.pfx'),b=l.querySelector('.tbody');if(!p||!b)return l.tagName==='SUMMARY';const pr=p.getBoundingClientRect(),br=b.getBoundingClientRect();return Math.abs(pr.top-br.top)<4&&br.left>pr.left;});
    const fonts=new Set(lines.map(l=>getComputedStyle(l).fontFamily));
    const mono=[...fonts].every(f=>/Mono|Menlo|Consolas|monospace/.test(f));
    const bg=new Set(lines.map(l=>getComputedStyle(l).backgroundColor));
    return {kinds,pfx,noBubbles,indentOk,mono,transparent:[...bg]};
  });
  if(!d.noBubbles)throw Error('Chat-bubble markup still present');
  if(!d.mono)throw Error('Non-monospace transcript');
  if(!d.indentOk)throw Error('Prefix/body alignment broken');
  const joined=d.pfx.join('|');
  for(const need of ['you $','coder >','[tool]','!','·'])if(!joined.includes(need))throw Error('Missing prefix '+need+': '+joined);
  if(!d.transparent.every(c=>c==='rgba(0, 0, 0, 0)'||c==='transparent'))throw Error('Background fills on lines: '+JSON.stringify(d.transparent));
  const title=await page.locator('#sheet-status').textContent();
  if(!/opencode — .+ — termcheck/.test(title))throw Error('Bad terminal title: '+title);
  if(!await page.evaluate(()=>!!document.querySelector('#conversation .cursor')))throw Error('Missing streaming cursor');
  await page.unroute('**/api/village/state?*');
  await page.route('**/api/village/state?*',route=>route.fulfill({json:{repo:'x',project:'termcheck',engine:'opencode',current_agent:null,meeting:false,jobs:[{id:'j1',role:'CODER',message:'Refactor the auth module',status:'completed',current_agent:'CODER',events}],talks:[],memories:[]}}));
  await page.waitForFunction(()=>!document.querySelector('#prompt-form #send').disabled);
  // Filter narrows to matches; toolbar copy/clear work.
  await page.locator('#term-filter').fill('exploded');
  const visible=await page.locator('#conversation .tline:visible').count();
  if(visible!==1)throw Error('Filter failed, visible='+visible);
  await page.locator('#term-filter').fill('');
  await page.locator('#term-copy').click();
  await page.waitForFunction(()=>document.querySelector('#term-copy').textContent==='copied');
  await page.locator('#term-clear').click();
  if(await page.locator('#conversation .tline:visible').count()!==0)throw Error('Clear failed');
  // Prompt row dispatches from the sheet; single input only.
  if(await page.locator('aside #message').count()!==0)throw Error('Second input in sidebar');
  let captured=null;
  await page.route('**/api/village/dispatch',route=>{captured=route.request().postDataJSON();return route.fulfill({status:400,body:'{"error":"intercepted"}'});});
  await page.locator('#prompt-form #message').fill('terminal task');
  await page.locator('#prompt-form #send').click();
  await page.waitForFunction(()=>document.querySelector('#notice').textContent.length>0);
  if(!captured||captured.message!=='terminal task')throw Error('Prompt row dispatch broken');
  await page.unroute('**/api/village/dispatch');
  return {prefixes:true,mono:true,indent:true,title:true,cursor:true,filter:true,copy:true,clear:true,singleInput:true};
  }finally{await page.unroute('**/api/village/state?*');await page.unroute('**/api/village/dispatch');await page.reload();}
}
