"""Account-free browser tests for date selection and native checkbox application.

The script may scan pages and apply reviewed website selections. It must never
open a download menu, click a download button, or transfer a file. Only explicit
manual-native scenarios click synthetic website Download controls afterward.
AF_DOWNLOAD_TEST_CASES selects comma-separated scenarios.
"""

import os
from pathlib import Path
import runpy


CASE = r'''<!doctype html><meta charset="utf-8"><title>Synthetic AF3 selection fixture</title>
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
const restore=new URLSearchParams(location.search).get('restore');
const formatKey='af3-dev-panel-download-format';
if(id==='download-format-default')localStorage.setItem(formatKey,'unsupported-format');
if(id==='download-format-persistence'&&!restore)localStorage.removeItem(formatKey);
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const root=()=>document.getElementById('af3-dev-panel')?.shadowRoot;
const ui=name=>root()?.getElementById('af3-'+name)||document.getElementById('af3-'+name);
const assert=(value,message)=>{if(!value)throw Error(message)};
async function until(read,timeout=15000){const end=Date.now()+timeout;while(Date.now()<end){if(read())return;await pause(30)}throw Error('Timed out: '+(ui('download-status')?.textContent||''))}
const state={page:0,pages:[],downloads:[],menus:[],bulkDownloads:[],rowOpens:0,submits:0,clones:0,deletes:0,confirms:0,nativeCheckboxClicks:0,nativeInputChanges:0,nativeClears:0,errors:[],transportCalls:[],selected:new Set(),visited:[],readiness:[],changes:0,stopTriggered:false,phase:'idle'};
let manualActions=0,manualRecords=0;
window.confirm=()=>{state.confirms++;if(id==='download-confirm-context-change')setFilter('draft');return id!=='download-cancel-apply'};
window.alert=()=>{};
window.addEventListener('error',event=>state.errors.push(event.message));
window.addEventListener('unhandledrejection',event=>state.errors.push(String(event.reason)));
for(const name of ['fetch','GM_xmlhttpRequest','GM_download'])window[name]=()=>{state.transportCalls.push(name);throw Error('Script attempted independent '+name)};
XMLHttpRequest.prototype.open=function(){state.transportCalls.push('XMLHttpRequest');throw Error('Script attempted independent XMLHttpRequest')};
navigator.sendBeacon=()=>{state.transportCalls.push('sendBeacon');throw Error('Script attempted independent sendBeacon')};
URL.createObjectURL=()=>{state.transportCalls.push('createObjectURL');throw Error('Script created a download URL')};
document.addEventListener('click',event=>{if(event.target.matches('input[type="checkbox"]'))state.nativeCheckboxClicks++},true);
const jobs=[
 {id:'newer',name:'outside_newer',modified:'2026-11-14 00:00'},
 {id:'end-late',name:'same_name',modified:'2026-11-13 23:59'},
 {id:'end-early',name:'same_name',modified:'2026-11-13 00:00'},
 {id:'start-late',name:'start_late',modified:'2026-11-12 23:59'},
 {id:'start-early',name:'start_early',modified:'2026-11-12 00:00'},
 {id:'older',name:'outside_older',modified:'2026-11-11 23:59'}
];
if(id==='download-unknown-date')jobs[3]={...jobs[3],modified:'unknown'};
if(['download-duplicate','download-stable-ids','download-official-links'].includes(id))jobs[3]={...jobs[3],name:jobs[2].name,modified:jobs[2].modified};
if(id==='download-calendar-invalid')jobs[3]={...jobs[3],modified:'2026-02-30 12:00'};
if(id==='download-clock-invalid')jobs[3]={...jobs[3],modified:'2026-11-12 24:00'};
if(id==='download-stable-collision')jobs[3]={...jobs[3],id:jobs[2].id};
if(['download-preselection','download-cancel-apply','download-clear-failure','download-confirm-context-change','download-individual-preselection'].includes(id)){state.selected.add('older');state.selected.add('hidden-old-selection')}
if(id==='download-over-fifty')jobs.splice(0,jobs.length,...Array.from({length:51},(_,index)=>({id:'many-'+index,name:'batch_'+index,modified:'2026-11-13 12:00'})));
const pageSize=id==='download-over-fifty'?20:2;
const pageOption=document.querySelector('mat-paginator select option');pageOption.value=String(pageSize);pageOption.textContent=String(pageSize);
state.pages=Array.from({length:Math.ceil(jobs.length/pageSize)},(_,index)=>jobs.slice(index*pageSize,(index+1)*pageSize));
if(id==='download-reset-first')state.page=2;
function recordReadiness(){const text=ui('download-ready-text')?.textContent;if(text)state.readiness.push(text)}
function nativeCheckbox(jobId){return Array.from(document.querySelectorAll('tbody tr')).find(row=>row.dataset.fixtureJob===jobId)?.querySelector('.mat-column-selected input')}
function setFilter(name){for(const element of document.querySelectorAll('#filters button'))element.setAttribute('aria-selected',String(element.id===name+'-filter'))}
for(const element of document.querySelectorAll('#filters button'))element.onclick=()=>setFilter(element.id.replace('-filter',''));
function renderNativeSelection(){
 const target=document.getElementById('native-selection');target.replaceChildren();
 for(const row of document.querySelectorAll('tbody tr')){const checkbox=row.querySelector('.mat-column-selected input');if(checkbox)checkbox.checked=state.selected.has(row.dataset.fixtureJob)}
 if(!state.selected.size)return;
 const row=document.createElement('div');row.className='row';
 const clear=document.createElement('button');clear.setAttribute('aria-label','Clear selection');
 const close=document.createElement('mat-icon');close.textContent='close';clear.append(close);
 clear.onclick=()=>{state.nativeClears++;if(id!=='download-clear-failure')state.selected.clear();renderNativeSelection()};row.append(clear);
 row.append(document.createTextNode(' '+state.selected.size+' selected '));
 const right=document.createElement('div');right.className='right';row.append(right);
 const download=document.createElement('button');download.className='download-button';download.textContent='Download';download.disabled=state.selected.size>50;
 download.onclick=()=>{
  const selection=[...state.selected];state.bulkDownloads.push(selection);state.downloads.push(...selection);
  if(id==='download-manual-native-save'){
   const anchor=document.createElement('a');anchor.href='data:application/zip;base64,UEsFBgAAAAAAAAAAAAAAAAAAAAAAAA==';anchor.download='official-manual.zip';document.body.append(anchor);anchor.click();anchor.remove();
  }
 };right.append(download);
 const remove=document.createElement('button');remove.className='delete-button';remove.textContent='Delete';remove.onclick=()=>state.deletes++;right.append(remove);
 const clone=document.createElement('button');clone.textContent='Clone and reuse';clone.onclick=()=>state.clones++;right.append(clone);
 target.append(row);
}
function nativeSelectionChanged(job,checkbox){
 state.nativeInputChanges++;checkbox.checked?state.selected.add(job.id):state.selected.delete(job.id);renderNativeSelection();recordReadiness();
 if(id==='download-individual-stop-next'&&state.phase==='next'&&!state.stopTriggered){state.stopTriggered=true;setTimeout(()=>ui('download-stop').click(),10);return}
 if(state.phase!=='active'||state.stopTriggered)return;
 if(['download-stop-apply','download-stop-restart','download-apply-native-change','download-apply-context-change','download-apply-metadata-change','download-apply-offpage-metadata-change'].includes(id)){
  state.stopTriggered=true;
  setTimeout(()=>{
   if(id==='download-apply-native-change')nativeCheckbox('newer')?.click();
   else if(id==='download-apply-context-change')setFilter('draft');
   else if(id==='download-apply-metadata-change'||id==='download-apply-offpage-metadata-change'){jobs[id==='download-apply-metadata-change'?1:2].modified='2026-11-13 22:59';renderRows()}
   else ui('download-stop').click();
  },10);
 }
}
function renderRows(){
 state.visited.push(state.page);const body=document.getElementById('rows');body.replaceChildren();
 for(const job of state.pages[state.page]){
  const row=document.createElement('tr');row.className='mat-mdc-row';row.dataset.fixtureJob=job.id;
  if(['download-stable-ids','download-stable-collision','download-changed-metadata'].includes(id))row.setAttribute('data-job-id',job.id);
  const select=document.createElement('td');select.className='mat-column-selected';
  const wrapper=document.createElement('mat-checkbox');wrapper.className='mat-mdc-checkbox';
  const checkbox=document.createElement('input');checkbox.type='checkbox';checkbox.className='mdc-checkbox__native-control';checkbox.checked=state.selected.has(job.id);
  if((id==='download-partial-error'||state.failNext)&&job.id==='end-early')checkbox.disabled=true;
  checkbox.onclick=event=>event.stopPropagation();checkbox.onchange=()=>nativeSelectionChanged(job,checkbox);wrapper.append(checkbox);select.append(wrapper);
  const statusCell=document.createElement('td');statusCell.className='mat-column-status';
  const status=document.createElement('mat-icon');status.textContent='check_circle';status.setAttribute('aria-label','Completed');statusCell.append(status);
  const name=document.createElement('td');name.className='mat-column-name';name.textContent=job.name;
  const modified=document.createElement('td');modified.className='mat-column-date';modified.textContent=job.modified;
  const options=document.createElement('td');options.className='mat-column-options';
  const menu=document.createElement('button');menu.className='mat-mdc-menu-trigger';menu.setAttribute('aria-label','More options');
  const icon=document.createElement('mat-icon');icon.textContent='more_vert';menu.append(icon);options.append(menu);
  menu.onclick=event=>{event.stopPropagation();state.menus.push(job.id);const download=document.createElement('a');download.textContent='Download';download.href='data:application/zip;base64,UEsFBgAAAAAAAAAAAAAAAAAAAAAAAA==';download.setAttribute('role','menuitem');download.onclick=event=>{event.preventDefault();state.downloads.push(job.id)};document.getElementById('overlay').replaceChildren(download)};
  row.append(select,statusCell,name,modified,options);body.append(row);row.onclick=()=>state.rowOpens++;
  if(id==='download-official-links'){const link=document.createElement('a');link.href='/fold/'+job.id;link.textContent='Open job';row.append(link)}
 }
 const first=document.querySelector('[aria-label="First page"]'),previous=document.querySelector('[aria-label="Previous page"]'),next=document.querySelector('[aria-label="Next page"]'),last=document.querySelector('[aria-label="Last page"]');
 first.disabled=previous.disabled=state.page===0;next.disabled=last.disabled=state.page===state.pages.length-1;
 document.getElementById('page-range').textContent=(state.page*pageSize+1)+' – '+Math.min(jobs.length,state.page*pageSize+pageSize)+' of '+jobs.length;
 renderNativeSelection();
}
function changePage(target){
 state.changes++;recordReadiness();
 if(id==='download-stale-page')return;
 if(id==='download-loading-page'||id==='download-loading-paginator'){
  const table=document.querySelector('gdm-af-history table'),paginator=document.querySelector('mat-paginator');
  const spinner=document.createElement('mat-spinner');spinner.style.cssText='display:block;width:20px;height:20px';
  if(id==='download-loading-page'){table.before(spinner);table.remove();paginator.remove()}else paginator.replaceWith(spinner);
  setTimeout(()=>{id==='download-loading-page'?spinner.replaceWith(table,paginator):spinner.replaceWith(paginator);state.page=target;renderRows()},350);return;
 }
 if(id==='download-repeating-page'&&state.page===1&&target===2)target=0;
 const wait=['download-stop-scan','download-context-change','download-busy'].includes(id)?500:75;
 if(id==='download-stop-scan')setTimeout(()=>ui('download-stop').click(),80);
 if(id==='download-context-change')setTimeout(()=>setFilter('draft'),80);
 if(id==='download-busy')setTimeout(()=>{const start=ui('v20-btn');start.disabled=false;start.click()},80);
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
if(id==='download-empty-history'){
 document.querySelector('table').remove();document.querySelector('mat-paginator').remove();
 const empty=document.createElement('div');empty.className='no-results';empty.textContent='No jobs found with filters specified';document.querySelector('gdm-af-history').append(empty);
}
const reviewChecks=()=>Array.from(ui('download-results').querySelectorAll('input[type="checkbox"][data-job-key]'));
const selectedReview=()=>reviewChecks().filter(element=>element.checked);
function assertNoScriptDownload(){assert(state.downloads.length===manualRecords&&state.bulkDownloads.length===manualActions&&state.menus.length===0,'A script control triggered native download/menu action')}
function assertRemovedControls(){for(const name of ['download-run','download-web-controls','download-web-run','download-web-stop','download-location'])assert(!ui(name),'Removed script download control remains: '+name)}
function setFormat(value){ui('download-format').value=value;ui('download-format').dispatchEvent(new Event('change',{bubbles:true}));assert(ui('download-format').value===value,'Download format was not selectable: '+value)}
async function scan(start='2026-11-12',end='2026-11-13'){
 ui('download-start').value=start;ui('download-end').value=end;
 ui('download-start').dispatchEvent(new Event('change',{bubbles:true}));ui('download-end').dispatchEvent(new Event('change',{bubbles:true}));
 ui('download-scan').click();await pause(60);await until(()=>!ui('download-scan').disabled);await pause(60);
}
async function apply(){state.phase='active';ui('download-apply').click();await pause(50);await until(()=>!ui('download-scan').disabled);await pause(150);state.phase='idle';assertNoScriptDownload()}
async function next(){state.phase='next';ui('download-next').click();await pause(50);await until(()=>!ui('download-scan').disabled);await pause(150);state.phase='idle';assertNoScriptDownload()}
async function manualNativeDownload(){
 assertNoScriptDownload();const ids=[...state.selected],confirms=state.confirms;
 const button=document.querySelector('button.download-button');assert(button&&!button.disabled,'Official Download is unavailable');
 button.click();await pause(100);
 assert(state.bulkDownloads.length===manualActions+1&&state.downloads.length===manualRecords+ids.length,'Manual native Download was blocked or duplicated');
 assert(state.bulkDownloads.at(-1).slice().sort().join(',')===ids.slice().sort().join(','),'Manual native Download used the wrong selection');
 manualActions++;manualRecords+=ids.length;assert(state.confirms===confirms,'Script intercepted manual native Download');assertNoScriptDownload();
}
function assertNativeIds(expected){assert([...state.selected].sort().join(',')===expected.slice().sort().join(','),'Wrong native selection: '+[...state.selected]+' expected '+expected)}
const rangeIds=['end-late','end-early','start-late','start-early'];
const queueText=()=>ui('download-queue')?.textContent||'';
const queueAt=(index,total)=>new RegExp('(?:^|\\D)'+index+'\\s*/\\s*'+total+'(?:\\D|$)').test(queueText());
function assertQueueAt(index,total){assert(queueAt(index,total),'Wrong individual queue position: '+queueText()+' expected '+index+'/'+total)}
async function assertInvalidNext(){
 await until(()=>ui('download-next').disabled);
 const clears=state.nativeClears,changes=state.nativeInputChanges;
 ui('download-next').disabled=false;await next();
 assert(state.nativeClears===clears&&state.nativeInputChanges===changes,'Invalidated queue still changed native checkboxes');
}
async function checkIndividual(){
 await scan();assert(reviewChecks().length===4,'Individual scan lost date matches');assertNoScriptDownload();
 if(id==='download-individual-subset')ui('download-results').querySelector('input[data-day="2026-11-13"]').click();
 await apply();
 const subset=id==='download-individual-subset',ids=subset?['start-late','start-early']:rangeIds;
 assertNativeIds([ids[0]]);assertQueueAt(1,ids.length);
 assert(selectedReview().length===ids.length,'Individual Apply lost the reviewed queue');
 if(id==='download-individual-sequence'||subset){
  for(let index=0;index<ids.length;index++){
   assertNativeIds([ids[index]]);assertQueueAt(index+1,ids.length);
   assert(selectedReview().length===ids.length,'Next changed the frozen review selection');
   if(!subset){await manualNativeDownload();await pause(250);assertNativeIds([ids[index]]);assertQueueAt(index+1,ids.length)}
   if(index+1<ids.length){
    assert(!ui('download-next').disabled,'Next was unavailable before the queue ended');
    await next();
   }
  }
  assert(ui('download-next').disabled,'Queue end allowed an extra Next');
  const changes=state.nativeInputChanges;ui('download-next').disabled=false;await next();
  assert(state.nativeInputChanges===changes,'Queue end repeated or advanced past the last task');
 }else if(id==='download-individual-preselection'){
  assert(state.nativeClears===1,'Individual Apply did not clear previous hidden native selection');
 }else if(id==='download-individual-repeat-apply'){
  await next();assertNativeIds([ids[1]]);assertQueueAt(2,ids.length);
  await apply();assertNativeIds([ids[0]]);assertQueueAt(1,ids.length);
 }else if(id==='download-individual-native-identity-swap'){
  const clears=state.nativeClears,changes=state.nativeInputChanges;
  state.selected.clear();state.selected.add('newer');renderNativeSelection();
  await next();assertNativeIds(['newer']);
  assert(state.nativeClears===clears&&state.nativeInputChanges===changes,'Next cleared or replaced a silently changed native identity');
  assert(ui('download-next').disabled&&ui('download-queue').hidden,'Native identity mismatch did not invalidate the individual queue');
 }else if(id==='download-individual-stop-next'||id==='download-individual-error-next'){
  if(id==='download-individual-error-next')state.failNext=true;
  const changes=state.nativeInputChanges;await next();
  if(id==='download-individual-stop-next')assert(state.stopTriggered&&state.nativeInputChanges===changes+1,'Stop did not interrupt the pending Next');
  else assert(state.nativeInputChanges===changes,'Failed Next clicked the unavailable checkbox');
  assert(!queueAt(2,ids.length),'Stopped/failed Next advanced the queue');
  assert(ui('download-next').disabled&&ui('download-queue').hidden,'Stopped/failed Next left an actionable queue');
  assert(ui('download-apply').disabled===(id==='download-individual-error-next'),'Stop/error did not preserve the expected rescan requirement');
  assert(selectedReview().length===4,'Stopped/failed Next lost pending reviews');
  const stopped=state.nativeInputChanges;await pause(300);assert(state.nativeInputChanges===stopped,'Stopped/failed Next performed a late checkbox action');
 }else{
  if(id==='download-individual-item-change')reviewChecks()[3].click();
  else if(id==='download-individual-day-change')ui('download-results').querySelector('input[data-day="2026-11-12"]').click();
  else if(id==='download-individual-clear-all'){
   ui('download-clear').click();assert(selectedReview().length===0,'Clear did not remove review choices');await assertInvalidNext();
   ui('download-all').click();assert(selectedReview().length===4,'All did not restore review choices');
  }else if(id==='download-individual-all-change')ui('download-all').click();
  else if(id==='download-individual-mode-change')setFormat('combined');
  else if(id==='download-individual-range-change'){ui('download-start').value='2026-11-13';ui('download-start').dispatchEvent(new Event('change',{bubbles:true}))}
  else if(id==='download-individual-search-change')document.getElementById('history-search').value='changed while queue idle';
  else if(id==='download-individual-filter-change')setFilter('draft');
  else if(id==='download-individual-native-change')nativeCheckbox('newer').click();
  else if(id==='download-individual-native-clear')document.querySelector('#native-selection button[aria-label="Clear selection"]').click();
  else throw Error('Unknown individual test: '+id);
  const selected=[...state.selected];await assertInvalidNext();assertNativeIds(selected);
  if(id==='download-individual-mode-change'){
   await apply();assertNativeIds(rangeIds);assert(ui('download-next').disabled,'Combined Apply left an individual queue active');
  }
 }
}
(async()=>{
 const script=document.createElement('script');script.src='/script.js';
 await new Promise((resolve,reject)=>{script.onload=resolve;script.onerror=()=>reject(Error('Cannot load userscript'));document.head.append(script)});
 await until(()=>ui('download-section'),5000);ui('download-section').open=true;
 assert(ui('download-apply'),'Apply-to-website control is missing');assertRemovedControls();
 assert(ui('download-format')?.tagName==='SELECT','Download format selector is missing');
 assert(Array.from(ui('download-format').options).map(option=>option.value).sort().join(',')==='combined,individual','Unexpected download format choices');
 assert(ui('download-next')&&ui('download-queue'),'Individual queue controls are missing');
 if(id==='download-format-persistence'){
  const expected=restore==='individual'?'individual':'combined';assert(ui('download-format').value===expected,'Reload did not restore '+expected+' format');
  if(restore!=='combined'){
   const value=restore?'combined':'individual';setFormat(value);assert(localStorage.getItem(formatKey)===value,'Format was not persisted');
   location.replace('/case?id='+id+'&restore='+value);return;
  }
 }else if(id==='download-format-default'){
  assert(ui('download-format').value==='combined','Invalid stored format did not fall back to combined');
 }else setFormat(id.startsWith('download-individual-')?'individual':'combined');
 if(id==='download-format-persistence'||id==='download-format-default'){
  assert(state.nativeInputChanges===0&&state.nativeClears===0,'Format controls changed native selection');
 }else if(id==='history-status-filters'){
  const filters=Array.from(document.querySelectorAll('#filters button'));
  const standby='😴 待机中: 请切换页面';
  for(let mask=0;mask<32;mask++){
   filters.forEach((node,index)=>node.setAttribute('aria-selected',String(Boolean(mask&(1<<index)))));
   await pause(550);
   const expected=mask===1?'就绪：核对选择后应用到官网勾选':mask===2?'🟢 就绪: 提交草稿':mask===4?'🔵 就绪: 失败任务重跑':standby;
   assert(ui('status-text').textContent===expected,'Wrong top status for filters '+mask+': '+ui('status-text').textContent);
   assert(ui('v20-btn').disabled===(mask!==2&&mask!==4),'Wrong submit availability for filters '+mask);
  }
  document.getElementById('filters').prepend(document.getElementById('failed-filter').parentElement);
  setFilter('failed');document.getElementById('draft-filter').setAttribute('aria-selected','true');await pause(550);
  assert(ui('status-text').textContent===standby&&ui('v20-btn').disabled,'Reordered mixed filters enabled failed submission');
  const unrelated=document.createElement('button');unrelated.setAttribute('aria-selected','true');unrelated.textContent='Saved draft';document.body.prepend(unrelated);
  setFilter('completed');await pause(550);
  assert(ui('status-text').textContent==='就绪：核对选择后应用到官网勾选'&&ui('v20-btn').disabled,'Unrelated selection changed the history mode');
 }else if(id==='history-status-click'){
  for(const [mode,extra] of [['draft','failed'],['failed','examples']]){
   setFilter(mode);await until(()=>!ui('v20-btn').disabled);await pause(550);
   document.getElementById(extra+'-filter').setAttribute('aria-selected','true');ui('v20-btn').click();
   assert(state.confirms===0&&state.rowOpens===0,'Stale '+mode+' readiness allowed submission after filter change');
   assert(ui('v20-btn').disabled,'Click did not refresh mixed-filter readiness');
  }
  for(const [mode,next] of [['draft','failed'],['failed','draft']]){
   setFilter(mode);await until(()=>!ui('v20-btn').disabled);await pause(550);
   window.confirm=()=>{state.confirms++;setFilter(next);return true};
   ui('v20-btn').click();
   assert(state.rowOpens===0,'Filter change during confirmation started a different submission mode');
  }
 }else if(id.startsWith('download-individual-')){
  await checkIndividual();
 }else if(id==='download-invalid-range'){
  await scan('2026-11-14','2026-11-12');assert(state.changes===0&&ui('download-apply').disabled,'Reversed range was actionable');
  await scan('','2026-11-13');assert(state.changes===0&&ui('download-apply').disabled,'Empty range was actionable');
 }else if(id==='download-zero'||id==='download-empty-history'){
  await scan('2020-01-01','2020-01-01');assert(reviewChecks().length===0&&ui('download-apply').disabled,'Zero matches allowed application');
 }else if(['download-duplicate','download-stable-collision','download-stale-page','download-repeating-page','download-stop-scan','download-context-change','download-noncompleted','download-examples-filter'].includes(id)){
  await scan();assert(ui('download-apply').disabled,'Incomplete/ambiguous/unsupported scan allowed application');
  assert(state.nativeCheckboxClicks===0&&state.nativeClears===0,'Failed scan modified native selection');
 }else if(id==='download-ready-states'){
  await until(()=>/就绪|ready/i.test(ui('download-ready-text').textContent));
  setFilter('draft');await until(()=>/待命|待机|等待|waiting|standby/i.test(ui('download-ready-text').textContent));
  setFilter('completed');await scan();
  assert(state.readiness.some(text=>/运行|进行|正在|running|loading|scanning|applying/i.test(text)),'Scan omitted running state');
  await apply();await until(()=>/就绪|ready|官网|website/i.test(ui('download-ready-text').textContent));
 }else{
  const single=id==='download-single-day';await scan(single?'2026-11-13':'2026-11-12','2026-11-13');
  const expected=id==='download-over-fifty'?51:single?2:['download-unknown-date','download-calendar-invalid','download-clock-invalid'].includes(id)?3:4;
  assert(reviewChecks().length===expected,'Wrong date range count: '+reviewChecks().length+' expected '+expected);
  assertNoScriptDownload();assert(state.nativeCheckboxClicks===0&&state.nativeClears===0,'Scanning changed native selection');
  assert(new Set(state.visited).size===3,'Scan omitted a native page');
  if(['download-unknown-date','download-calendar-invalid','download-clock-invalid'].includes(id))assert(/无法|识别|未知|unknown|unreadable|invalid/i.test(ui('download-status').textContent),'Unrecognized date was not reported');
  if(id==='download-busy'){
   assert(state.confirms===0,'Submission bypassed exclusion during scan');
  }else if(id==='download-select'){
   ui('download-clear').click();assert(selectedReview().length===0&&ui('download-apply').disabled,'Clear selection stayed actionable');
   ui('download-all').click();assert(selectedReview().length===4,'Select all lost matches');
   reviewChecks()[0].click();await apply();assert(state.selected.size===3,'Individual deselection was ignored');
  }else if(id==='download-day-selection'){
   ui('download-results').querySelector('input[data-day="2026-11-13"]').click();assert(selectedReview().length===2,'Day deselection failed');
   await apply();assertNativeIds(['start-late','start-early']);
  }else if(id==='download-changed-range'){
   ui('download-start').value='2026-11-13';ui('download-start').dispatchEvent(new Event('change',{bubbles:true}));
   await apply();assert(state.nativeCheckboxClicks===0&&state.confirms===0&&reviewChecks().length===0&&ui('download-apply').disabled,'Changed date range reused prior results');
  }else if(id==='download-changed-filter'||id==='download-changed-search'){
   if(id==='download-changed-filter')setFilter('draft');else document.getElementById('history-search').value='changed after scan';
   await apply();assert(state.nativeCheckboxClicks===0&&state.nativeClears===0&&state.confirms===0,'Changed context applied old results');
   assert(selectedReview().length===4,'Changed context lost review choices');
  }else if(id==='download-changed-metadata'||id==='download-changed-fallback'){
   ui('download-clear').click();const key=id==='download-changed-metadata'?'id:end-late':'row:'+JSON.stringify([jobs[1].name,jobs[1].modified]);
   const selected=reviewChecks().find(element=>element.dataset.jobKey===key);assert(selected,'Target review row is missing');selected.click();
   jobs[1].modified='2026-11-13 22:59';renderRows();await apply();
   assert(state.nativeCheckboxClicks===0&&selectedReview().length===1,'Changed identity was applied or lost pending choice');
  }else if(id==='download-cancel-apply'){
   await apply();assert(state.confirms===1&&state.nativeCheckboxClicks===0&&state.nativeClears===0,'Cancel did not preserve native selection');
   assertNativeIds(['older','hidden-old-selection']);assert(selectedReview().length===4,'Cancel lost review choices');
  }else if(id==='download-confirm-context-change'){
   await apply();assert(state.confirms===1&&state.nativeClears===0&&state.nativeInputChanges===0&&state.nativeCheckboxClicks===0,'Context change during confirmation modified native selection');
   assertNativeIds(['older','hidden-old-selection']);assert(selectedReview().length===4,'Confirmation context change lost review choices');
  }else if(id==='download-clear-failure'){
   await apply();assert(state.nativeClears===1&&state.nativeCheckboxClicks===0&&selectedReview().length===4,'Failed native clear did not abort safely');
  }else if(id==='download-partial-error'){
   await apply();assertNativeIds(['end-late']);assert(selectedReview().length===4,'Partial apply lost review choices');
  }else if(['download-stop-apply','download-stop-restart','download-apply-native-change','download-apply-context-change','download-apply-metadata-change','download-apply-offpage-metadata-change'].includes(id)){
   await apply();assert(state.stopTriggered,'Interruption was not exercised');
   const offpage=id==='download-apply-offpage-metadata-change';
   assert(state.nativeInputChanges===(offpage?3:id==='download-apply-native-change'?2:1),'Application continued after stop/change: nativeInputChanges='+state.nativeInputChanges+', selected='+[...state.selected]+', status='+ui('download-status').textContent);
   if(offpage){
    assertNativeIds(['end-late','start-late','start-early']);
    assert(/部分勾选|partial/i.test(ui('download-status').textContent),'Missing off-page target omitted partial-selection warning');
   }
   assert(selectedReview().length===4,'Interrupted application lost review choices');
   const changes=state.nativeInputChanges;await pause(300);assert(state.nativeInputChanges===changes,'Stop/change allowed a late checkbox action');
   if(id==='download-stop-restart'){await apply();assertNativeIds(rangeIds)}
  }else{
   if(id==='download-preselection')assertNativeIds(['older','hidden-old-selection']);
   if(id==='download-late-preselection'){state.selected.add('older');renderNativeSelection()}
   await apply();
   const targetIds=single?['end-late','end-early']:id==='download-over-fifty'?jobs.map(job=>job.id):rangeIds.filter(jobId=>!(['download-unknown-date','download-calendar-invalid','download-clock-invalid'].includes(id)&&jobId==='start-late'));
   assertNativeIds(targetIds);assert(selectedReview().length===expected,'Application lost review choices');
   if(id==='download-preselection'||id==='download-late-preselection')assert(state.nativeClears===1,'Prior native selection was not globally replaced');
   if(id==='download-repeat-apply'){await apply();assertNativeIds(rangeIds);assert(state.nativeClears===1,'Repeat apply failed to reconcile existing selection')}
   if(id==='download-over-fifty'){
    assert(document.querySelector('button.download-button').disabled,'Native bulk limit above 50 was bypassed');
    assert(/50/.test(ui('download-section').textContent),'Native 50-job limit was not explained');
   }
   if(id==='download-manual-native'){
    await manualNativeDownload();assertNativeIds(rangeIds);
   }
  }
 }
 assertRemovedControls();
 assertNoScriptDownload();
 assert(state.menus.length===0,'Script opened a native task menu');
 assert(state.transportCalls.length===0,'Independent transfer was invoked: '+state.transportCalls);
 assert(state.submits===0&&state.clones===0&&state.deletes===0&&state.rowOpens===0,'Unrelated native action: '+JSON.stringify(state));
 assert(state.errors.length===0,state.errors.join('; '));
 parent.postMessage({type:'af3-case-result',result:{passed:true,message:'native selections='+state.selected.size+', script downloads=0, manual native ZIP actions='+state.bulkDownloads.length+', independent transfers=0'}},location.origin);
})().catch(error=>parent.postMessage({type:'af3-case-result',result:{passed:false,message:error.message}},location.origin));
</script>'''


