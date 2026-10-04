const $ = id => document.getElementById(id);
const roles = ['ARCHITECT','CODER','TESTER','MANAGER'];
const colors = ['#688fae','#cf925c','#a17da2','#719568'];
const saved = key => {try{return localStorage.getItem('village-'+key)||'';}catch{return '';}};
const save = (key,value) => {try{localStorage.setItem('village-'+key,value);}catch{/* private browser */}};
let world, snapshot, catalog=[], scope=0, lastJob=null, activeJob=null, conversationKey='', selectedRole='CODER';
let folderPath='', folderParent='', bubbles=[], seen=new Set(), firstPoll=true;
const emptyConversation=$('conversation').firstElementChild.cloneNode(true);
const renderedMessages=new Map();let followingOutput=true;
function resetConversation(){renderedMessages.clear();$('conversation').replaceChildren(emptyConversation.cloneNode(true));followingOutput=true;$('jump-latest').hidden=true;}
function jumpLatest(){const el=$('conversation');el.scrollTop=el.scrollHeight;followingOutput=true;$('jump-latest').hidden=true;}
$('jump-latest').onclick=jumpLatest;
$('conversation').addEventListener('scroll',()=>{const el=$('conversation');followingOutput=el.scrollHeight-el.scrollTop-el.clientHeight<65;$('jump-latest').hidden=followingOutput||!renderedMessages.size;},{passive:true});
let mainView='world';
try{if(localStorage.getItem('village-view')==='chat')mainView='chat';}catch{/* private browser */}
function setView(view){
  mainView=view;save('view',view);
  const chat=view==='chat';
  $('view-world').classList.toggle('active',!chat);$('view-chat').classList.toggle('active',chat);
  $('view-world').setAttribute('aria-selected',String(!chat));$('view-chat').setAttribute('aria-selected',String(chat));
  $('stage').hidden=chat;$('sheet').hidden=!chat;
  $(chat?'sheet-slot':'side-slot').append(document.querySelector('.conversation-wrap'));
  $('side-note').hidden=!chat;
  if(chat&&world&&typeof world.exitOffice==='function')world.exitOffice();
  requestAnimationFrame(()=>window.dispatchEvent(new Event('resize')));
}
$('view-world').onclick=()=>setView('world');$('view-chat').onclick=()=>setView('chat');$('sheet-back').onclick=()=>setView('world');
$('engine').value=['opencode','hermes','llm'].includes(saved('engine'))?saved('engine'):'opencode';
async function api(path, body){
  const response=await fetch('/api/village/'+path,body?{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}:{});
  const data=await response.json();if(!response.ok)throw new Error(data.error||'Request failed');return data;
}
const params = () => new URLSearchParams({repo:$('repo').value,engine:$('engine').value}).toString();
function notice(text){$('notice').textContent=text;}
function node(tag,text,cls){const e=document.createElement(tag);if(text)e.textContent=text;if(cls)e.className=cls;return e;}
function displayError(text){
  if(text.includes("free tier can only be used from within OpenCode"))return 'OpenCode’s provider rejected this free-tier request (HTTP 403). Choose a different model provider, such as RapidScreen or OpenRouter, with valid credentials. The village cannot override this provider restriction.';
  return text;
}
function card(author,text,kind='message'){
  const role=roles.indexOf(author),isTool=['tool','tool_result'].includes(kind);
  const e=node(isTool?'details':'div','', 'message '+kind);
  if(role>=0)e.style.setProperty('--speaker',colors[role]);
  if(isTool){e.append(node('summary',`${kind==='tool'?'⚙':'↳'} ${author} · ${text.split('\n')[0].slice(0,120)}`),node('pre',text));}
  else e.append(node('b',`${kind==='error'?'! ':kind==='status'?'· ':''}${author}`),document.createTextNode(kind==='error'?displayError(text):text));
  return e;
}
function renderConversation(jobs){
  if(!jobs.length){if(renderedMessages.size)resetConversation();return;}
  $('conversation').querySelector('.empty-state')?.remove();
  const keep=new Set(),fragment=document.createDocumentFragment();
  function upsert(id,author,text,kind){keep.add(id);const signature=author+'\0'+kind+'\0'+text,old=renderedMessages.get(id);if(old?.signature===signature)return;const el=card(author,text,kind);if(old){if(old.el.open)el.open=true;old.el.replaceWith(el);}else fragment.append(el);renderedMessages.set(id,{el,signature});}
  for(const job of jobs){upsert(job.id+'-prompt','YOU · '+job.role,job.message,'user');for(const e of job.events)upsert(e.id,e.author,e.text,e.kind);if(job.error&&!job.events.some(e=>e.kind==='error'))upsert(job.id+'-error','ERROR',job.error,'error');}
  for(const [id,item] of renderedMessages){if(!keep.has(id)){item.el.remove();renderedMessages.delete(id);}}
  $('conversation').append(fragment);if(followingOutput)jumpLatest();else $('jump-latest').hidden=false;
}
function selectRole(role){selectedRole=role;$('role').value=role;$('pTitle').textContent=role[0]+role.slice(1).toLowerCase()+"’s workspace";$('pBody').textContent={ARCHITECT:'Blueprints, requirements and acceptance criteria.',CODER:'Implementation, tools and building things that work.',TESTER:'Independent checks, reproduction steps and test evidence.',MANAGER:'Review, decisions and the next steps for the team.'}[role];document.querySelectorAll('.agent-button').forEach(b=>b.classList.toggle('active',b.dataset.role===role));$('artifact').value={ARCHITECT:'plan',CODER:'report',TESTER:'test_report',MANAGER:'review'}[role];}
roles.forEach((role,i)=>{const b=node('button','', 'agent-button');b.dataset.role=role;b.style.setProperty('--role',colors[i]);b.append(node('i'),document.createTextNode(role[0]+role.slice(1).toLowerCase()));b.onclick=()=>selectRole(role);$('agent-bar').append(b);});
selectRole('CODER');

