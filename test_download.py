"""Isolated, stdlib-only Edge tests for date selection and native downloads.

Only synthetic history rows and local script bytes are served. The fixture's
download menu records requests without reading account data or contacting
AlphaFold. AF_DOWNLOAD_TEST_CASES selects comma-separated scenarios.
"""

import os
from pathlib import Path
import runpy


CASE = r'''<!doctype html><meta charset="utf-8"><title>Synthetic AF3 download fixture</title>
<style>
body{font:14px sans-serif}gdm-af-history,gdm-af-request,mat-paginator,mat-chip-option{display:block}
button,input{margin:4px}td,th{padding:8px}mat-icon{display:inline-block}
</style>
<gdm-af-request><div class="points">Remaining jobs: 30</div></gdm-af-request>
<gdm-af-history>
<input placeholder="Search History" id="history-search">
<div role="tablist" id="filters">
  <mat-chip-option><button role="option" aria-selected="true" id="completed-filter"><span>Completed</span></button></mat-chip-option>
  <mat-chip-option><button role="option" aria-selected="false" id="draft-filter"><span>Saved draft</span></button></mat-chip-option>
  <mat-chip-option><button role="option" aria-selected="false" id="failed-filter"><span>Failed</span></button></mat-chip-option>
  <mat-chip-option><button role="option" aria-selected="false" id="progress-filter"><span>In progress</span></button></mat-chip-option>
  <mat-chip-option><button role="option" aria-selected="false" id="examples-filter"><span>Examples</span></button></mat-chip-option>
</div>
<div id="native-selection"></div>
<table class="mat-mdc-table">
<thead><tr><th class="mat-column-selected"><input type="checkbox" aria-label="Select all"></th>
<th class="mat-column-status"></th><th class="mat-column-name">Name</th><th class="mat-column-date">Modified</th><th class="mat-column-options"></th></tr></thead>
<tbody id="rows"></tbody></table>
<mat-paginator><select aria-label="Items per page"><option value="2" selected>2</option></select>
<button class="mat-mdc-paginator-navigation-first" aria-label="First page">First</button>
<button class="mat-mdc-paginator-navigation-previous" aria-label="Previous page">Previous</button>
<span class="mat-mdc-paginator-range-label" id="page-range"></span>
<button class="mat-mdc-paginator-navigation-next" aria-label="Next page">Next</button>
<button class="mat-mdc-paginator-navigation-last" aria-label="Last page">Last</button></mat-paginator>
</gdm-af-history>
<div id="overlay"></div><div id="notices"></div>
<script>
'use strict';
const id=new URLSearchParams(location.search).get('id');
localStorage.removeItem('af3-dev-panel-download-format');localStorage.removeItem('af3-dev-panel-download-location');
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const root=()=>document.getElementById('af3-dev-panel')?.shadowRoot;
const ui=name=>root()?.getElementById('af3-'+name)||document.getElementById('af3-'+name);
const assert=(value,message)=>{if(!value)throw Error(message)};
async function until(read,timeout=13000){const end=Date.now()+timeout;while(Date.now()<end){if(read())return;await pause(30)}throw Error('Timed out: '+(ui('download-status')?.textContent||''))}
const state={page:0,pages:[],downloads:[],menus:[],bulkDownloads:[],rowOpens:0,submits:0,clones:0,deletes:0,confirms:0,nativeCheckboxClicks:0,nativeInputChanges:0,nativeClears:0,errors:[],selected:new Set(),visited:[],readiness:[],changes:0,stopTriggered:false,phase:'idle'};
window.confirm=()=>{state.confirms++;return true};
window.alert=()=>{};
window.addEventListener('error',event=>state.errors.push(event.message));
window.addEventListener('unhandledrejection',event=>state.errors.push(String(event.reason)));
document.addEventListener('click',event=>{
 if(event.target.matches('input[type="checkbox"]'))state.nativeCheckboxClicks++;
},true);
const jobs=[
 {id:'newer',name:'outside_newer',modified:'2026-11-14 00:00'},
 {id:'end-late',name:'same_name',modified:'2026-11-13 23:59'},
 {id:'end-early',name:'same_name',modified:'2026-11-13 00:00'},
 {id:'start-late',name:'start_late',modified:'2026-11-12 23:59'},
 {id:'start-early',name:'start_early',modified:'2026-11-12 00:00'},
 {id:'older',name:'outside_older',modified:'2026-11-11 23:59'}
];
if(id==='download-unknown-date')jobs[3]={...jobs[3],modified:'unknown'};
if(id==='download-duplicate')jobs[3]={...jobs[3],name:jobs[2].name,modified:jobs[2].modified};
if(id==='download-stable-ids'||id==='download-official-links')jobs[3]={...jobs[3],name:jobs[2].name,modified:jobs[2].modified};
if(id==='download-calendar-invalid')jobs[3]={...jobs[3],modified:'2026-02-30 12:00'};
if(id==='download-clock-invalid')jobs[3]={...jobs[3],modified:'2026-11-12 24:00'};
if(id==='download-stable-collision')jobs[3]={...jobs[3],id:jobs[2].id};
if(id==='download-preselection')state.selected.add('older');
if(id==='download-combined-preselection'){state.selected.add('older');state.selected.add('hidden-old-selection')}
if(id==='download-combined-limit'||id==='download-combined-fifty'){
 const count=id==='download-combined-limit'?51:50;
 jobs.splice(0,jobs.length,...Array.from({length:count},(_,index)=>({id:'many-'+index,name:'batch_'+index,modified:'2026-11-13 12:00'})));
}
const pageSize=id==='download-combined-limit'||id==='download-combined-fifty'?20:2;
const pageOption=document.querySelector('mat-paginator select option');pageOption.value=String(pageSize);pageOption.textContent=String(pageSize);
state.pages=Array.from({length:Math.ceil(jobs.length/pageSize)},(_,index)=>jobs.slice(index*pageSize,(index+1)*pageSize));
if(id==='download-reset-first')state.page=2;
function recordReadiness(){const text=ui('download-ready-text')?.textContent;if(text)state.readiness.push(text)}
function nativeCheckbox(jobId){return Array.from(document.querySelectorAll('tbody tr')).find(row=>row.dataset.fixtureJob===jobId)?.querySelector('.mat-column-selected input')}
function nativeNotice(text){const notice=document.createElement('div');notice.setAttribute('role','status');notice.className='mat-mdc-snack-bar-label';notice.textContent=text;document.getElementById('notices').append(notice)}
function renderNativeSelection(){
 const target=document.getElementById('native-selection');target.replaceChildren();
 for(const row of document.querySelectorAll('tbody tr')){const checkbox=row.querySelector('.mat-column-selected input');if(checkbox)checkbox.checked=state.selected.has(row.dataset.fixtureJob)}
 if(!state.selected.size)return;
 const row=document.createElement('div');row.className='row';
 const clear=document.createElement('button');clear.setAttribute('aria-label','Clear selection');
 const close=document.createElement('mat-icon');close.textContent='close';clear.append(close);
 clear.onclick=()=>{state.nativeClears++;state.selected.clear();renderNativeSelection()};row.append(clear);
 row.append(document.createTextNode(' '+state.selected.size+' selected '));
 const right=document.createElement('div');right.className='right';row.append(right);
 const download=document.createElement('button');download.className='download-button';download.textContent='Download';download.disabled=state.selected.size>50;
 download.onclick=()=>{
  recordReadiness();const selection=[...state.selected];state.bulkDownloads.push(selection);state.downloads.push(...selection);
  nativeNotice('Preparing '+selection.length+' jobs...');
  setTimeout(()=>nativeNotice('Downloading '+selection.length+' jobs.'),90);
  if(id==='download-combined-browser-save'){
   const anchor=document.createElement('a');anchor.href='data:application/zip;base64,UEsFBgAAAAAAAAAAAAAAAAAAAAAAAA==';anchor.download='combined.zip';document.body.append(anchor);anchor.click();anchor.remove();
  }
 };right.append(download);
 const remove=document.createElement('button');remove.className='delete-button';remove.textContent='Delete';remove.onclick=()=>state.deletes++;right.append(remove);
 const clone=document.createElement('button');clone.textContent='Clone and reuse';clone.onclick=()=>state.clones++;right.append(clone);
 target.append(row);
}
function nativeSelectionChanged(job,checkbox){
 state.nativeInputChanges++;checkbox.checked?state.selected.add(job.id):state.selected.delete(job.id);renderNativeSelection();recordReadiness();
 if(state.phase!=='active'||state.stopTriggered)return;
 if(id==='download-combined-stop'||id==='download-website-stop'){
  state.stopTriggered=true;setTimeout(()=>ui('download-stop').click(),10);
 }
 if(id==='download-combined-native-change'){
  state.stopTriggered=true;const outside=nativeCheckbox('newer');setTimeout(()=>outside?.click(),10);
 }
}
function setFilter(name){
 for(const element of document.querySelectorAll('#filters button'))element.setAttribute('aria-selected',String(element.id===name+'-filter'));
}
for(const element of document.querySelectorAll('#filters button'))element.onclick=()=>setFilter(element.id.replace('-filter',''));
function renderRows(){
 state.visited.push(state.page);
 const body=document.getElementById('rows');body.replaceChildren();
 for(const job of state.pages[state.page]){
  const row=document.createElement('tr');row.className='mat-mdc-row';row.dataset.fixtureJob=job.id;
  if(id==='download-stable-ids'||id==='download-stable-collision'||id==='download-changed-metadata')row.setAttribute('data-job-id',job.id);
  const select=document.createElement('td');select.className='mat-column-selected';
  const wrapper=document.createElement('mat-checkbox');wrapper.className='mat-mdc-checkbox';
  const checkbox=document.createElement('input');checkbox.type='checkbox';checkbox.className='mdc-checkbox__native-control';checkbox.checked=state.selected.has(job.id);
  checkbox.onclick=event=>event.stopPropagation();checkbox.onchange=()=>nativeSelectionChanged(job,checkbox);wrapper.append(checkbox);select.append(wrapper);
  const name=document.createElement('td');name.className='mat-column-name';
  const statusCell=document.createElement('td');statusCell.className='mat-column-status';
  const status=document.createElement('mat-icon');status.textContent='check_circle';status.setAttribute('aria-label','Completed');statusCell.append(status);
  const label=document.createElement('span');label.textContent=job.name;name.append(label);
  const modified=document.createElement('td');modified.className='mat-column-date';modified.textContent=job.modified;
  const menuCell=document.createElement('td');menuCell.className='mat-column-options';const menu=document.createElement('button');
  menu.className='mat-mdc-menu-trigger';menu.setAttribute('aria-label','More options');
  menu.setAttribute('aria-controls','native-menu-'+job.id);menu.setAttribute('aria-expanded','false');
  if(id==='download-partial-error'&&job.id==='end-early')menu.disabled=true;
  const icon=document.createElement('mat-icon');icon.textContent='more_vert';menu.append(icon);menuCell.append(menu);
  row.append(select,statusCell,name,modified,menuCell);body.append(row);
  if(id==='download-official-links'){
   const link=document.createElement('a');link.setAttribute('href','/fold/'+job.id);link.textContent='Open job';row.append(link);
  }
  row.onclick=()=>state.rowOpens++;
  menu.onclick=event=>{
   event.stopPropagation();
   if(menu.getAttribute('aria-expanded')==='true'){document.getElementById('native-menu-'+job.id)?.remove();menu.setAttribute('aria-expanded','false');return}
   state.menus.push(job.id);
   recordReadiness();
   if(id==='download-unrelated-menu')return;
   menu.setAttribute('aria-expanded','true');
   const overlay=document.getElementById('overlay');overlay.replaceChildren();
   const panel=document.createElement('div');panel.id='native-menu-'+job.id;panel.className='mat-mdc-menu-panel';panel.setAttribute('role','menu');
   for(const [label,action] of [['Download',()=>{
     state.downloads.push(job.id);overlay.replaceChildren();menu.setAttribute('aria-expanded','false');
     if((id==='download-stop'||id==='download-stop-restart')&&!state.stopTriggered){state.stopTriggered=true;queueMicrotask(()=>ui('download-stop').click())}
     if(id==='download-website-web-stop'&&!state.stopTriggered){state.stopTriggered=true;queueMicrotask(()=>ui('download-web-stop').click())}
   }],['Clone and reuse',()=>state.clones++],['Delete',()=>state.deletes++]]){
    const button=document.createElement(label==='Download'?'a':'button');button.setAttribute('role','menuitem');button.className='mat-mdc-menu-item';button.textContent=label;
    if(label==='Download'){button.href='data:application/zip;base64,UEsFBgAAAAAAAAAAAAAAAAAAAAAAAA==';button.download=job.id+'.zip'}
    button.onclick=event=>{if(id!=='download-browser-save')event.preventDefault();action()};panel.append(button);
   }
   overlay.append(panel);
   if(id==='download-stop-menu')queueMicrotask(()=>ui('download-stop').click());
   if(id==='download-menu-context-change')setFilter('draft');
   if(id==='download-menu-metadata-change'){job.modified='2026-11-13 22:59';renderRows()}
  };
 }
 const first=document.querySelector('[aria-label="First page"]');
 const previous=document.querySelector('[aria-label="Previous page"]');
 const next=document.querySelector('[aria-label="Next page"]');
 const last=document.querySelector('[aria-label="Last page"]');
 first.disabled=previous.disabled=state.page===0;
 next.disabled=last.disabled=state.page===state.pages.length-1;
 document.getElementById('page-range').textContent=(state.page*pageSize+1)+' – '+Math.min(jobs.length,state.page*pageSize+pageSize)+' of '+jobs.length;
 renderNativeSelection();
}
function changePage(target){
 state.changes++;
 recordReadiness();
 if(id==='download-combined-context-change'&&state.phase==='active'&&!state.stopTriggered){state.stopTriggered=true;setTimeout(()=>setFilter('draft'),80)}
 if(id==='download-stale-page')return;
 if(id==='download-loading-page'){
  const table=document.querySelector('gdm-af-history table'),paginator=document.querySelector('mat-paginator');
  const spinner=document.createElement('mat-spinner');spinner.style.cssText='display:block;width:20px;height:20px';
  table.before(spinner);table.remove();paginator.remove();
  setTimeout(()=>{spinner.replaceWith(table,paginator);state.page=target;renderRows()},350);
  return;
 }
 if(id==='download-loading-paginator'){
  const paginator=document.querySelector('mat-paginator');
  const spinner=document.createElement('mat-spinner');spinner.style.cssText='display:block;width:20px;height:20px';
  paginator.replaceWith(spinner);
  setTimeout(()=>{spinner.replaceWith(paginator);state.page=target;renderRows()},350);
  return;
 }
 if(id==='download-repeating-page'&&state.page===1&&target===2)target=0;
 const wait=id==='download-stop-scan'||id==='download-context-change'||id==='download-busy'?500:75;
 if(id==='download-stop-scan')setTimeout(()=>ui('download-stop').click(),80);
 if(id==='download-context-change')setTimeout(()=>setFilter('draft'),80);
 if(id==='download-busy')setTimeout(()=>{
  const start=ui('v20-btn');start.disabled=false;start.click();
 },80);
 setTimeout(()=>{state.page=target;renderRows()},wait);
}
document.querySelector('[aria-label="First page"]').onclick=()=>changePage(0);
document.querySelector('[aria-label="Previous page"]').onclick=()=>changePage(Math.max(0,state.page-1));
document.querySelector('[aria-label="Next page"]').onclick=()=>changePage(Math.min(state.pages.length-1,state.page+1));
document.querySelector('[aria-label="Last page"]').onclick=()=>changePage(state.pages.length-1);
const selectAll=document.querySelector('thead input[type=checkbox]');selectAll.onclick=event=>event.stopPropagation();
selectAll.onchange=()=>{for(const job of state.pages[state.page])selectAll.checked?state.selected.add(job.id):state.selected.delete(job.id);renderNativeSelection()};
if(id==='download-noncompleted')setFilter('draft');
if(id==='download-examples-filter')document.getElementById('examples-filter').setAttribute('aria-selected','true');
renderRows();
if(id==='download-unrelated-menu'){
 const stale=document.createElement('div');stale.className='mat-mdc-menu-panel';stale.id='unrelated-native-menu';stale.setAttribute('role','menu');
 const download=document.createElement('a');download.href='data:application/zip;base64,UEsFBgAAAAAAAAAAAAAAAAAAAAAAAA==';download.setAttribute('role','menuitem');download.className='mat-mdc-menu-item';download.textContent='Download';
 download.onclick=event=>{event.preventDefault();state.downloads.push('UNRELATED')};stale.append(download);document.body.append(stale);
}
if(id==='download-empty-history'){
 document.querySelector('table').remove();document.querySelector('mat-paginator').remove();
 const empty=document.createElement('div');empty.className='no-results';empty.textContent='No jobs found with filters specified';document.querySelector('gdm-af-history').append(empty);
}
const reviewChecks=()=>Array.from(ui('download-results').querySelectorAll('input[type="checkbox"][data-job-key]'));
const selectedReview=()=>reviewChecks().filter(element=>element.checked);
async function scan(start='2026-11-12',end='2026-11-13'){
 ui('download-start').value=start;ui('download-end').value=end;
 ui('download-start').dispatchEvent(new Event('change',{bubbles:true}));
 ui('download-end').dispatchEvent(new Event('change',{bubbles:true}));
 ui('download-scan').click();await pause(60);
 await until(()=>!ui('download-scan').disabled);
 await pause(60);
}
async function download(){ui('download-run').click();await pause(50);await until(()=>!ui('download-scan').disabled);await pause(700)}
function choose(name,value){const control=ui('download-'+name);assert(control,'Missing download '+name+' control');control.value=value;control.dispatchEvent(new Event('change',{bubbles:true}))}
async function webDownload(){await until(()=>ui('download-web-run')&&!ui('download-web-run').disabled);ui('download-web-run').click();await pause(50);await until(()=>!ui('download-scan').disabled);await pause(700)}
async function visit(page){if(page===state.page)return;changePage(page);await until(()=>state.page===page);await pause(80)}
const newModes=new Set(['download-combined','download-combined-day','download-combined-preselection','download-combined-limit','download-combined-fifty','download-website-apply','download-website-manual','download-website-individual','download-website-no-scan','download-website-hidden','download-mode-change','download-ready-states','download-combined-stop','download-website-stop','download-combined-context-change','download-combined-native-change','download-website-scan-context','download-website-web-stop']);
(async()=>{
 const script=document.createElement('script');script.src='/script.js';
 await new Promise((resolve,reject)=>{script.onload=resolve;script.onerror=()=>reject(Error('Cannot load userscript'));document.head.append(script)});
 await until(()=>ui('download-section'),5000);ui('download-section').open=true;
 if(newModes.has(id)){
  assert(ui('download-format')?.value==='individual','Individual download format is not the default');
  assert(ui('download-location')?.value==='panel','Panel download location is not the default');
  assert(ui('download-ready-text'),'Download readiness indicator is missing');
  if(id==='download-ready-states'){
   await until(()=>/就绪|ready/i.test(ui('download-ready-text').textContent));
   setFilter('draft');await until(()=>/待命|待机|等待|waiting|standby/i.test(ui('download-ready-text').textContent));
   setFilter('completed');await until(()=>/就绪|ready/i.test(ui('download-ready-text').textContent));
   await scan();
   assert(state.readiness.some(text=>/运行|进行|正在|running|loading|scanning|applying|downloading/i.test(text)),'Scan never displayed running download state: '+state.readiness);
   await until(()=>/就绪|ready/i.test(ui('download-ready-text').textContent));
  }else if(id==='download-website-no-scan'||id==='download-website-hidden'||id==='download-website-web-stop'){
   choose('location','website');choose('format',id==='download-website-web-stop'?'individual':'combined');
   assert(reviewChecks().length===0,'Website run without scan invented panel results');
   if(id==='download-website-hidden'){state.selected.add('hidden-outside-current-history');renderNativeSelection()}
   else if(id==='download-website-web-stop'){nativeCheckbox('end-late').click();await visit(1);nativeCheckbox('end-early').click()}
   else{await visit(2);nativeCheckbox('older').click()}
   await until(()=>ui('download-web-run'));await webDownload();
   if(id==='download-website-hidden'){
    assert(state.downloads.length===0&&state.bulkDownloads.length===0,'Unresolved global native selection was downloaded');
    assert(state.nativeClears===0&&state.selected.has('hidden-outside-current-history'),'Count mismatch unexpectedly cleared native selection');
   }else if(id==='download-website-web-stop'){
    assert(state.stopTriggered&&state.downloads.join(',')==='end-late','Website Stop did not prevent later native downloads');
    assert(ui('download-web-stop').hidden,'Website Stop remained visible after operation ended');
    assert(/停止|stopp/i.test(document.querySelector('#af3-download-web-controls [data-web-result]').textContent),'Website toolbar did not mirror stop result');
   }else{
    assert(state.bulkDownloads.length===1&&state.downloads.join(',')==='older','Website selection without scan used the date range or wrong targets: '+state.downloads);
    assert(state.selected.has('older'),'Website combined lost manual native selection');
   }
  }else{
   if(id.startsWith('download-combined'))choose('format','combined');
   if(id.startsWith('download-website')){choose('location','website');if(id!=='download-website-individual')choose('format','combined')}
   await scan();
   const expected=id==='download-combined-limit'||id==='download-combined-fifty'?jobs.length:4;
   assert(reviewChecks().length===expected,'Mode scan found wrong task count: '+reviewChecks().length);
   assert(state.downloads.length===0&&state.nativeCheckboxClicks===0&&state.nativeClears===0,'Scanning modified native selections or downloaded files');
   if(id==='download-website-scan-context'){
    choose('location','website');document.getElementById('history-search').value='new current website search';
    await visit(2);nativeCheckbox('older').click();await webDownload();
    assert(state.downloads.join(',')==='older','Current website context did not download native selection');
    const priorMenus=state.menus.length,priorConfirms=state.confirms;
    choose('location','panel');await download();
    assert(state.downloads.join(',')==='older'&&state.menus.length===priorMenus&&state.confirms===priorConfirms,'Website run overwrote scan context and allowed stale panel results');
    assert(selectedReview().length===4,'Rejecting old scan lost review selection');
   }else if(id==='download-mode-change'){
    choose('format','combined');choose('location','website');
    assert(selectedReview().length===4,'Packing or location change lost reviewed selections');
    assert(/网页|website|page/i.test(ui('download-run').textContent),'Website mode did not change panel action into native selection');
    await until(()=>ui('download-web-run'));choose('location','panel');
    assert(selectedReview().length===4,'Returning to panel lost reviewed selections');
   }else if(id==='download-combined-limit'){
    await download();
    assert(state.downloads.length===0&&state.nativeCheckboxClicks===0&&state.nativeClears===0,'Combined >50 selected or downloaded jobs');
    assert(/50/.test(ui('download-status').textContent+' '+ui('download-ready-text').textContent),'Combined >50 did not explain the native limit');
   }else if(id==='download-website-apply'||id==='download-website-manual'||id==='download-website-individual'||id==='download-website-stop'){
    if(id==='download-website-apply'){state.selected.add('hidden-before-apply');state.selected.add('older');renderNativeSelection()}
    state.phase='active';await download();
    assert(state.downloads.length===0&&state.bulkDownloads.length===0,'Website apply started a file download');
    if(id==='download-website-stop'){
     assert(state.stopTriggered,'Stop during website selection was not exercised');
    }else{
     assert([...state.selected].sort().join(',')==='end-early,end-late,start-early,start-late','Website apply did not replace native selection with reviewed tasks: '+[...state.selected]);
     if(id==='download-website-apply'){
      assert(state.nativeClears>=1,'Website apply did not globally clear hidden prior selections');
      assert(!ui('download-web-run').disabled,'Website native selection was not ready for manual download');
     }else{
      await visit(0);nativeCheckbox('end-late').click();
      await visit(2);nativeCheckbox('older').click();
      if(id==='download-website-manual'){await visit(0);nativeCheckbox('newer').click();await visit(1);nativeCheckbox('end-early').click()}
      const selected=[...state.selected].sort().join(',');
      await webDownload();
      assert(state.downloads.slice().sort().join(',')===selected,'Website run ignored current manual checkbox choices: '+state.downloads+' expected '+selected);
      assert([...state.selected].sort().join(',')===selected,'Website download changed manual native selection');
      assert(state.bulkDownloads.length===(id==='download-website-manual'?1:0),'Website run used the wrong packing format');
     }
    }
   }else{
    if(id==='download-combined-day')ui('download-results').querySelector('input[data-day="2026-11-13"]').click();
    state.phase='active';await download();
    if(['download-combined-stop','download-combined-context-change','download-combined-native-change'].includes(id)){
     assert(state.stopTriggered,'Combined interruption was not exercised');
     assert(state.bulkDownloads.length===0&&state.downloads.length===0,'Combined interruption still issued a ZIP download');
    }else{
     const expectedIds=(id==='download-combined-day'?['start-late','start-early']:jobs.filter(job=>job.modified>='2026-11-12'&&job.modified<'2026-11-14').map(job=>job.id)).sort().join(',');
     assert(state.bulkDownloads.length===1,'Combined mode did not issue exactly one native bulk action');
     assert(state.downloads.slice().sort().join(',')===expectedIds,'Combined ZIP contained wrong native selection: '+state.downloads);
     assert([...state.selected].sort().join(',')===expectedIds,'Combined ZIP did not retain its exact native selection');
     assert(selectedReview().length===0,'Initiated combined tasks remained selected in the panel');
     assert(state.menus.length===0,'Combined mode opened individual task menus');
     if(id==='download-combined-preselection')assert(state.nativeClears>=1,'Combined mode did not globally clear hidden prior selections');
    }
   }
  }
 }else if(id==='download-invalid-range'){
  await scan('2026-11-14','2026-11-12');
  assert(state.changes===0,'Reversed range traversed native pages');
  assert(ui('download-run').disabled,'Reversed range enabled downloads');
  await scan('','2026-11-13');
  assert(state.changes===0&&ui('download-run').disabled,'Empty range did not remain invalid');
 }else if(id==='download-single-day'){
  await scan('2026-11-13','2026-11-13');
  assert(reviewChecks().length===2,'Same-day selection missed day boundary rows');
  await download();assert(state.downloads.slice().sort().join(',')==='end-early,end-late','Same-day native downloads were wrong: '+state.downloads);
 }else if(id==='download-zero'||id==='download-empty-history'){
  await scan('2020-01-01','2020-01-01');
  assert(reviewChecks().length===0&&ui('download-run').disabled,'Zero matches enabled download or invented results');
 }else if(['download-duplicate','download-stable-collision','download-stale-page','download-repeating-page','download-stop-scan','download-context-change','download-noncompleted','download-examples-filter'].includes(id)){
  await scan();assert(ui('download-run').disabled,'Incomplete, ambiguous or unsupported scan enabled download');
  assert(state.downloads.length===0,'Scan unexpectedly downloaded a job');
 }else{
  await scan();
  const expected=['download-unknown-date','download-calendar-invalid','download-clock-invalid'].includes(id)?3:4;
  assert(reviewChecks().length===expected,'Wrong range count: '+reviewChecks().length+' expected '+expected);
  assert(state.downloads.length===0&&state.menus.length===0,'Scanning opened a menu or downloaded results');
  assert(new Set(state.visited).size===3,'Scan did not visit all three pages');
  if(id==='download-unknown-date'||id==='download-calendar-invalid'||id==='download-clock-invalid'){
   assert(/无法|识别|未知|unknown|unreadable|invalid/i.test(ui('download-status').textContent),'Unrecognized date was not reported');
  }else if(id==='download-select'){
   ui('download-clear').click();assert(selectedReview().length===0&&ui('download-run').disabled,'Clear selection did not disable downloads');
   ui('download-all').click();assert(selectedReview().length===4,'Select all did not restore all matches');
   const one=reviewChecks()[0];one.click();assert(selectedReview().length===3,'Individual task deselection failed');
   await download();assert(state.downloads.length===3,'Deselected task was downloaded or other selection lost');
  }else if(id==='download-day-selection'){
   const day=ui('download-results').querySelector('input[data-day="2026-11-13"]');
   assert(day,'Day selection checkbox is missing');day.click();
   assert(selectedReview().length===2,'Day checkbox did not deselect the entire day');
   await download();assert(state.downloads.slice().sort().join(',')==='start-early,start-late','Deselected day leaked into native downloads: '+state.downloads);
  }else if(id==='download-busy'){
   assert(state.confirms===0,'Submission handler bypassed busy exclusion during scan');
  }else if(id==='download-changed-range'){
   ui('download-start').value='2026-11-13';ui('download-start').dispatchEvent(new Event('change',{bubbles:true}));
   await download();
   assert(state.menus.length===0&&state.downloads.length===0&&state.confirms===0,'Changed date range reused the prior scan');
   assert(reviewChecks().length===0&&ui('download-run').disabled,'Changed date range retained actionable prior results');
  }else if(id==='download-changed-filter'||id==='download-changed-search'){
   if(id==='download-changed-filter')setFilter('draft');else document.getElementById('history-search').value='changed after scan';
   await download();
   assert(state.menus.length===0&&state.downloads.length===0&&state.confirms===0,'Changed history context still opened download controls');
   assert(selectedReview().length===4,'Changed history context lost review selections');
  }else if(id==='download-changed-metadata'||id==='download-changed-fallback'){
   ui('download-clear').click();
   const selected=reviewChecks().find(element=>element.dataset.jobKey===(id==='download-changed-metadata'?'id:end-late':'row:'+JSON.stringify([jobs[1].name,jobs[1].modified])));
   assert(selected,'Cannot identify changed target in review');selected.click();
   jobs[1].modified='2026-11-13 22:59';renderRows();
   await download();
   assert(state.downloads.length===0,'Changed task identity still initiated a download');
   assert(selectedReview().length===1,'Changed identity lost its pending review selection');
  }else if(id==='download-partial-error'){
   await download();
   assert(state.downloads.join(',')==='end-late','Partial menu failure issued unexpected downloads: '+state.downloads);
   assert(selectedReview().length===3,'Partial failure lost pending selections or retained an initiated task');
   assert(/(?:发起|started|initiated|requested)\D*1(?:\D|$)/i.test(ui('download-status').textContent),'Partial failure lost initiated count: '+ui('download-status').textContent);
  }else if(id==='download-stop-menu'){
   await download();
   assert(state.menus.length===1&&state.downloads.length===0,'Stop after opening menu still clicked Download');
   assert(selectedReview().length===4,'Stop before Download lost review selections');
  }else if(id==='download-unrelated-menu'){
   await download();
   assert(state.menus.length===1&&state.downloads.length===0,'Failed target menu clicked an unrelated visible Download anchor');
   assert(selectedReview().length===4,'Unavailable target menu lost pending review selections');
  }else if(id==='download-menu-context-change'||id==='download-menu-metadata-change'){
   await download();
   assert(state.menus.length===1&&state.downloads.length===0,'Task or context change while menu was open still clicked Download');
   assert(selectedReview().length===4,'Menu race lost pending review selections');
  }else if(id==='download-stop-restart'){
   await download();assert(state.downloads.length===1,'Stop did not interrupt first download run');
   assert(selectedReview().length===3,'Stopped run lost pending review selections');
   await download();assert(state.downloads.length===4,'Restart did not download the three remaining tasks');
   assert(selectedReview().length===0,'Successful restart retained initiated tasks');
  }else if(id==='download-late-preselection'){
   state.selected.add('older');renderRows();
   await download();assert(state.downloads.slice().sort().join(',')==='end-early,end-late,start-early,start-late','Native selection contaminated review downloads');
  }else if(id==='download-browser-save'){
   ui('download-clear').click();reviewChecks()[0].click();await download();
   assert(state.downloads.length===1,'Synthetic zip download did not issue exactly one action');
  }else if(id==='download-stop'){
   await download();assert(state.downloads.length===1,'Stop did not prevent later downloads: '+state.downloads);
  }else{
   await download();assert(state.downloads.slice().sort().join(',')==='end-early,end-late,start-early,start-late','Date range native downloads were wrong: '+state.downloads);
  }
 }
 assert(state.submits===0&&state.clones===0&&state.deletes===0&&state.rowOpens===0,'Download flow triggered unrelated native action: '+JSON.stringify(state));
 assert(new Set(state.downloads).size===state.downloads.length,'A native download was clicked twice');
 if(!newModes.has(id)){
  assert(state.selected.size===(id==='download-preselection'||id==='download-late-preselection'?1:0),'Native checkbox selection was modified');
  assert(state.nativeCheckboxClicks===0&&state.nativeClears===0,'Individual panel flow changed native history selection');
 }
 if(state.downloads.length)assert(/发起|started|initiated|requested/i.test(ui('download-status').textContent),'Download status claimed completion instead of reporting initiated requests');
 assert(state.errors.length===0,state.errors.join('; '));
 parent.postMessage({type:'af3-case-result',result:{passed:true,message:'native jobs='+state.downloads.length+', ZIP actions='+state.bulkDownloads.length+', native input changes='+state.nativeInputChanges+', submits/clones/deletes=0'}},location.origin);
})().catch(error=>parent.postMessage({type:'af3-case-result',result:{passed:false,message:error.message}},location.origin));
</script>'''