SCENARIOS = [
    'history-status-filters', 'history-status-click',
    'download-range', 'download-reset-first', 'download-single-day', 'download-select',
    'download-day-selection', 'download-zero', 'download-invalid-range',
    'download-unknown-date', 'download-calendar-invalid', 'download-clock-invalid',
    'download-duplicate', 'download-stable-ids', 'download-stable-collision',
    'download-official-links', 'download-preselection', 'download-late-preselection',
    'download-noncompleted', 'download-examples-filter', 'download-stop-scan',
    'download-context-change', 'download-busy', 'download-stale-page',
    'download-repeating-page', 'download-loading-page', 'download-loading-paginator',
    'download-empty-history', 'download-changed-range', 'download-changed-filter',
    'download-changed-search', 'download-changed-metadata', 'download-changed-fallback',
    'download-cancel-apply', 'download-confirm-context-change', 'download-clear-failure', 'download-partial-error',
    'download-stop-apply', 'download-stop-restart', 'download-apply-native-change',
    'download-apply-context-change', 'download-apply-metadata-change', 'download-apply-offpage-metadata-change',
    'download-repeat-apply', 'download-over-fifty', 'download-manual-native',
    'download-ready-states',
    'download-format-default', 'download-format-persistence',
    'download-individual-sequence', 'download-individual-subset',
    'download-individual-preselection', 'download-individual-repeat-apply',
    'download-individual-item-change', 'download-individual-day-change',
    'download-individual-clear-all', 'download-individual-all-change',
    'download-individual-mode-change', 'download-individual-range-change',
    'download-individual-search-change', 'download-individual-filter-change',
    'download-individual-native-change', 'download-individual-native-clear',
    'download-individual-native-identity-swap',
    'download-individual-stop-next', 'download-individual-error-next',
]


def main():
    harness = runpy.run_path(str(Path(__file__).with_name('test_submission.py')))
    runner = harness['main']
    runner.__globals__.update(
        CASE=CASE,
        SCENARIOS=SCENARIOS,
        PAGE=harness['PAGE'].replace('85000', '25000').replace('85 seconds', '25 seconds'),
    )
    os.environ['AF_TEST_CASES'] = os.environ.get('AF_DOWNLOAD_TEST_CASES', ','.join(SCENARIOS))
    runner()


if __name__ == '__main__':
    main()
