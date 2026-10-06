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
function parseUnifiedDiff(diffText) {
  const lines = diffText.split('\n');
  let oldFile = '', newFile = '';
  const hunks = [];
  let currentHunk = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.startsWith('--- ')) {
      oldFile = line.slice(4).replace(/^[ab]\//, '').trim();
    } else if (line.startsWith('+++ ')) {
      newFile = line.slice(4).replace(/^[ab]\//, '').trim();
    } else if (line.startsWith('diff --git ')) {
      const m = line.match(/diff --git a\/(.+?) b\/(.+)/);
      if (m) { oldFile = m[1]; newFile = m[2]; }
    } else if (/^@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/.test(line)) {
      const m = line.match(/^@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@(.*)/);
      currentHunk = {
        oldStart: parseInt(m[1], 10),
        newStart: parseInt(m[2], 10),
        header: m[0].trim(),
        heading: (m[3] || '').trim(),
        rows: []
      };
      hunks.push(currentHunk);
      let oldLn = currentHunk.oldStart;
      let newLn = currentHunk.newStart;

      let removals = [];
      let additions = [];

      function flushChanges() {
        const count = Math.max(removals.length, additions.length);
        for (let k = 0; k < count; k++) {
          currentHunk.rows.push({
            type: 'change',
            left: removals[k] || null,
            right: additions[k] || null
          });
        }
        removals = [];
        additions = [];
      }

      while (i + 1 < lines.length) {
        const nextLine = lines[i + 1];
        if (nextLine.startsWith('@@ ') || nextLine.startsWith('diff --git ') || nextLine.startsWith('--- ') || nextLine.startsWith('[diff_block_end]')) {
          break;
        }
        i++;
        const hl = lines[i];
        if (hl.startsWith('+')) {
          additions.push({ ln: newLn++, text: hl.slice(1) });
        } else if (hl.startsWith('-')) {
          removals.push({ ln: oldLn++, text: hl.slice(1) });
        } else if (hl.startsWith(' ')) {
          flushChanges();
          currentHunk.rows.push({
            type: 'context',
            left: { ln: oldLn++, text: hl.slice(1) },
            right: { ln: newLn++, text: hl.slice(1) }
          });
        } else if (hl.trim() === '') {
          flushChanges();
          currentHunk.rows.push({
            type: 'context',
            left: { ln: oldLn++, text: '' },
            right: { ln: newLn++, text: '' }
          });
        }
      }
      flushChanges();
    }
  }

  return { file: newFile || oldFile || 'code change', hunks };
}

function createDiffView(diffData) {
  const container = node('div', '', 'diff-view');
  
  // Header with file path and hunk headers
  const hdr = node('div', '', 'diff-header');
  const fileSpan = node('span', diffData.file || 'Code change', 'diff-file');
  const infoSpan = node('span', diffData.hunks.map(h => h.header).join('  ') || '', 'diff-hunk-info');
  hdr.append(fileSpan, infoSpan);
  container.append(hdr);

  // Column titles: OLD vs NEW
  const colsHead = node('div', '', 'diff-cols-head');
  const oldTitle = node('div', 'OLD (PREV)', 'diff-col-title');
  const newTitle = node('div', 'NEW (CURRENT)', 'diff-col-title');
  colsHead.append(oldTitle, newTitle);
  container.append(colsHead);

  // Grid of lines
  const grid = node('div', '', 'diff-grid');
  for (const hunk of diffData.hunks) {
    for (const row of hunk.rows) {
      if (row.type === 'context') {
        const leftCell = node('div', '', 'diff-cell left context');
        const lLn = node('span', String(row.left.ln), 'diff-ln');
        const lTxt = node('span', row.left.text, 'diff-txt');
        leftCell.append(lLn, lTxt);

        const rightCell = node('div', '', 'diff-cell right context');
        const rLn = node('span', String(row.right.ln), 'diff-ln');
        const rTxt = node('span', row.right.text, 'diff-txt');
        rightCell.append(rLn, rTxt);

        grid.append(leftCell, rightCell);
      } else {
        const leftCell = node('div', '', 'diff-cell left ' + (row.left ? 'del' : 'empty'));
        if (row.left) {
          const lLn = node('span', String(row.left.ln), 'diff-ln');
          const lTxt = node('span', '-' + row.left.text, 'diff-txt');
          leftCell.append(lLn, lTxt);
        } else {
          leftCell.append(node('span', '', 'diff-ln'), node('span', '', 'diff-txt'));
        }

        const rightCell = node('div', '', 'diff-cell right ' + (row.right ? 'add' : 'empty'));
        if (row.right) {
          const rLn = node('span', String(row.right.ln), 'diff-ln');
          const rTxt = node('span', '+' + row.right.text, 'diff-txt');
          rightCell.append(rLn, rTxt);
        } else {
          rightCell.append(node('span', '', 'diff-ln'), node('span', '', 'diff-txt'));
        }

        grid.append(leftCell, rightCell);
      }
    }
  }
  container.append(grid);
  return container;
}