SCENARIOS = [
    'download-range', 'download-reset-first', 'download-single-day', 'download-select',
    'download-day-selection', 'download-zero', 'download-invalid-range',
    'download-unknown-date', 'download-calendar-invalid', 'download-duplicate',
    'download-preselection', 'download-noncompleted', 'download-stop-scan',
    'download-context-change', 'download-busy', 'download-stop',
    'download-stale-page', 'download-repeating-page', 'download-stable-ids',
    'download-changed-filter', 'download-changed-search', 'download-changed-metadata',
    'download-changed-fallback', 'download-partial-error', 'download-stop-menu',
    'download-stop-restart', 'download-late-preselection', 'download-examples-filter',
    'download-browser-save', 'download-clock-invalid', 'download-empty-history',
    'download-stable-collision',
    'download-changed-range', 'download-menu-context-change', 'download-menu-metadata-change',
    'download-loading-page',
    'download-unrelated-menu',
    'download-loading-paginator', 'download-official-links',
    'download-combined', 'download-combined-day', 'download-combined-preselection',
    'download-combined-limit', 'download-combined-fifty', 'download-website-apply',
    'download-website-manual', 'download-website-individual', 'download-website-no-scan',
    'download-website-hidden', 'download-mode-change', 'download-ready-states',
    'download-combined-stop', 'download-website-stop', 'download-combined-context-change',
    'download-combined-native-change',
    'download-website-scan-context',
    'download-website-web-stop',
]


def main():
    harness = runpy.run_path(str(Path(__file__).with_name('test_submission.py')))
    runner = harness['main']
    runner.__globals__.update(
        CASE=CASE,
        SCENARIOS=SCENARIOS,
        PAGE=harness['PAGE'].replace('85000', '20000').replace('85 seconds', '20 seconds'),
    )
    os.environ['AF_TEST_CASES'] = os.environ.get('AF_DOWNLOAD_TEST_CASES', ','.join(SCENARIOS))
    runner()


if __name__ == '__main__':
    main()