function clearBubbles(){bubbles.forEach(b=>{b.el.remove();b.line.remove();});bubbles=[];seen.clear();}
function addBubble(e){
  if(!roles.includes(e.author)||seen.has(e.id)||e.kind==='tool')return;
  seen.add(e.id);if(seen.size>1000)seen=new Set([...seen].slice(-500));
  // One live utterance per role. Maximum two on screen, so the world stays legible.
  const old=bubbles.find(b=>b.role===e.author);if(old){old.el.remove();old.line.remove();bubbles=bubbles.filter(b=>b!==old);}
  while(bubbles.length>=2){const b=bubbles.shift();b.el.remove();b.line.remove();}
  const el=node('div','', 'bubble');el.style.setProperty('--role',colors[roles.indexOf(e.author)]);el.append(node('b',e.author),node('span',e.text));$('bubbles').append(el);
  const line=document.createElementNS('http://www.w3.org/2000/svg','line');$('leaders').append(line);
  bubbles.push({el,line,role:e.author,start:performance.now()});
}
function layoutBubbles(){
  if(!world)return;
  const now=performance.now(),stage=$('stage'),w=stage.clientWidth,h=stage.clientHeight,placed=[];
  bubbles=bubbles.filter(b=>{if(now-b.start>10000){b.el.remove();b.line.remove();return false;}return true;});
  for(const b of bubbles){
    const anchor=world.project(b.role);if(!anchor){b.el.style.opacity='0';b.line.style.opacity='0';continue;}
    const bw=b.el.offsetWidth,bh=b.el.offsetHeight;
    let x=Math.max(10,Math.min(w-bw-10,anchor.x-bw/2)),y=Math.max(130,Math.min(h-bh-130,anchor.y-bh-35));
    const overlaps=(px,py)=>placed.some(r=>px<r.x+r.w+14&&px+bw+14>r.x&&py<r.y+r.h+14&&py+bh+14>r.y);
    if(overlaps(x,y)){
      let found=false;
      for(let yy=130;yy<h-bh-125&&!found;yy+=bh+16)for(let xx=10;xx<w-bw;xx+=bw+16){if(!overlaps(xx,yy)){x=xx;y=yy;found=true;break;}}
      if(!found){b.el.style.opacity='0';b.line.style.opacity='0';continue;}
    }
    placed.push({x,y,w:bw,h:bh});
    const opacity=anchor.visible?Math.min(1,(10000-(now-b.start))/1800):0;
    b.el.style.opacity=String(opacity);b.el.style.transform=`translate3d(${Math.round(x)}px,${Math.round(y)}px,0)`;
    b.line.setAttribute('x1',anchor.x);b.line.setAttribute('y1',anchor.y);b.line.setAttribute('x2',x+bw/2);b.line.setAttribute('y2',y+bh);b.line.style.opacity=String(opacity*.5);
  }
}
window.addEventListener('village-frame',layoutBubbles);
import('./world.js').then(module=>{
  world=module.createWorld(selectRole);if(snapshot)world.setState(snapshot);window.villageWorld=world;
  $('motion').textContent=world.paused?'▶ Resume world':'Ⅱ Pause world';$('motion').setAttribute('aria-pressed',String(!world.paused));
}).catch(error=>{$('scene-error').hidden=false;$('scene-error').textContent='3D could not load. Check that WebGL is enabled and cdn.jsdelivr.net is reachable. The task controls still work. '+error.message;});
$('reset-camera').onclick=()=>world?.reset();
$('motion').onclick=()=>{if(!world)return;const paused=world.pause();$('motion').textContent=paused?'▶ Resume world':'Ⅱ Pause world';$('motion').setAttribute('aria-pressed',String(!paused));};
$('night').onclick=()=>{const night=world?.night();$('night').textContent=night?'☀ Daylight':'☾ Evening';$('night').setAttribute('aria-pressed',String(!!night));};