function hasDiff(text) {
  return /```diff\n/m.test(text) ||
         /\[diff_block_start\]/m.test(text) ||
         /(?:^|\n)diff --git /m.test(text) ||
         /(?:^|\n)--- (?:a\/|[^\n]+)\n\+\+\+ (?:b\/|[^\n]+)/m.test(text) ||
         /(?:^|\n)@@ -\d+(?:,\d+)? \+\d+(?:,\d+)? @@/m.test(text);
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatInline(str) {
  if (!str) return '';
  let res = escapeHtml(str);
  res = res.replace(/`([^`]+)`/g, '<code class="ag-inline-code">$1</code>');
  res = res.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  res = res.replace(/(?:^|[^*])\*([^*]+)\*(?:[^*]|$)/g, (m, p1) => m.replace(`*${p1}*`, `<em>${p1}</em>`));
  return res;
}

function highlight(lang, code) {
  if (!['javascript', 'js', 'typescript', 'ts', 'json', 'css', 'html'].includes((lang || '').toLowerCase())) {
    return escapeHtml(code);
  }
  
  const rules = [
    { type: 'hl-comment', regex: /^\/\/.*|^\/\*[\s\S]*?\*\// },
    { type: 'hl-string', regex: /^("|'|`)(?:\\[\s\S]|(?!\1)[^\\])*\1/ },
    { type: 'hl-keyword', regex: /^(?:const|let|var|function|return|if|else|for|while|import|export|class|extends|new|try|catch|switch|case|break|continue|await|async|true|false|null|undefined)\b/ },
    { type: 'hl-number', regex: /^-?\d+(?:\.\d+)?\b/ },
    { type: 'hl-function', regex: /^[a-zA-Z_$][a-zA-Z0-9_$]*(?=\s*\()/ }
  ];

  let out = '';
  let i = 0;
  while (i < code.length) {
    let matched = false;
    for (const rule of rules) {
      const match = code.substring(i).match(rule.regex);
      if (match) {
        out += `<span class="${rule.type}">${escapeHtml(match[0])}</span>`;
        i += match[0].length;
        matched = true;
        break;
      }
    }
    if (!matched) {
      out += escapeHtml(code[i]);
      i++;
    }
  }
  return out;
}

function createCodeBlock(lang, code) {
  const wrapper = node('div', '', 'ag-code-block');
  const head = node('div', '', 'code-head');
  const langSpan = node('span', lang || 'code');
  const copyBtn = node('button', 'Copy', 'code-copy-btn');
  copyBtn.type = 'button';
  head.append(langSpan, copyBtn);

  const pre = node('pre');
  const codeEl = node('code');
  codeEl.innerHTML = highlight(lang, code);
  pre.append(codeEl);
  wrapper.append(head, pre);
  return wrapper;
}

function renderMarkdownProse(container, text) {
  const lines = text.split('\n');
  let i = 0;

  function flushParagraph(pLines) {
    if (!pLines.length) return;
    const p = node('p', '', 'ag-p');
    p.innerHTML = pLines.map(formatInline).join('<br>');
    container.append(p);
  }

  let pLines = [];

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    if (!trimmed) {
      flushParagraph(pLines);
      pLines = [];
      i++;
      continue;
    }

    const calloutMatch = trimmed.match(/^>\s*\[!(NOTE|TIP|WARNING|IMPORTANT)\]\s*$/i);
    if (calloutMatch) {
      flushParagraph(pLines);
      pLines = [];
      const cType = calloutMatch[1].toUpperCase();
      const calloutLines = [];
      i++;
      while (i < lines.length && lines[i].trim().startsWith('>')) {
        calloutLines.push(lines[i].trim().replace(/^>\s?/, ''));
        i++;
      }
      const calloutEl = node('div', '', 'ag-callout ' + cType.toLowerCase());
      const badge = node('div', cType, 'callout-badge');
      const body = node('div', '', 'callout-body');
      body.innerHTML = calloutLines.map(formatInline).join('<br>');
      calloutEl.append(badge, body);
      container.append(calloutEl);
      continue;
    }

    if (trimmed.startsWith('# ') || trimmed.startsWith('## ') || trimmed.startsWith('### ')) {
      flushParagraph(pLines);
      pLines = [];
      if (trimmed.startsWith('### ')) {
        const h = node('h3', '', 'ag-h3');
        h.innerHTML = formatInline(trimmed.slice(4));
        container.append(h);
      } else if (trimmed.startsWith('## ')) {
        const h = node('h2', '', 'ag-h2');
        h.innerHTML = formatInline(trimmed.slice(3));
        container.append(h);
      } else {
        const h = node('h1', '', 'ag-h1');
        h.innerHTML = formatInline(trimmed.slice(2));
        container.append(h);
      }
      i++;
      continue;
    }

    if (/^[-*]\s+/.test(trimmed)) {
      flushParagraph(pLines);
      pLines = [];
      const ul = node('ul', '', 'ag-list');
      while (i < lines.length && /^[-*]\s+/.test(lines[i].trim())) {
        const li = node('li', '');
        li.innerHTML = formatInline(lines[i].trim().replace(/^[-*]\s+/, ''));
        ul.append(li);
        i++;
      }
      container.append(ul);
      continue;
    }

    pLines.push(line);
    i++;
  }

  flushParagraph(pLines);
}

function renderMarkdown(container, text) {
  if (!text) return;

  if (hasDiff(text) && !text.includes('```') && !text.includes('[diff_block_start]')) {
    const parsed = parseUnifiedDiff(text);
    if (parsed.hunks.length) {
      container.append(createDiffView(parsed));
      return;
    }
  }

  const blockRegex = /(?:```([a-zA-Z0-9_-]*)\n([\s\S]*?)```|\[diff_block_start\]\n?([\s\S]*?)\[diff_block_end\])/g;
  let lastIndex = 0;
  let match;

  while ((match = blockRegex.exec(text)) !== null) {
    const textBefore = text.slice(lastIndex, match.index);
    if (textBefore.trim()) {
      renderMarkdownProse(container, textBefore);
    }
    lastIndex = match.index + match[0].length;

    if (match[3] !== undefined) {
      const diffContent = match[3];
      const parsed = parseUnifiedDiff(diffContent);
      if (parsed.hunks.length) {
        container.append(createDiffView(parsed));
      } else {
        container.append(createCodeBlock('diff', diffContent));
      }
    } else {
      const lang = (match[1] || '').trim().toLowerCase();
      const code = match[2];
      if (lang === 'diff' || hasDiff(code)) {
        const parsed = parseUnifiedDiff(code);
        if (parsed.hunks.length) {
          container.append(createDiffView(parsed));
        } else {
          container.append(createCodeBlock(lang || 'diff', code));
        }
      } else {
        container.append(createCodeBlock(lang || 'code', code));
      }
    }
  }

  const textRemaining = text.slice(lastIndex);
  if (textRemaining.trim()) {
    renderMarkdownProse(container, textRemaining);
  }
}

const roleAvatars = { ARCHITECT: '📐', CODER: '💻', TESTER: '🔍', MANAGER: '📋' };
const roleLabels = { ARCHITECT: 'Architect', CODER: 'Coder', TESTER: 'Tester', MANAGER: 'Manager' };
const roleBadges = {
  ARCHITECT: 'System Architecture',
  CODER: 'Implementation & Tools',
  TESTER: 'Quality & Verification',
  MANAGER: 'Coordination & Review'
};

function card(author, text, kind = 'message', turnStart = false) {
  const roleIdx = roles.indexOf(author);
  const roleLower = roleIdx >= 0 ? author.toLowerCase() : 'agent';
  const avatarChar = roleAvatars[author] || '✦';
  const displayName = roleLabels[author] || (author ? (author[0] + author.slice(1).toLowerCase()) : 'Agent');
  const badgeTitle = roleBadges[author] || 'AI Agent';
  const speakerColor = roleIdx >= 0 ? colors[roleIdx] : 'var(--ag-blue)';

  if (kind === 'user') {
    const cardEl = node('div', '', 'ag-turn user tline user' + (turnStart ? ' turn-start' : ''));
    let target = '';
    if (author.includes('·')) {
      const parts = author.split('·');
      const targetRole = parts[1].trim();
      target = roleLabels[targetRole] || targetRole;
    }
    const bubble = node('div', '', 'ag-user-bubble');
    const meta = node('div', '', 'ag-user-meta');
    const badge = node('span', 'YOU', 'ag-user-badge');
    meta.append(badge);
    if (target) {
      const toSpan = node('span', 'to ' + target, 'ag-meta-info');
      meta.append(toSpan);
    }
    const prompt = node('div', text, 'ag-user-prompt tbody');
    bubble.append(meta, prompt);
    cardEl.append(bubble);
    return cardEl;
  }

  if (kind === 'error') {
    const cardEl = node('div', '', 'ag-turn error tline error' + (turnStart ? ' turn-start' : ''));
    const av = node('div', '!', 'ag-avatar');
    const body = node('div', '', 'ag-turn-body');
    const hdr = node('div', '', 'ag-turn-header');
    const name = node('span', 'System Error', 'ag-speaker-name');
    name.style.color = 'var(--ag-red)';
    hdr.append(name);
    const errBox = node('div', displayError(text), 'ag-error-box tbody');
    body.append(hdr, errBox);
    cardEl.append(av, body);
    return cardEl;
  }

  if (kind === 'status') {
    const cardEl = node('div', '', 'ag-turn status tline status' + (turnStart ? ' turn-start' : ''));
    if (roleIdx >= 0) cardEl.style.setProperty('--speaker-color', speakerColor);
    const av = node('div', '·', 'ag-avatar');
    const body = node('div', '', 'ag-turn-body');
    const hdr = node('div', '', 'ag-turn-header');
    const name = node('span', author, 'ag-speaker-name');
    const badge = node('span', 'Status', 'ag-role-badge');
    hdr.append(name, badge);
    const content = node('div', text, 'ag-status-text tbody');
    content.style.fontSize = '12px';
    content.style.color = 'var(--ag-text-muted)';
    body.append(hdr, content);
    cardEl.append(av, body);
    return cardEl;
  }

  if (kind === 'tool') {
    const cardEl = node('div', '', 'ag-turn agent tline tool' + (turnStart ? ' turn-start' : ''));
    if (roleIdx >= 0) cardEl.style.setProperty('--speaker-color', speakerColor);
    const av = node('div', avatarChar, 'ag-avatar ' + roleLower);
    av.title = displayName;
    const body = node('div', '', 'ag-turn-body');
    const hdr = node('div', '', 'ag-turn-header');
    const name = node('span', displayName, 'ag-speaker-name');
    const rBadge = node('span', 'Tool Call', 'ag-role-badge');
    hdr.append(name, rBadge);

    let toolName = 'tool', toolSummary = text;
    const sp = text.indexOf(' ');
    if (sp > 0) {
      toolName = text.slice(0, sp);
      toolSummary = text.slice(sp + 1);
    }

    const details = node('details', '', 'ag-tool-card');
    details.open = true;
    const summary = node('summary', '', 'ag-tool-header');
    const icon = node('span', '⚡', 'ag-tool-icon');
    const tName = node('span', toolName, 'ag-tool-name');
    const tSumm = node('span', toolSummary, 'ag-tool-summary');
    const tStat = node('span', 'invoked', 'ag-tool-status success');
    const chev = node('span', '▾', 'ag-chevron');
    summary.append(icon, tName, tSumm, tStat, chev);

    const tBody = node('div', '', 'ag-tool-body');
    const pre = node('pre', text, 'ag-tool-output tbody');
    tBody.append(pre);
    details.append(summary, tBody);
    body.append(hdr, details);
    cardEl.append(av, body);
    return cardEl;
  }

  if (kind === 'tool_result') {
    const cardEl = node('div', '', 'ag-turn agent tline tool_result' + (turnStart ? ' turn-start' : ''));
    if (roleIdx >= 0) cardEl.style.setProperty('--speaker-color', speakerColor);
    const av = node('div', avatarChar, 'ag-avatar ' + roleLower);
    av.title = displayName;
    const body = node('div', '', 'ag-turn-body');
    const hdr = node('div', '', 'ag-turn-header');
    const name = node('span', displayName, 'ag-speaker-name');
    const rBadge = node('span', 'Tool Result', 'ag-role-badge');
    hdr.append(name, rBadge);

    const details = node('details', '', 'ag-tool-card');
    const summary = node('summary', '', 'ag-tool-header');
    const icon = node('span', '▤', 'ag-tool-icon');

    if (hasDiff(text)) {
      details.open = true;
      const parsed = parseUnifiedDiff(text);
      const tName = node('span', 'diff', 'ag-tool-name');
      const tSumm = node('span', parsed.file || 'code change', 'ag-tool-summary');
      const tStat = node('span', 'applied', 'ag-tool-status success');
      const chev = node('span', '▾', 'ag-chevron');
      summary.append(icon, tName, tSumm, tStat, chev);

      const tBody = node('div', '', 'ag-tool-body tbody');
      if (parsed.hunks.length) {
        tBody.append(createDiffView(parsed));
      } else {
        tBody.append(node('pre', text, 'ag-tool-output'));
      }
      details.append(summary, tBody);
    } else {
      const firstLine = text.split('\n')[0].slice(0, 100);
      const tName = node('span', 'result', 'ag-tool-name');
      const tSumm = node('span', firstLine || 'output', 'ag-tool-summary');
      const tStat = node('span', 'completed', 'ag-tool-status success');
      const chev = node('span', '▾', 'ag-chevron');
      summary.append(icon, tName, tSumm, tStat, chev);

      const tBody = node('div', '', 'ag-tool-body');
      const pre = node('pre', text, 'ag-tool-output tbody');
      tBody.append(pre);
      details.append(summary, tBody);
    }

    body.append(hdr, details);
    cardEl.append(av, body);
    return cardEl;
  }

  const cardEl = node('div', '', 'ag-turn agent tline message ' + kind + (turnStart ? ' turn-start' : ''));
  if (roleIdx >= 0) cardEl.style.setProperty('--speaker-color', speakerColor);
  const av = node('div', avatarChar, 'ag-avatar ' + roleLower);
  av.title = displayName;
  const body = node('div', '', 'ag-turn-body');
  const hdr = node('div', '', 'ag-turn-header');
  const name = node('span', displayName, 'ag-speaker-name');
  const rBadge = node('span', badgeTitle, 'ag-role-badge');
  const metaInfo = node('span', '· Antigravity', 'ag-meta-info');
  hdr.append(name, rBadge, metaInfo);
  body.append(hdr);

  const thinkMatch = text.match(/<(?:thinking|thought)>([\s\S]*?)<\/(?:thinking|thought)>/i);
  let proseText = text;
  if (thinkMatch) {
    const thinkContent = thinkMatch[1].trim();
    proseText = text.replace(thinkMatch[0], '').trim();

    const drawer = node('details', '', 'ag-thinking-drawer');
    const summary = node('summary', '');
    const sparkle = node('span', '✦', 'ag-sparkle');
    const label = node('span', 'Thinking Process', 'ag-thinking-label');
    const linesCount = thinkContent.split('\n').length;
    const metric = node('span', `(${linesCount} lines)`, 'ag-thinking-metric');
    const chev = node('span', '▾', 'ag-chevron');
    summary.append(sparkle, label, metric, chev);

    const drawerBody = node('div', thinkContent, 'ag-thinking-content');
    drawer.append(summary, drawerBody);
    body.append(drawer);
  }

  const prose = node('div', '', 'ag-prose tbody');
  renderMarkdown(prose, proseText);
  body.append(prose);

  cardEl.append(av, body);
  return cardEl;
}

function renderConversation(jobs){
  if(!jobs.length){if(renderedMessages.size)resetConversation();return;}
  $('conversation').querySelector('.empty-state, .term-empty, .ag-empty-state')?.remove();
  const keep=new Set(),fragment=document.createDocumentFragment();
  function upsert(id,author,text,kind,first=false){
    keep.add(id);
    const signature=author+'\0'+kind+'\0'+text,old=renderedMessages.get(id);
    if(old?.signature===signature){if(first)old.el.classList.add('turn-start');return;}
    const el=card(author,text,kind,first);
    if(old){
      const oldDetails=old.el.querySelectorAll('details');
      const newDetails=el.querySelectorAll('details');
      oldDetails.forEach((od,i)=>{if(od.open&&newDetails[i])newDetails[i].open=true;});
      if(old.el.open)el.open=true;
      old.el.replaceWith(el);
    }else{
      fragment.append(el);
    }
    renderedMessages.set(id,{el,signature});
  }
  for(const job of jobs){
    upsert(job.id+'-prompt','YOU · '+job.role,job.message,'user',true);
    for(const e of job.events)upsert(e.id,e.author,e.text,e.kind);
    if(job.error&&!job.events.some(e=>e.kind==='error'))upsert(job.id+'-error','ERROR',job.error,'error');
  }
  for(const [id,item] of renderedMessages){if(!keep.has(id)){item.el.remove();renderedMessages.delete(id);}}
  $('conversation').append(fragment);if(followingOutput)jumpLatest();else $('jump-latest').hidden=false;
  applyFilter();
}

function updateCursor(){
  document.querySelector('.cursor')?.remove();
  document.querySelector('.ag-streaming-cursor')?.remove();
  if(!activeJob)return;
  const lines=$('conversation').querySelectorAll('.tline');
  const last=lines[lines.length-1];
  if(!last||!followingOutput)return;
  const c=node('span','','ag-streaming-cursor cursor');
  (last.querySelector('.tbody')||last.querySelector('.ag-prose')||last).append(c);
}

function selectRole(role){
  selectedRole=role;$('role').value=role;
  const isTeam = role === 'TEAM';
  $('pTitle').textContent = isTeam ? "Full team's workspace" : role[0]+role.slice(1).toLowerCase()+"’s workspace";
  $('pBody').textContent={ARCHITECT:'Blueprints, requirements and acceptance criteria.',CODER:'Implementation, tools and building things that work.',TESTER:'Independent checks, reproduction steps and test evidence.',MANAGER:'Review, decisions and the next steps for the team.',TEAM:'The full team of agents working together autonomously to solve the task.'}[role]||'Workspace';
  document.querySelectorAll('.agent-button').forEach(b=>b.classList.toggle('active',b.dataset.role===role));
  $('artifact').value={ARCHITECT:'plan',CODER:'report',TESTER:'test_report',MANAGER:'review',TEAM:'history'}[role]||'plan';
  const roleIdx=roles.indexOf(role);
  const roleName = isTeam ? 'Full team' : role[0]+role.slice(1).toLowerCase();
  const label=$('composer-role-label');
  if(label)label.textContent=roleName;
  const pill=$('composer-role-pill');
  if(pill){
    const dot=pill.querySelector('.ag-role-dot');
    if(dot)dot.style.background=roleIdx>=0 ? colors[roleIdx] : '#9aa5b9';
  }
  const sheetStatus=$('sheet-status');
  if(sheetStatus)sheetStatus.textContent='Antigravity · '+roleName;
}
roles.forEach((role,i)=>{const b=node('button','', 'agent-button');b.dataset.role=role;b.style.setProperty('--role',colors[i]);b.append(node('i'),document.createTextNode(role[0]+role.slice(1).toLowerCase()));b.onclick=()=>selectRole(role);$('agent-bar').append(b);});
selectRole('TEAM');

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
    const anchor=world.project(b.role);if(!anchor||!isFinite(anchor.x+anchor.y)){b.el.style.opacity='0';b.line.style.opacity='0';continue;}
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
    const sessName=selectedSession()?sessionTitle(selectedSession()):(sessionMode==='new'?'new session':'no session');
    $('sheet-status').textContent=`${s.engine} — ${sessName} — ${s.project}`;
    const lastEvent=s.jobs.flatMap(j=>j.events).at(-1);
    $('digest-text').textContent=activeJob?`${activeJob.current_agent.toLowerCase()} > working…`:(lastEvent?`${lastEvent.author.toLowerCase()} > ${lastEvent.text.split('\n')[0].slice(0,90)}`:'idle — open Conversation to begin');
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
      conversationKey=key;$('conversation').classList.remove('cleared');renderConversation(s.jobs);
    }
    updateCursor();
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
$('role').onchange=()=>selectRole($('role').value);
$('engine').onchange=()=>{modelOptions();engineNotice();scopeChange();};$('repo').onchange=scopeChange;
$('model-provider').onchange=()=>{save('provider-'+$('engine').value,$('model-provider').value);filterModels();};
$('model-picker').onchange=()=>{$('model').value=$('model-picker').value;save('model-'+$('engine').value,$('model').value);modelWarning();};
$('model').onchange=()=>{save('model-'+$('engine').value,$('model').value);filterModels();};
$('model').oninput=modelWarning;
function applyFilter(){
  const q=$('term-filter').value.trim().toLowerCase();
  for(const [,item] of renderedMessages)item.el.style.display=!q||item.el.textContent.toLowerCase().includes(q)?'':'none';
}
$('term-filter').oninput=applyFilter;
$('term-copy').onclick=async()=>{
  const text=$('conversation').innerText;
  try{await navigator.clipboard.writeText(text);}
  catch(error){const ta=node('textarea',text);document.body.append(ta);ta.select();document.execCommand('copy');ta.remove();}
  $('term-copy').textContent='copied';setTimeout(()=>$('term-copy').textContent='copy',1200);
};
$('term-clear').onclick=()=>{$('conversation').classList.add('cleared');};
$('conversation').addEventListener('click',async e=>{
  const copyBtn=e.target.closest('.code-copy-btn');
  if(copyBtn){
    const block=copyBtn.closest('.ag-code-block');
    const codeEl=block?.querySelector('pre code')||block?.querySelector('pre');
    const text=codeEl?.textContent||'';
    try{await navigator.clipboard.writeText(text);}
    catch(err){const ta=node('textarea',text);document.body.append(ta);ta.select();document.execCommand('copy');ta.remove();}
    copyBtn.textContent='Copied!';
    setTimeout(()=>{copyBtn.textContent='Copy';},1500);
    return;
  }
  const chip=e.target.closest('.ag-chip');
  if(chip){
    const txt=chip.textContent;
    if(txt.includes('Plan')){selectRole('ARCHITECT');$('message').value='Plan system architecture for the current project';}
    else if(txt.includes('Implement')){selectRole('CODER');$('message').value='Implement features and fix bugs';}
    else if(txt.includes('Verify')){selectRole('TESTER');$('message').value='Verify acceptance criteria and run tests';}
    else if(txt.includes('Review')){selectRole('MANAGER');$('message').value='Review pull requests and summarize next steps';}
    $('message').focus();
  }
});
$('prompt-form').onsubmit=async e=>{
  e.preventDefault();notice('');$('send').disabled=true;
  const requestScope=scope;
  try{
    save('model-'+$('engine').value,$('model').value);
    await api('dispatch',{repo:$('repo').value,engine:$('engine').value,model:$('model').value,role:$('role').value,message:$('message').value,
      previous_id:$('followup').checked?lastJob?.id:null,base_url:$('base-url').value,key_env:$('key-env').value,
      session_id:selectedSession(),new_session:sessionMode==='new',new_title:$('session-title').value});
    if(requestScope===scope){save(sessionKey(),selectedSession());if(sessionMode==='new')pendingNewSession=true;$('message').value='';$('message').style.height='';firstPoll=false;await refresh();}
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

$('message').addEventListener('input', function() {
  this.style.height = 'auto';
  this.style.height = Math.min(this.scrollHeight, 200) + 'px';
  if (!this.value) this.style.height = '';
});
$('message').addEventListener('keydown', function(e) {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    if (this.value.trim() && !$('send').disabled) {
      // Simulate form submit logic manually if dispatchEvent doesn't trigger the onsubmit handler properly
      $('send').click();
    }
  }
});

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