function modelWarning(){
  const restricted=$('engine').value==='opencode'&&$('model').value.startsWith('opencode/');
  $('model-warning').hidden=!restricted;
  $('model-warning').textContent='OpenCode’s free-tier endpoint has returned HTTP 403 in this village. If rejected, select a model from another provider. No automatic model switching is performed.';
}
function filterModels(){
  const engine=$('engine').value,provider=$('model-provider').value;
  const list=catalog.filter(m=>m.engine===engine&&(!provider||m.id.split('/')[0]===provider)).sort((a,b)=>a.id.localeCompare(b.id));
  $('models').replaceChildren(...list.map(m=>{const option=node('option');option.value=m.id;option.label=m.label;return option;}));
  const defaultOption=node('option','Default engine model');defaultOption.value='';
  $('model-picker').replaceChildren(defaultOption);
  let group,lastProvider;
  for(const m of list){const p=m.id.split('/')[0];if(p!==lastProvider){group=node('optgroup');group.label=p;$('model-picker').append(group);lastProvider=p;}const option=node('option',m.id.slice(p.length+1));option.value=m.id;group.append(option);}
  const value=$('model').value;
  $('model-picker').value=list.some(m=>m.id===value)?value:'';
  $('model-hint').textContent=engine==='llm'?'Enter the exact model ID served by your endpoint.':`${list.length} models · sorted by provider and model name. Catalog availability depends on credentials and credits.`;
  modelWarning();
}
function modelOptions(){
  const engine=$('engine').value;
  const providers=[...new Set(catalog.filter(m=>m.engine===engine).map(m=>m.id.split('/')[0]))].sort((a,b)=>a.localeCompare(b));
  const all=node('option','All providers · A–Z');all.value='';
  $('model-provider').replaceChildren(all,...providers.map(p=>{const option=node('option',p);option.value=p;return option;}));
  const previous=saved('provider-'+engine);$('model-provider').value=providers.includes(previous)?previous:'';
  $('catalog-controls').hidden=engine==='llm';
  $('custom-fields').hidden=engine!=='llm';
  $('model').value=saved('model-'+engine);
  $('model').placeholder=engine==='llm'?'e.g. llama3.2':'Default engine model';
  $('model').required=engine==='llm';$('base-url').required=engine==='llm';
  if(engine==='llm')$('advanced').open=true;
  filterModels();
}
async function refresh(){
  if(!$('repo').value)return;
  const requestScope=scope;
  try{
    const s=await api('state?'+params());if(requestScope!==scope)return;snapshot=s;
    $('connection').textContent=s.engine==='llm'?'LLM endpoint':s.engine==='hermes'?'Hermes':'OpenCode';
    activeJob=s.jobs.find(j=>['running','queued'].includes(j.status))||null;lastJob=s.jobs.at(-1)||null;
    $('stop').hidden=!activeJob;$('send').disabled=!!activeJob;$('send').textContent=activeJob?'Working…':'Send task ↗';
    $('run-status').textContent=lastJob?.status||'No active run';
    $('run-status').dataset.status=lastJob?.status||'idle';
    $('sheet-status').textContent=activeJob?`${activeJob.current_agent} · working`:(lastJob?`Last run · ${lastJob.status}`:'Conversation · no active run');
    const sessLabel=selectedSession()?'⧉ '+sessionTitle(selectedSession()).slice(0,30):(sessionMode==='new'?'⧉ new session':'');
    $('active-role').textContent=(activeJob?`${activeJob.current_agent} · ${s.engine} · ${activeJob.model||'default model'}`:`Ready · ${$('role').value} · ${s.engine}`)+(sessLabel?' · '+sessLabel:'');
    updateSessionButtons();
    if(pendingNewSession&&lastJob?.engine_session){pendingNewSession=false;save(sessionKey(),lastJob.engine_session);setSessionMode('existing');await loadSessions();}
    $('world-state').textContent=activeJob?`${s.project} · ${activeJob.current_agent.toLowerCase()} is working`:`${s.project} · ${lastJob?'last run '+lastJob.status:'ready for a new task'} · ambient village`;
    world?.setState(s);
    const events=s.jobs.flatMap(j=>j.events);
    if(firstPoll){events.forEach(e=>seen.add(e.id));firstPoll=false;}else events.slice(-10).forEach(addBubble);
    const key=s.jobs.map(j=>`${j.id}:${j.events.length}:${j.status}:${j.events.at(-1)?.id}:${j.events.at(-1)?.text}`).join('|');
    if(key!==conversationKey){
      conversationKey=key;renderConversation(s.jobs);
    }
    $('history').replaceChildren(...s.talks.slice(-8).map(t=>card(t.author,t.text,'history')));
    $('memories').replaceChildren(...s.memories.map(m=>card(m.source,m.text,'history')));
    if(s.warning)notice(s.warning);
  }catch(error){if(requestScope===scope){$('connection').textContent='Disconnected';notice(error.message);}}
}
function scopeChange(){scope++;snapshot=null;activeJob=null;lastJob=null;conversationKey='';firstPoll=true;pendingNewSession=false;clearBubbles();resetConversation();setSessionMode('existing');$('history').replaceChildren();$('memories').replaceChildren();$('artifact-text').textContent='Select an artifact to read.';world?.exitOffice();world?.setState({});notice('');save('repo',$('repo').value);save('engine',$('engine').value);refresh();loadSessions();}
let villageConfig=null;
function engineNotice(){
  const avail=villageConfig?.engines?.[$('engine').value];
  if(avail&&!avail.command)notice('Engine not found on this machine: '+avail.hint);
}
$('engine').onchange=()=>{modelOptions();engineNotice();scopeChange();};$('repo').onchange=scopeChange;
$('model-provider').onchange=()=>{save('provider-'+$('engine').value,$('model-provider').value);filterModels();};
$('model-picker').onchange=()=>{$('model').value=$('model-picker').value;save('model-'+$('engine').value,$('model').value);modelWarning();};
$('model').onchange=()=>{save('model-'+$('engine').value,$('model').value);filterModels();};
$('model').oninput=modelWarning;
$('task-form').onsubmit=async e=>{
  e.preventDefault();notice('');$('send').disabled=true;
  const requestScope=scope;
  try{
    save('model-'+$('engine').value,$('model').value);
    await api('dispatch',{repo:$('repo').value,engine:$('engine').value,model:$('model').value,role:$('role').value,message:$('message').value,
      previous_id:$('followup').checked?lastJob?.id:null,base_url:$('base-url').value,key_env:$('key-env').value,
      session_id:selectedSession(),new_session:sessionMode==='new',new_title:$('session-title').value});
    if(requestScope===scope){save(sessionKey(),selectedSession());if(sessionMode==='new')pendingNewSession=true;$('message').value='';firstPoll=false;await refresh();}
  }catch(error){notice(error.message);}finally{if(!activeJob)$('send').disabled=false;}
};
$('stop').onclick=async()=>{if(!activeJob)return;try{await api('stop',{id:activeJob.id});await refresh();}catch(error){notice(error.message);}};
let sessionList=[], sessionMode='existing', pendingNewSession=false, deleteArmed=false, deleteTimer=null;
const sessionKey=()=>'session-'+$('engine').value+'-'+$('repo').value;
const selectedSession=()=>sessionMode==='existing'?($('session').value||''):'';
const sessionTitle=id=>{const s=sessionList.find(s=>s.id===id);return s?s.title:id;};
function setSessionMode(mode){
  sessionMode=mode;deleteArmed=false;clearTimeout(deleteTimer);
  $('session-delete').classList.remove('armed');$('session-delete').textContent='Delete';
  $('session-title-fields').hidden=!(mode==='new'||mode==='rename');
  $('session-title-confirm').hidden=mode!=='rename';
  if(mode==='new'){$('session').value='';$('session-title').value='';}
  if(mode==='rename'){const s=sessionList.find(s=>s.id===$('session').value);$('session-title').value=s?s.title:'';}
  updateSessionButtons();
}
function updateSessionButtons(){
  const locked=!!activeJob, has=!!selectedSession();
  for(const id of ['session','session-new','session-delete','session-rename']){$(id).disabled=locked;$(id).title=locked?'Stop the live run first':'';}
  $('session-delete').hidden=!has;$('session-rename').hidden=!(has&&$('engine').value==='hermes');
  $('session-new').textContent=sessionMode==='new'?'✓ New (armed)':'+ New';
}
async function loadSessions(){
  const requestScope=scope, engine=$('engine').value, repo=$('repo').value;
  $('session-warning').hidden=true;
  if(engine==='llm'){
    $('session').replaceChildren(node('option','Sessions need OpenCode or Hermes'));$('session').disabled=true;
    setSessionMode('existing');return;
  }
  $('session').disabled=false;
  try{
    const data=await api('sessions?'+new URLSearchParams({repo,engine}));
    if(requestScope!==scope)return;
    sessionList=data.sessions||[];
    const sel=$('session');sel.replaceChildren();
    const def=node('option','Engine default (new)');def.value='';sel.append(def);
    for(const s of sessionList){
      const label=`${s.parent_id?'⑂ ':''}${s.pinned?'📌 ':''}${s.title} · ${s.ago}${s.model?' · '+s.model.split('/').pop():''}`;
      const opt=node('option',label.slice(0,80));opt.value=s.id;
      opt.title=`${s.title}\n${s.id}\nactive ${s.ago}${s.model?'\n'+s.model:''}`;sel.append(opt);
    }
    const previous=saved(sessionKey());
    sel.value=previous&&sessionList.some(s=>s.id===previous)?previous:'';
    if(sessionMode!=='new'&&sessionMode!=='rename')setSessionMode('existing');
    if(data.warning){$('session-warning').textContent=data.warning;$('session-warning').hidden=false;}
    updateSessionButtons();
  }catch(error){
    if(requestScope!==scope)return;
    $('session-warning').textContent=error.message;$('session-warning').hidden=false;
  }
}
$('session').onchange=()=>{save(sessionKey(),$('session').value);setSessionMode('existing');};
$('session-new').onclick=()=>setSessionMode(sessionMode==='new'?'existing':'new');
$('session-delete').onclick=async()=>{
  const id=selectedSession();if(!id||activeJob)return;
  if(!deleteArmed){deleteArmed=true;$('session-delete').classList.add('armed');$('session-delete').textContent='Confirm delete?';deleteTimer=setTimeout(()=>setSessionMode('existing'),5000);return;}
  clearTimeout(deleteTimer);
  try{await api('sessions/delete',{engine:$('engine').value,id});save(sessionKey(),'');setSessionMode('existing');await loadSessions();await refresh();}
  catch(error){notice(error.message);setSessionMode('existing');}
};
$('session-rename').onclick=()=>setSessionMode('rename');
$('session-title-confirm').onclick=async()=>{
  const id=selectedSession();if(!id)return;
  try{await api('sessions/rename',{engine:$('engine').value,id,title:$('session-title').value});setSessionMode('existing');await loadSessions();}
  catch(error){notice(error.message);}
};
$('read-artifact').onclick=async()=>{const n=scope;try{const result=await api('artifacts?'+params());if(n===scope)$('artifact-text').textContent=result.artifacts[$('artifact').value]||'No artifact for this project yet.';}catch(e){notice(e.message);}};
let folderSeq=0;
async function browse(path){
  const mine=++folderSeq;
  $('folder-error').textContent='';
  try{const data=await api('folders?'+new URLSearchParams({path}));if(mine!==folderSeq)return;folderPath=data.path;folderParent=data.parent;$('folder-path').value=data.path;$('folder-list').replaceChildren(...data.folders.map(f=>{const b=node('button','▱  '+f.name);b.onclick=()=>browse(f.path);return b;}));}
  catch(error){if(mine!==folderSeq)return;$('folder-error').textContent=error.message;}
}
$('browse').onclick=()=>{$('folder-dialog').showModal();browse($('repo').value);};
$('folder-go').onclick=()=>browse($('folder-path').value);$('folder-path').onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();browse(e.target.value);}};
$('folder-up').onclick=()=>browse(folderParent);
$('folder-select').onclick=()=>{if(!folderPath)return;addRepo(folderPath);$('repo').value=folderPath;$('folder-dialog').close();scopeChange();};
function addRepo(path){if(![...$('repo').options].some(o=>o.value===path)){const opt=node('option',path.split('/').pop()||path);opt.value=path;opt.title=path;$('repo').append(opt);}}
async function init(){
  setView(mainView);
  try{
    villageConfig=await api('config');
    if(!saved('engine')&&['opencode','hermes','llm'].includes(villageConfig.defaults?.engine))$('engine').value=villageConfig.defaults.engine;
    if(villageConfig.defaults?.role&&roles.includes(villageConfig.defaults.role))selectRole(villageConfig.defaults.role);
    engineNotice();
  }catch(error){/* servers without /config: carry on with built-ins */}
  try{const data=await api('repos');data.repos.forEach(addRepo);const previous=saved('repo');const configured=villageConfig?.defaults?.repo;if(previous)addRepo(previous);if(configured)addRepo(configured);if(!$('repo').options.length)addRepo(data.home);$('repo').value=previous||configured||data.repos[0]||data.home;await refresh();await loadSessions();}
  catch(error){notice(error.message);}
  try{const data=await api('models');catalog=data.models;modelOptions();if(data.warnings.length)notice(data.warnings.join(' · '));}catch(error){notice(error.message);modelOptions();}
  async function tick(){await refresh();setTimeout(tick,1800);}setTimeout(tick,1800);
}init();
