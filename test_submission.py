"""Stdlib-only, account-free Edge/Chromium tests for the full release userscript.

All pages and script bytes come from a loopback server. No real AlphaFold site,
existing profile, login, quota, or installed browser extension is used. Real
timers are intentional: Web Locks and browser processes do not share virtual
time. AF_TEST_CASES can select comma-separated scenario IDs for diagnosis.
AF_TEST_UPSTREAM=1 runs upstream/main, for proving the regressions fail even
after the local repair has been committed.
"""

import json
import os
from pathlib import Path
import shutil
import subprocess
import tempfile
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlsplit


PAGE = r'''<!doctype html><meta charset="utf-8"><title>Local submission self-check</title>
<style>body{font:14px sans-serif;margin:24px}iframe{width:1100px;height:700px;border:1px solid #ccc}</style>
<h1>Local synthetic tests — no AlphaFold access</h1><pre id="results">STARTING</pre><div id="frame"></div>
<script>
const scenarios = __SCENARIOS__;
window.__af3GMValues = new Map();
window.__af3GMListeners = new Set();
const report = [];
const results = document.getElementById('results');
async function publish(state) {
  const response = await fetch('/results', {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(state)});
  if (!response.ok) throw Error('Cannot publish test status');
}
(async()=>{
  for (const id of scenarios) {
    await publish({report, stage:id, done:false});
    const result = await new Promise((resolve, reject)=>{
      const frame=document.createElement('iframe');
      const timer=setTimeout(()=>{clean();reject(Error('Case did not finish in 85 seconds: '+id))},85000);
      const listener=event=>{
        if(event.origin!==location.origin || event.source!==frame.contentWindow || event.data?.type!=='af3-case-result')return;
        clean();resolve(event.data.result);
      };
      const clean=()=>{clearTimeout(timer);window.removeEventListener('message',listener);frame.remove()};
      window.addEventListener('message',listener);
      frame.src='/case?id='+encodeURIComponent(id);
      document.getElementById('frame').append(frame);
    });
    report.push((result.passed?'PASS ':'FAIL ')+id+': '+result.message);
    results.textContent=report.join('\n');
  }
  results.dataset.done='true';
  await publish({report,stage:'complete',done:true,passed:report.every(line=>line.startsWith('PASS'))});
})().catch(async error=>{
  report.push('FAIL '+error.message);results.textContent=report.join('\n');
  await publish({report,stage:'fatal',done:true,passed:false});
});
</script>'''


CASE = r'''<!doctype html><meta charset="utf-8"><title>Synthetic AF3 fixture</title>
<style>body{font:14px sans-serif}gdm-af-request,gdm-af-preview-dialog,mat-dialog-container,
mat-snack-bar-container{display:block}button,input{margin:4px}td{padding:8px}</style>
<button role="tab" id="mode" aria-selected="true"></button>
<gdm-af-request><div class="points">Remaining jobs: 30</div><div id="request"></div></gdm-af-request>
<table><thead><tr><th>Name</th></tr></thead><tbody id="rows"></tbody></table>
<div id="overlay"></div><div id="notices"></div>
<script>
'use strict';
const id=new URLSearchParams(location.search).get('id');
const accountsKey='af3-dev-panel-accounts-v1';
const restored=new URLSearchParams(location.search).has('restore');
if(id.startsWith('account-')&&!restored){localStorage.removeItem(accountsKey);top.__af3GMValues.delete(accountsKey);localStorage.setItem('af3-dev-panel-language','zh')}
if(id==='account-daily-reset'){
  const realNow=Date.now.bind(Date),start=Date.parse('2032-02-29T22:59:00Z');
  window.quotaClockOffset=(restored?Date.parse('2032-03-03T23:01:00Z'):start)-realNow();
  Date.now=()=>realNow()+window.quotaClockOffset;
  window.WIZ_global_data={oPEP7c:'current@example.com'};
  document.querySelector('gdm-af-request .points').textContent=restored?'Unavailable':'Remaining jobs: 0';
  if(!restored)top.__af3GMValues.set(accountsKey,{version:1,accounts:[
    {email:'current@example.com',note:'Keep current note',quota:{remaining:0,observedAt:start}},
    {email:'offline@example.com',note:'Keep offline note',quota:{remaining:4,observedAt:start}},
    {email:'older@example.com',note:'Older reading',quota:{remaining:2,observedAt:start-2*86400000}},
    {email:'unknown@example.com',note:'Never measured',quota:null}
  ]});
}
if(id==='account-migration'&&!restored){
  top.__af3GMValues.set(accountsKey,{version:1,accounts:[{email:'shared@example.com',note:'Shared note',quota:null}]});
  localStorage.setItem(accountsKey,JSON.stringify({version:1,accounts:[{email:'legacy@example.com',note:'Imported note',quota:null},{email:'shared@example.com',note:'Legacy note',quota:null}]}));
}
if(id==='account-storage'){
  top.__af3GMValues.set(accountsKey,'{invalid');
}
if(id==='account-switch-submission'||id==='account-switch-confirm')window.WIZ_global_data={oPEP7c:'first@example.com'};
if(id==='startup-trusted-types')window.WIZ_global_data={oPEP7c:'strict.page@example.com'};
// Leave room to grow in the 700px fixture, and verify existing saved sizes still work.
if(id==='panel-ui'&&!new URLSearchParams(location.search).has('restore')){
  localStorage.setItem('af3-dev-panel-size',JSON.stringify({width:300,height:380}));
  localStorage.removeItem('af3-dev-panel-language');localStorage.removeItem('af3-dev-panel-position');
  localStorage.setItem('af3-v20-panel-language','en');localStorage.setItem('af3-v20-panel-position',JSON.stringify({left:12,top:12}));
}
const failed=id.startsWith('failed-');
const draftBatch=id.startsWith('draft-batch-');
const pagedBatch=draftBatch||id==='failed-batch-limit';
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const root=()=>document.getElementById('af3-dev-panel')?.shadowRoot;
const ui=name=>root()?.getElementById('af3-'+name);
const assert=(value,message)=>{if(!value)throw Error(message)};
async function until(read,timeout=75000){const end=Date.now()+timeout;while(Date.now()<end){if(read())return;await pause(50)}throw Error('Timed out: '+(ui('log-body')?.textContent||''))}
const state={calls:0,names:[],summaries:[],errors:[],opened:[],acknowledged:[],removed:[],prompts:[],pausedConfirmed:false,earlySuccess:false};
window.__af3PrivateTabCalls=[];
const cloneGMValue=value=>value===undefined?undefined:JSON.parse(JSON.stringify(value));
window.GM_getValue=(key,defaultValue)=>top.__af3GMValues.has(key)?cloneGMValue(top.__af3GMValues.get(key)):defaultValue;
window.GM_setValue=(key,value)=>{
  if(id==='account-storage-blocked'&&key===accountsKey)throw Error('Tampermonkey storage disabled');
  const oldValue=cloneGMValue(top.__af3GMValues.get(key));
  const newValue=cloneGMValue(value);
  top.__af3GMValues.set(key,newValue);
  for(const listener of top.__af3GMListeners){
    if(listener.key===key)listener.callback(key,cloneGMValue(oldValue),cloneGMValue(newValue),listener.source!==window);
  }
};
window.GM_addValueChangeListener=(key,callback)=>{
  const listener={key,callback,source:window};top.__af3GMListeners.add(listener);return listener;
};
window.addEventListener('pagehide',()=>{
  for(const listener of top.__af3GMListeners){if(listener.source===window)top.__af3GMListeners.delete(listener)}
});
window.GM_openInTab=(url,options)=>{
  if(id==='account-login-unavailable')throw Error('InPrivate unavailable');
  window.__af3PrivateTabCalls.push({url,options});
  return {closed:false,close(){}};
};
const queue=pagedBatch?Array.from({length:['draft-batch-exhausted','draft-batch-loading','failed-batch-limit'].includes(id)?13:35},(_,i)=>'draft_'+i):['draft_0','draft_1','draft_2'];let current;
window.confirm=message=>{state.prompts.push(String(message));if(id==='account-switch-confirm')window.WIZ_global_data.oPEP7c='second@example.com';return !['draft-batch-cancel','failed-batch-limit'].includes(id)};
if(pagedBatch){
  const paginator=document.createElement('mat-paginator');paginator.textContent='Items per page: 10 ';
  const range=document.createElement('span');range.id='batch-range';range.className='mat-mdc-paginator-range-label';paginator.append(range);
  document.getElementById('rows').closest('table').after(paginator);
}
window.alert=message=>state.summaries.push(String(message));
window.addEventListener('error',event=>state.errors.push(event.message));
window.addEventListener('unhandledrejection',event=>state.errors.push(String(event.reason)));
if(id.endsWith('sandbox-event-window')){
  const NativeMouseEvent=window.MouseEvent;
  const sandboxWindow=new Proxy(window,{});
  // Exercise the browser's actual Window conversion, not a mocked exception.
  let rejected=false;
  try{new NativeMouseEvent('mouseover',{view:sandboxWindow})}
  catch(error){rejected=error instanceof TypeError&&error.message.includes("convert value to 'Window'")}
  assert(rejected,'Browser must reject a sandbox Window proxy for this regression');
  window.MouseEvent=class extends NativeMouseEvent{
    constructor(type,init){
      super(type,init?.view===window?{...init,view:sandboxWindow}:init);
    }
  };
}
document.getElementById('mode').textContent=failed?'Failed':'Saved draft';
function toast(message){
  let node=document.querySelector('mat-snack-bar-container');
  if(!node){node=document.createElement('mat-snack-bar-container');document.getElementById('notices').append(node)}
  node.textContent=message;
}
function showContinue(name){
  if(draftBatch&&state.opened.length){
    const previous=state.opened.at(-1);
    assert(state.acknowledged.includes(previous)&&state.removed.includes(previous),'Opened the next draft before acknowledgement and list refresh: '+previous);
  }
  current=name;state.opened.push(name);
  if(id==='account-switch-submission')window.WIZ_global_data.oPEP7c='second@example.com';
  document.getElementById('overlay').replaceChildren();
  const button=document.createElement('button');button.textContent='Continue and preview job';
  button.onclick=()=>showPreview(name);
  document.getElementById('request').replaceChildren(button);
}
function renderRows(){
  const body=document.getElementById('rows');body.replaceChildren();
  if(pagedBatch)document.getElementById('batch-range').textContent=(queue.length?1:0)+' – '+Math.min(queue.length,10)+' of '+queue.length;
  for(const name of queue.slice(0,pagedBatch?10:queue.length)){
    const row=document.createElement('tr');row.className='mat-mdc-row';row.dataset.name=name;
    const check=document.createElement('td');const input=document.createElement('input');input.type='checkbox';check.append(input);
    const label=document.createElement('td');label.className='mat-column-name';label.textContent=name;
    const menuCell=document.createElement('td');const menu=document.createElement('button');menu.textContent='More';menu.className='mat-mdc-menu-trigger';menuCell.append(menu);
    row.append(check,label,menuCell);body.append(row);
    row.onclick=()=>{if(!failed)showContinue(name)};
    menu.onclick=event=>{
      event.stopPropagation();
      const clone=document.createElement('button');clone.textContent='Clone and reuse';clone.setAttribute('role','menuitem');
      clone.onclick=()=>showContinue(name);document.getElementById('overlay').replaceChildren(clone);
    };
  }
}
function updateAfterSubmission(name){
  document.getElementById('overlay').replaceChildren();document.getElementById('request').replaceChildren();
  if(!failed){
    queue.splice(queue.indexOf(name),1);
    if(id==='draft-batch-loading'){
      const body=document.getElementById('rows');body.replaceChildren();
      const spinner=document.createElement('mat-progress-spinner');spinner.textContent='Loading jobs';body.closest('table').before(spinner);
      setTimeout(()=>{renderRows();spinner.remove();state.removed.push(name)},350);
    }else{renderRows();if(draftBatch)state.removed.push(name)}
  }
}
function successCount(){const match=state.summaries.at(-1)?.match(/完成[：:]\s*(\d+)\s*个/);return match?Number(match[1]):-1}
function showPreview(name){
  document.getElementById('request').replaceChildren();
  const modal=document.createElement('mat-dialog-container');modal.setAttribute('role','dialog');
  const preview=document.createElement('gdm-af-preview-dialog');
  const title=document.createElement('div');title.className='name';const input=document.createElement('input');input.value=name;title.append(input);
  const quota=document.createElement('p');quota.textContent='Remaining jobs: 30';
  const confirm=document.createElement('button');confirm.className='confirm';confirm.textContent='Confirm and submit job';
  preview.append(title,quota,confirm);modal.append(preview);document.getElementById('overlay').replaceChildren(modal);
  confirm.onclick=()=>{
    state.calls++;state.names.push(name);
    if(state.names.filter(value=>value===name).length>1)return;
    if(draftBatch){
      toast('Job launch pending.');
      setTimeout(()=>{state.acknowledged.push(name);toast('Job successfully launched.');setTimeout(()=>updateAfterSubmission(name),350)},300);
    }else if(id==='delayed-success'){
      setTimeout(()=>{toast('Job successfully launched.');updateAfterSubmission(name)},1800);
    }else if(id==='old-success'){
      // An old success toast, disappearance of modal, and a changed first row
      // must never be treated as evidence that this submission succeeded.
      document.getElementById('overlay').replaceChildren();queue.shift();renderRows();
      setTimeout(()=>toast('Failed to launch job: quota exceeded'),1600);
    }else if(id==='server-error'||id==='failed-error'){
      if(failed)setTimeout(()=>{state.earlySuccess=Boolean(ui('log-body')?.textContent.includes('第 1 个失败任务已提交'))||state.summaries.some(s=>/完成[：:]\s*1\s*个/.test(s))},150);
      setTimeout(()=>toast('Failed to launch job: quota exceeded'),900);
    }else if(id==='no-toast'){
      updateAfterSubmission(name);
    }else if(id==='stop-in-flight'){
      setTimeout(()=>ui('stop-btn').click(),100);
    }else if(id==='stale-row'){
      setTimeout(()=>{toast('Job successfully launched.');document.getElementById('overlay').replaceChildren()},300);
    }else if(id==='stop-confirmed-refresh'){
      setTimeout(()=>{toast('Job successfully launched.');setTimeout(()=>ui('stop-btn').click(),25);setTimeout(()=>updateAfterSubmission(name),450)},300);
    }else if(id==='paused-success'){
      setTimeout(()=>ui('pause-btn').click(),100);
      setTimeout(()=>{toast('Job successfully launched.');updateAfterSubmission(name)},300);
      setTimeout(()=>{state.pausedConfirmed=Boolean(ui('log-body')?.textContent.includes('第 1 个草稿提交完成'));ui('pause-btn').click()},1000);
    }else{
      if(id==='multi-success')toast('Job launch pending.');
      setTimeout(()=>{toast('Job successfully launched.');updateAfterSubmission(name)},300);
    }
  };
}
async function checkPanelUi(){
  const host=()=>document.getElementById('af3-dev-panel');
  const rect=()=>host().getBoundingClientRect();
  const quota=()=>ui('quota')?.textContent||'';
  assert(ui('quota'),'Quota display is missing');
  const source=await fetch('/script.js').then(response=>response.text());
  const version=source.match(/^\/\/ @version\s+(\S+)/m)?.[1];
  assert(version&&ui('header').textContent.includes(version),'Panel release version differs from userscript metadata');
  const handle=ui('resize-handle');
  assert(handle,'Panel resize handle is missing');
  assert(handle.getAttribute('role')==='button'&&handle.tabIndex===0,'Resize handle is not keyboard accessible');
  const luminance=color=>color.match(/[\d.]+/g).slice(0,3).map(value=>{
    const channel=Number(value)/255;return channel<=0.04045?channel/12.92:((channel+0.055)/1.055)**2.4;
  }).reduce((sum,value,index)=>sum+value*[0.2126,0.7152,0.0722][index],0);
  await until(()=>ui('v20-btn').getAnimations().length===0,2500);
  for(const [foreground,background] of [['status-text','submission-status'],['v20-btn','v20-btn']]){
    const a=luminance(getComputedStyle(ui(foreground)).color),b=luminance(getComputedStyle(ui(background)).backgroundColor);
    assert((Math.max(a,b)+0.05)/(Math.min(a,b)+0.05)>=4.5,foreground+' contrast is below 4.5:1 ('+getComputedStyle(ui(foreground)).color+' on '+getComputedStyle(ui(background)).backgroundColor+'; '+ui(background).getAnimations().length+' active animations)');
  }
  const points=document.querySelector('gdm-af-request .points');
  points.textContent='Remaining jobs: 24';
  await until(()=>/24\s*个/.test(quota()),2500);
  points.textContent='Remaining jobs: 17';
  await until(()=>/17\s*个/.test(quota()),2500);
  points.textContent='Remaining jobs: 0';
  await until(()=>/0\s*个/.test(quota()),2500);
  points.textContent='Quota unavailable';
  await until(()=>/无法识别/.test(quota()),2500);
  points.textContent='Remaining jobs: 0';
  // Adjacent elements intentionally have no whitespace separators, mirroring
  // the real preview that previously joined sequence / quota / button text.
  const preview=document.createElement('gdm-af-preview-dialog');
  const seq=document.createElement('span');seq.textContent='ACDEFGHIKL';
  const p=document.createElement('div');p.className='points';p.textContent='Remaining jobs: 23';
  const confirm=document.createElement('button');confirm.textContent='Confirm and submit job';
  preview.append(seq,p,confirm);document.getElementById('overlay').append(preview);
  await until(()=>/23\s*个/.test(quota()),2500);
  preview.remove();
  const replacement=document.createElement('div');replacement.className='points';replacement.textContent='Remaining jobs: 12';
  points.replaceWith(replacement);
  await until(()=>/12\s*个/.test(quota()),2500);
  assert(state.calls===0&&state.opened.length===0,'Quota observation submitted or opened a job');
  const initial=rect();
  const collapse=ui('panel-toggle');assert(collapse,'Panel collapse control is missing');
  const sizeBeforeCollapse=localStorage.getItem('af3-dev-panel-size');
  collapse.click();await pause(1100);
  assert(collapse.getAttribute('aria-expanded')==='false'&&collapse.getAttribute('aria-label'),'Collapsed control lacks accessible state');
  assert(rect().height<initial.height-80&&root().querySelector('.af3-workspace').getClientRects().length===0,'Collapsed panel still covers website controls');
  assert(localStorage.getItem('af3-dev-panel-size')===sizeBeforeCollapse,'Collapse overwrote saved panel dimensions');
  collapse.click();await pause(80);
  assert(collapse.getAttribute('aria-expanded')==='true'&&Math.abs(rect().height-initial.height)<2,'Expand did not restore panel geometry');
  let observedDown=0,observedMove=0,observedUp=0;
  handle.addEventListener('pointerdown',()=>observedDown++);
  handle.addEventListener('pointermove',()=>observedMove++);
  handle.addEventListener('pointerup',()=>observedUp++);
  const pointer=(type,x,y,target)=>target.dispatchEvent(new PointerEvent(type,{bubbles:true,composed:true,cancelable:true,pointerId:1,pointerType:'mouse',isPrimary:true,button:0,buttons:type==='pointerup'?0:1,clientX:x,clientY:y}));
  const grip=handle.getBoundingClientRect();const x=grip.left+grip.width/2,y=grip.top+grip.height/2;
  pointer('pointerdown',x,y,handle);
  // Dispatch through the handle as well as document so synthetic Edge events
  // exercise both normal bubbling and the fallback used when pointer capture
  // is unavailable in a test iframe.
  pointer('pointermove',x+80,y+60,handle);
  pointer('pointermove',x+80,y+60,document);
  pointer('pointerup',x+80,y+60,handle);
  await pause(80);
  const enlarged=rect();
  assert(enlarged.width>initial.width+5&&enlarged.height>initial.height+5,`Pointer resize did not change width and height (events ${observedDown}/${observedMove}/${observedUp}, ${initial.width}x${initial.height}->${enlarged.width}x${enlarged.height})`);
  await pause(1100);
  assert(Math.abs(rect().width-enlarged.width)<2&&Math.abs(rect().height-enlarged.height)<2,'Periodic ensureUI reset the resized panel');
  const beforeKeys=rect();
  handle.dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowRight',bubbles:true,cancelable:true}));
  handle.dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowDown',bubbles:true,cancelable:true}));
  await pause(80);
  assert(rect().width>beforeKeys.width&&rect().height>beforeKeys.height,'Arrow keys did not resize the panel');
  const stored=JSON.parse(localStorage.getItem('af3-dev-panel-size')||'null');
  const oldSetItem=Storage.prototype.setItem;
  Storage.prototype.setItem=function(){throw new DOMException('Storage blocked','SecurityError')};
  const beforeBlocked=rect();
  handle.dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowLeft',bubbles:true,cancelable:true}));
  await pause(1200);
  assert(rect().width<beforeBlocked.width-5,'Blocked storage reset the requested panel size');
  Storage.prototype.setItem=oldSetItem;
  handle.dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowRight',bubbles:true,cancelable:true}));
  await pause(80);
  assert(stored&&Number.isFinite(stored.width)&&Number.isFinite(stored.height),'Panel size was not persisted as numeric width/height');
  assert(Math.abs(stored.width-rect().width)<2&&Math.abs(stored.height-rect().height)<2,'Stored dimensions differ from panel dimensions');
  const reloadStage=new URLSearchParams(location.search).get('restore')==='1';
  if(!reloadStage){
    // Persist the actual interaction result, then reload this browsing context
    // so a new userscript instance must read its saved size.
    location.replace('/case?id=panel-ui&restore=1');
    return false;
  }
  const frame=window.frameElement;frame.style.width='340px';frame.style.height='400px';
  await until(()=>innerWidth<=340&&innerHeight<=400,2500);
  dispatchEvent(new Event('resize'));await pause(1200);
  const small=rect();
  assert(small.left>=0&&small.top>=0&&small.right<=innerWidth+1&&small.bottom<=innerHeight+1,'Panel escapes a small viewport');
  const workspace=root().querySelector('.af3-workspace');
  assert(workspace,'Scrollable panel workspace is missing');
  const controls={
    tasks:['v20-count','v20-btn','download-start','download-end','download-format','download-scan','download-apply','download-all','download-clear','log-toggle'],
    accounts:['account-login','account-refresh','account-input','account-note','account-save'],
  };
  const originalLanguage=ui('language-select').value;
  try{
    for(const [width,height] of [[340,400],[264,284]]){
      frame.style.width=width+'px';frame.style.height=height+'px';
      await until(()=>innerWidth===width&&innerHeight===height,2500);
      dispatchEvent(new Event('resize'));await pause(50);
      const headerTop=ui('header').getBoundingClientRect().top;
      for(const language of ['zh','en','ja','ko','es','fr']){
        ui('language-select').value=language;ui('language-select').dispatchEvent(new Event('change'));
        assert(ui('v20-count').labels.length&&ui('count-label').textContent,'Quantity input lacks a visible label');
        assert(ui('language-select').getAttribute('aria-label'),'Language selector lacks an accessible name');
        for(const [page,names] of Object.entries(controls)){
          ui(page+'-tab').click();
          const active=ui(page+'-page');
          assert(!active.hidden&&active.scrollWidth<=active.clientWidth+1,language+' '+page+' page overflows horizontally');
          assert(workspace.scrollWidth<=workspace.clientWidth+1,language+' workspace overflows horizontally');
          for(const name of names){
            const control=ui(name);control.scrollIntoView({block:'center',inline:'nearest',behavior:'instant'});
            const box=control.getBoundingClientRect(),viewport=workspace.getBoundingClientRect();
            assert(box.width>0&&box.height>0,language+' '+name+' is not rendered');
            assert(box.left>=viewport.left-1&&box.right<=viewport.right+1,language+' '+name+' is clipped horizontally');
            assert(box.top>=viewport.top-1&&box.bottom<=viewport.bottom+1,language+' '+name+' cannot scroll into view');
            assert(Math.abs(ui('header').getBoundingClientRect().top-headerTop)<1,'Scrolling content moved panel navigation');
          }
        }
      }
    }
  }finally{
    ui('language-select').value=originalLanguage;ui('language-select').dispatchEvent(new Event('change'));
  }
  assert(localStorage.getItem('af3-dev-panel-language')===originalLanguage,'Panel UI check did not restore the saved language');
  ui('tasks-tab').click();ui('log-toggle').click();
  assert(ui('log-toggle').getAttribute('aria-expanded')==='true'&&ui('log-body').getClientRects().length,'Expanded log state is not accessible');
  ui('log-toggle').click();
  assert(ui('log-toggle').getAttribute('aria-expanded')==='false','Collapsed log state is not accessible');
  assert(state.calls===0&&state.opened.length===0,'Panel controls submitted a job');
  assert(state.errors.length===0,state.errors.join('; '));
  parent.postMessage({type:'af3-case-result',result:{passed:true,message:'live quota, resize/restore, six-language narrow/minimum layout and accessible controls; 0 submits'}},location.origin);
  return false;
}
renderRows();
if(id==='old-success')toast('Job successfully launched.');
async function checkAccountEmail(){
  assert(ui('account-email'),'Current account email display is missing');
  assert(ui('header').contains(ui('account-email'))&&ui('account-email').parentElement===ui('header-title').parentElement,'Current account must sit beside the panel title, not in the workspace');
  assert(ui('account-email').getAttribute('role')==='status'&&ui('account-email').getAttribute('aria-live')==='polite','Header account lost its live status semantics');
  const email=()=>ui('account-email').textContent;
  const shown=async value=>{await until(()=>email()==='当前账号：'+value,2500)};
  const unknown=async()=>{await until(()=>email().includes('未识别'),2500)};
  await unknown();
  const job=document.createElement('p');job.textContent='job.owner@example.com';document.getElementById('rows').append(job);
  window.WIZ_global_data={oPEP7c:'first.account@example.com'};await shown('first.account@example.com');
  const host=document.getElementById('af3-dev-panel'),width=host.style.width;
  host.style.width='700px';
  const titleBox=ui('header-title').getBoundingClientRect(),accountBox=ui('account-email').getBoundingClientRect();
  assert(accountBox.left>=titleBox.right&&accountBox.top<titleBox.bottom&&accountBox.bottom>titleBox.top,'Wide header did not place account next to title');
  const longEmail='w'.repeat(64)+'@'+'w'.repeat(63)+'.'+'w'.repeat(63)+'.'+'w'.repeat(61);
  window.WIZ_global_data.oPEP7c=longEmail;await shown(longEmail);
  host.style.width='264px';
  assert(ui('header').scrollWidth<=ui('header').clientWidth+1,'Long account overflows the narrow header');
  assert(ui('account-email').textContent.includes(longEmail),'Narrow header lost the account address');
  const frame=window.frameElement,frameWidth=frame.style.width,frameHeight=frame.style.height;
  frame.style.width='264px';frame.style.height='284px';dispatchEvent(new Event('resize'));
  await until(()=>host.getBoundingClientRect().width<=240&&host.getBoundingClientRect().height<=260,2500);
  for(const language of ['zh','en','ja','ko','es','fr']){
    ui('language-select').value=language;ui('language-select').dispatchEvent(new Event('change'));
    const panelBox=host.getBoundingClientRect(),workspace=root().querySelector('.af3-workspace'),viewport=workspace.getBoundingClientRect();
    assert(viewport.height>=38&&viewport.top>=panelBox.top&&viewport.bottom<=panelBox.bottom,'Long account hides the minimum-size workspace: '+language);
    assert(ui('account-email').title.includes(longEmail)&&ui('account-email').textContent.includes(longEmail),'Full account is unavailable in the compact header: '+language);
    for(const name of ['v20-count','download-scan','download-apply']){
      ui(name).scrollIntoView({block:'center',inline:'nearest',behavior:'instant'});
      const box=ui(name).getBoundingClientRect();
      assert(box.top>=viewport.top-1&&box.bottom<=viewport.bottom+1,'Long account makes '+name+' unreachable: '+language);
    }
  }
  ui('language-select').value='zh';ui('language-select').dispatchEvent(new Event('change'));
  frame.style.width=frameWidth;frame.style.height=frameHeight;dispatchEvent(new Event('resize'));
  host.style.width=width;
  window.WIZ_global_data.oPEP7c='second.account@example.com';await shown('second.account@example.com');
  const userMenu=document.createElement('gdm-af-user-menu');
  const accountButton=document.createElement('button');accountButton.setAttribute('aria-label','User menu: current.account@example.com');userMenu.append(accountButton);document.body.prepend(userMenu);
  await shown('current.account@example.com');
  accountButton.setAttribute('aria-label','User menu: switched.account@example.com');await shown('switched.account@example.com');
  const another=document.createElement('span');another.textContent='ambiguous.account@example.com';userMenu.append(another);await unknown();another.remove();await shown('switched.account@example.com');
  ui('language-select').value='en';ui('language-select').dispatchEvent(new Event('change'));
  assert(email()==='Current account: switched.account@example.com','Email label did not change language');
  ui('language-select').value='zh';ui('language-select').dispatchEvent(new Event('change'));
  userMenu.style.display='none';await shown('second.account@example.com');userMenu.remove();
  const accountLink=document.createElement('a');accountLink.setAttribute('aria-label','Google Account: Test User (label.account@example.com)');accountLink.textContent='Account';document.body.prepend(accountLink);
  await shown('label.account@example.com');accountLink.remove();
  window.WIZ_global_data.oPEP7c='';await unknown();
  window.WIZ_global_data.oPEP7c='invalid address';await unknown();
  delete window.WIZ_global_data;
  const bootstrap=document.createElement('script');bootstrap.dataset.id='_gd';bootstrap.type='application/json';
  bootstrap.textContent='window.WIZ_global_data = '+JSON.stringify({oPEP7c:'bootstrap.account@example.com'})+';';document.head.append(bootstrap);
  await shown('bootstrap.account@example.com');
  window.WIZ_global_data={oPEP7c:''};await unknown();delete window.WIZ_global_data;
  bootstrap.textContent='window.WIZ_global_data = invalid';await unknown();bootstrap.remove();
  const records=GM_getValue(accountsKey).accounts;
  assert(records.some(item=>item.email==='bootstrap.account@example.com'),'Recognized account was not saved');
  assert(!records.some(item=>item.email==='job.owner@example.com'),'Task owner was saved as a signed-in account');
  assert(state.calls===0&&state.opened.length===0&&state.errors.length===0,'Account readback triggered a task or script error');
  parent.postMessage({type:'af3-case-result',result:{passed:true,message:'email readback, account changes, visible profile priority, unknown/logout, bootstrap, languages; 0 submits'}},location.origin);
}
function assertInPrivateSwitch(login){
  assert(login.tagName==='BUTTON'&&!login.hasAttribute('href'),'Private account switch must not navigate the current page');
  const call=window.__af3PrivateTabCalls.at(-1);
  assert(call&&call.options?.incognito===true&&call.options?.active===true,'Switch did not request an active InPrivate tab');
  assert(call.url==='https://alphafoldserver.com/','InPrivate must open the AlphaFold Server homepage directly');
}
function assertAccountSwitchBlocked(){
  const login=ui('account-login');
  assert(login.disabled&&login.getAttribute('aria-disabled')==='true'&&login.tabIndex===-1,'Running task left an actionable account switch');
  const before=window.__af3PrivateTabCalls.length;
  login.dispatchEvent(new MouseEvent('click',{bubbles:true,cancelable:true}));
  assert(window.__af3PrivateTabCalls.length===before,'Running task opened an InPrivate tab');
}
async function checkAccountManager(){
  const records=()=>GM_getValue(accountsKey,{version:1,accounts:[]}).accounts;
  const cards=()=>Array.from(ui('accounts-list').querySelectorAll('article'));
  const card=email=>cards().find(node=>node.dataset.email===email);
  const save=(email,note='')=>{ui('account-input').value=email;ui('account-note').value=note;ui('account-form').dispatchEvent(new Event('submit',{cancelable:true}))};
  ui('accounts-tab').click();
  assert(ui('tasks-page').hidden&&!ui('accounts-page').hidden,'Account tab did not switch pages');
  assert(ui('accounts-tab').getAttribute('aria-selected')==='true','Account tab is not selected accessibly');
  const login=ui('account-login');
  if(id==='account-login'){
    save('saved@example.com','Keep this record');
    const before=JSON.stringify(GM_getValue(accountsKey));
    login.click();
    assertInPrivateSwitch(login);
    assert(JSON.stringify(GM_getValue(accountsKey))===before,'Switch removed saved accounts or notes');
    assert(ui('account-login-help').textContent.includes('InPrivate'),'Switch does not explain InPrivate behavior');
    assert(ui('accounts-message').textContent.includes('InPrivate'),'Switch did not report its result');
  }else if(id==='account-login-unavailable'){
    login.click();
    assert(window.__af3PrivateTabCalls.length===0,'Unavailable InPrivate API still opened a tab');
    assert(ui('accounts-message').textContent.includes('无法打开 InPrivate'),'Missing InPrivate permission was not reported');
  }else if(id==='account-storage'||id==='account-storage-blocked'){
    save('memory@example.com','first');save('another@example.com','second');
    assert(cards().length===2&&card('memory@example.com').textContent.includes('first'),'Unavailable storage lost in-page records');
    assert(ui('accounts-message').textContent.includes('当前页面有效'),'Unavailable storage did not report memory-only mode');
    if(id==='account-storage')assert(GM_getValue(accountsKey)==='{invalid','Corrupt stored data was overwritten');
  }else if(id==='account-persistence'){
    if(!restored){save('saved@example.com','My work account');location.replace('/case?id='+id+'&restore=1');return false}
    assert(card('saved@example.com')?.textContent.includes('My work account'),'Reload lost account or note');
    assert(ui('account-input').value==='','Reload retained an unfinished edit');
  }else if(id==='account-quota'){
    const points=document.querySelector('gdm-af-request .points');
    window.WIZ_global_data={oPEP7c:'first@example.com'};
    await until(()=>records().find(item=>item.email==='first@example.com')?.quota?.remaining===30,3000);
    const before=records()[0].quota.observedAt;await pause(1100);
    assert(records()[0].quota.observedAt===before,'Quota wrote storage on every polling tick');
    card('first@example.com').querySelector('[data-action="remove"]').click();await pause(600);
    assert(!card('first@example.com'),'Removed current account was re-added by polling');
    ui('account-refresh').click();
    assert(records().find(item=>item.email==='first@example.com')?.quota?.remaining===30,'Manual record did not restore a removed current account');
    const preview=document.createElement('gdm-af-preview-dialog');preview.textContent='Remaining jobs: 99';document.body.append(preview);
    await pause(600);assert(records()[0].quota.remaining===30,'Preview quota overwrote the account record');preview.remove();
    window.WIZ_global_data.oPEP7c='second@example.com';
    await until(()=>card('second@example.com'),2500);
    assert(records().find(item=>item.email==='second@example.com').quota===null,'Old quota was assigned to a newly selected account');
    assert(!card('first@example.com').querySelector('.af3-account-current')&&card('first@example.com').textContent.includes('上次记录额度'),'Previous account was marked current or live');
    assert(card('second@example.com').textContent.includes('尚未记录额度'),'New account displayed old quota');
    points.textContent='Remaining jobs: 0';
    await until(()=>records().find(item=>item.email==='second@example.com')?.quota?.remaining===0,2500);
    assert(card('second@example.com').textContent.includes('官网当前额度：0'),'Zero quota was treated as unknown');
    const recorded=records().find(item=>item.email==='second@example.com').quota.observedAt;
    points.textContent='Unavailable';
    await until(()=>ui('account-refresh').disabled,2500);
    assert(card('second@example.com').textContent.includes('上次记录额度：0'),'Unknown quota was shown as live or lost');
    assert(records().find(item=>item.email==='second@example.com').quota.observedAt===recorded,'Unknown quota changed the record timestamp');
    window.WIZ_global_data.oPEP7c='';await until(()=>!cards().some(node=>node.querySelector('.af3-account-current')),2500);
    assert(records().length===2,'Sign-out deleted saved accounts');
  }else if(id==='account-daily-reset'){
    const quota=email=>card(email).querySelector('[data-quota-source]');
    if(restored){
      assert(quota('current@example.com')?.dataset.quotaSource==='scheduled'&&quota('current@example.com').textContent.includes('30'),'Reload did not catch up missed resets');
      assert(records().find(r=>r.email==='current@example.com').quota.remaining===27&&card('offline@example.com').textContent.includes('Keep offline note'),'Estimated reset overwrote readings/notes');
    }else{
      assert(quota('older@example.com')?.dataset.quotaSource==='scheduled'&&quota('older@example.com').textContent.includes('30'),'Missed daily reset was not applied on startup');
      assert(quota('offline@example.com')?.textContent.includes('4')&&quota('offline@example.com').dataset.quotaSource==='recorded','Quota reset before 23:00 UTC');
      assert(quota('unknown@example.com')?.textContent.includes('尚未记录额度'),'Never-measured quota was invented');
      const before=JSON.stringify(records());
      window.quotaClockOffset+=60000;
      await until(()=>quota('current@example.com')?.dataset.quotaSource==='scheduled'&&quota('offline@example.com')?.dataset.quotaSource==='scheduled',3000);
      assert(quota('current@example.com').textContent.includes('30')&&quota('offline@example.com').textContent.includes('30'),'Daily reset did not restore the local estimate to 30');
      assert(ui('account-refresh').disabled,'Stale website quota remained recordable after reset');
      await pause(1100);assert(JSON.stringify(records())===before,'Stale DOM or scheduled estimates changed persisted readings');
      document.querySelector('gdm-af-request .points').textContent='Remaining jobs: 27';
      await until(()=>quota('current@example.com')?.dataset.quotaSource==='website'&&records().find(r=>r.email==='current@example.com').quota.remaining===27,3000);
      assert(quota('offline@example.com').dataset.quotaSource==='scheduled','Current website reading overwrote another account');
      document.querySelector('gdm-af-request .points').textContent='Unavailable';
      await until(()=>ui('account-refresh').disabled,3000);
      window.quotaClockOffset+=3*86400000;
      await until(()=>quota('current@example.com')?.dataset.quotaSource==='scheduled',3000);
      assert(quota('current@example.com').textContent.includes('30')&&!quota('current@example.com').textContent.includes('90'),'Missed days accumulated quota');
      location.replace('/case?id='+id+'&restore=1');return false;
    }
  }else if(id==='account-cross-tab'){
    save('original@example.com','original');
    const frame=document.createElement('iframe');frame.src='/case?id=storage-writer';frame.hidden=true;
    const loaded=new Promise(resolve=>frame.onload=resolve);document.body.append(frame);await loaded;
    frame.contentWindow.GM_setValue(accountsKey,{version:1,accounts:[{email:'original@example.com',note:'Other tab',quota:null},{email:'other@example.com',note:'Shared',quota:null}]});
    await until(()=>card('other@example.com')&&card('original@example.com').textContent.includes('Other tab'),2500);
    save('third@example.com','third');assert(records().length===3,'Writing discarded another tab records');
    assert(frame.contentWindow.GM_getValue(accountsKey).accounts.length===3,'Another tab did not see the shared account list');
    frame.contentWindow.GM_setValue(accountsKey,{version:1,accounts:[]});
    await until(()=>cards().length===0,2500);frame.remove();
  }else if(id==='account-migration'){
    assert(cards().length===2&&card('legacy@example.com')?.textContent.includes('Imported note'),'Legacy browser records were not imported');
    assert(card('shared@example.com')?.textContent.includes('Shared note'),'Migration overwrote the existing shared note');
    assert(localStorage.getItem(accountsKey)===null,'Migrated legacy browser data was not cleared');
    card('legacy@example.com').querySelector('[data-action="remove"]').click();await pause(1100);
    save('new@example.com','new');
    assert(records().length===2&&!card('legacy@example.com'),'A removed account was re-imported from stale legacy data');
    assert(top.__af3GMValues.get(accountsKey).accounts.length===2,'Migrated accounts were not kept in shared local storage');
  }else{
    assert(cards().length===0,'Account list should start empty');
    save('invalid','bad');assert(!records().length&&ui('accounts-message').textContent.includes('有效邮箱'),'Invalid email was saved');
    save(' Research.Account@Example.com ','Lab account');
    assert(records().length===1&&records()[0].email==='research.account@example.com','Email normalization failed');
    assert(card('research.account@example.com').textContent.includes('尚未记录额度'),'Manually added email invented a quota');
    save('research.account@example.com','<img src=x onerror="throw Error(1)">');
    assert(records().length===1&&!ui('accounts-list').querySelector('img'),'Duplicate email or note HTML was inserted');
    card('research.account@example.com').querySelector('[data-action="edit"]').click();
    assert(ui('account-input').readOnly,'Editing a note allowed rewriting account identity');
    ui('account-note').value='Edited note';await pause(1100);assert(ui('account-note').value==='Edited note','Polling replaced an active edit');
    ui('account-form').dispatchEvent(new Event('submit',{cancelable:true}));
    assert(records()[0].note==='Edited note','Note edit was not saved');
    card('research.account@example.com').querySelector('[data-action="edit"]').click();ui('account-cancel').click();
    assert(!ui('account-input').readOnly&&ui('account-input').value==='','Cancel edit did not reset the form');
    window.confirm=()=>false;card('research.account@example.com').querySelector('[data-action="remove"]').click();assert(records().length===1,'Cancelled removal deleted record');
    window.confirm=()=>true;card('research.account@example.com').querySelector('[data-action="remove"]').click();assert(!records().length,'Confirmed removal did not delete record');
    ui('language-select').value='en';ui('language-select').dispatchEvent(new Event('change'));
    assert(ui('accounts-tab').textContent==='Accounts'&&ui('account-save').textContent==='Save account','Account page labels did not translate');
    ui('accounts-tab').dispatchEvent(new KeyboardEvent('keydown',{key:'Home',bubbles:true}));
    assert(!ui('tasks-page').hidden&&ui('accounts-page').hidden,'Keyboard navigation did not return to Jobs');
    assert(ui('submission-section').getClientRects().length&&ui('download-section').getClientRects().length,'Tasks page lost expanded sections');
  }
  assert(state.calls===0&&state.opened.length===0&&state.errors.length===0,'Account management triggered a job or script error');
  parent.postMessage({type:'af3-case-result',result:{passed:true,message:'account page, local records, quota source and InPrivate login entry; 0 submits'}},location.origin);
  return true;
}
(async()=>{
  const script=document.createElement('script');
  // The fixture authorizes only its script URL; it must not create a default
  // TrustedHTML policy that would hide unsafe HTML writes inside the userscript.
  const scriptPolicy=id==='startup-trusted-types'?trustedTypes.createPolicy('af3-fixture-script',{createScriptURL:value=>value}):null;
  const scriptUrl='/script.js'+(draftBatch?'?fast-draft=1':'');
  script.src=scriptPolicy?scriptPolicy.createScriptURL(scriptUrl):scriptUrl;
  await new Promise((resolve,reject)=>{script.onload=resolve;script.onerror=()=>reject(Error('Cannot load userscript'));document.head.append(script)});
  if(id==='startup-trusted-types'){
    assert(state.errors.length===0,'Startup error under the website CSP: '+state.errors.join('; '));
    await until(()=>ui('v20-btn')&&ui('accounts-tab'),5000);
    assert(ui('tasks-page').getClientRects().length,'Tasks page was not rendered under Trusted Types');
    ui('accounts-tab').click();
    assert(ui('accounts-page').getClientRects().length,'Account page was not rendered under Trusted Types');
    ui('account-login').click();assertInPrivateSwitch(ui('account-login'));
    ui('account-input').value='manual@example.com';ui('account-note').value='Strict CSP note';
    ui('account-form').dispatchEvent(new Event('submit',{cancelable:true}));
    assert(ui('accounts-list').textContent.includes('Strict CSP note'),'Account save failed under Trusted Types');
    document.getElementById('af3-dev-panel').remove();
    await until(()=>ui('accounts-tab'),5000);
    assert(ui('accounts-page').getClientRects().length,'Panel recovery failed under Trusted Types');
    ui('tasks-tab').click();
    assert(ui('submission-section').getClientRects().length&&ui('download-section').getClientRects().length,'Panel recovery lost task sections');
    assert(state.calls===0&&state.opened.length===0&&state.errors.length===0,'Strict CSP rendering caused a task action or script error');
    parent.postMessage({type:'af3-case-result',result:{passed:true,message:'Trusted Types enforced: startup, navigation, account save and panel recovery; 0 submits'}},location.origin);return;
  }
  if(id==='log-controls'){
    await until(()=>ui('log-level')&&ui('log-export'),5000);
    const previousLanguage=ui('language-select').value;
    ui('language-select').value='en';ui('language-select').dispatchEvent(new Event('change'));
    assert(!ui('log-controls').getClientRects().length,'Collapsed log exposed its controls');
    ui('log-toggle').click();
    assert(ui('log-level').getClientRects().length&&ui('log-level').getAttribute('aria-label'),'Log filter is inaccessible');
    ui('v20-count').value=1;ui('v20-btn').click();await until(()=>state.summaries.length===1,20000);
    window.showDirectoryPicker=async()=>{throw new DOMException('Denied\n[INFO] forged <img src=x> https://secret.invalid/?token=private','NotAllowedError')};
    ui('fasta-restore').click();await until(()=>ui('fasta-stop').hidden);
    ui('download-start').value='';ui('download-scan').click();
    const original=ui('log-body').textContent;
    for(const level of ['DEBUG','INFO','WARN','ERROR'])assert(original.includes('['+level+']'),'Missing severity '+level+': '+original);
    assert(!ui('log-body').querySelector('img')&&!original.includes('token=private')&&!original.includes('\n[INFO] forged'),'Untrusted log content was unsafe or leaked a URL');
    assert(/\[\d{4}-\d{2}-\d{2}T[^\]]+Z\]/.test(original),'Log timestamps lack date/time zone');
    for(const level of ['debug','info','warn','error']){
      ui('log-level').value=level;ui('log-level').dispatchEvent(new Event('change'));
      const entries=[...ui('log-body').querySelectorAll('[data-level]')];
      assert(entries.length&&entries.every(n=>n.dataset.level===level),'Log filter included another level: '+level);
    }
    ui('language-select').value='zh';ui('language-select').dispatchEvent(new Event('change'));
    assert(ui('log-level').value==='error'&&ui('log-export').textContent.includes('导出'),'Language change lost filter or export label');
    ui('language-select').value='en';ui('language-select').dispatchEvent(new Event('change'));
    let captured=null,revoked=null;
    const create=URL.createObjectURL.bind(URL),revoke=URL.revokeObjectURL.bind(URL),click=HTMLAnchorElement.prototype.click;
    URL.createObjectURL=blob=>{captured={blob,url:create(blob)};return captured.url};
    URL.revokeObjectURL=url=>{revoked=url;revoke(url)};
    HTMLAnchorElement.prototype.click=function(){if(this.download.startsWith('af3-logs-')){captured.filename=this.download;return}return click.call(this)};
    ui('log-export').click();await until(()=>captured?.filename,5000);
    const text=await captured.blob.text();
    for(const level of ['DEBUG','INFO','WARN','ERROR'])assert(text.includes('['+level+']'),'Export silently used the selected filter: '+level);
    assert(text.includes('AF3 Auto Submitter v')&&text.includes('Exported (UTC):')&&captured.blob.type.startsWith('text/plain'),'Export lacks release metadata/type');
    assert(!text.includes('token=private')&&!text.includes('\n[INFO] forged')&&/\.txt$/.test(captured.filename),'Unsafe export contents/name');
    await until(()=>revoked===captured.url,5000);
    URL.createObjectURL=()=>{throw Error('Blocked export')};ui('log-export').click();
    assert(ui('log-body').textContent.includes('[ERROR]')&&ui('log-body').textContent.includes('export'),'Export failure was not logged');
    for(let i=0;i<506;i++)ui('download-scan').click();
    ui('log-level').value='all';ui('log-level').dispatchEvent(new Event('change'));
    assert(ui('log-body').querySelectorAll('[data-level]').length===500&&ui('log-summary').textContent.includes('discarded'),'Log retention limit/drop notice is missing');
    document.getElementById('af3-dev-panel').remove();await until(()=>ui('log-level'),5000);
    assert(ui('log-toggle').getAttribute('aria-expanded')==='true'&&ui('log-level').value==='all'&&ui('log-body').querySelectorAll('[data-level]').length===500,'Panel recovery lost log state');
    assert(state.calls===1&&state.errors.length===0,'Log controls triggered an extra submission or uncaught error');
    URL.createObjectURL=create;URL.revokeObjectURL=revoke;HTMLAnchorElement.prototype.click=click;
    ui('language-select').value=previousLanguage;ui('language-select').dispatchEvent(new Event('change'));
    parent.postMessage({type:'af3-case-result',result:{passed:true,message:'severity filtering, UTC timestamps, complete text export, sanitization, cleanup, retention and panel recovery'}},location.origin);return;
  }
  if(id==='action-error-feedback'){
    await until(()=>ui('download-scan'));
    ui('download-start').value='';ui('download-scan').click();
    const message=ui('download-status');
    assert(message.classList.contains('af3-error-message'),'Invalid-date error is not highlighted');
    const danger=getComputedStyle(root().getElementById('af3-dev-panel-root')).getPropertyValue('--af3-danger').trim();
    const probe=document.createElement('span');probe.style.color=danger;root().append(probe);
    const errorColor=getComputedStyle(probe).color;probe.remove();
    assert(getComputedStyle(message).color===errorColor,'Error text color was overridden by help styling');
    assert(message.getAttribute('role')==='alert'&&message.getAttribute('aria-live')==='assertive','Error is not announced');
    await pause(50);const animation=message.getAnimations()[0];assert(animation,'Error message did not pulse');
    assert(animation.effect.getTiming().iterations===3,'Error pulse is not bounded');
    let mutations=0;const observer=new MutationObserver(records=>mutations+=records.length);observer.observe(message,{childList:true,characterData:true,subtree:true});
    const started=animation.startTime;await pause(600);observer.disconnect();
    assert(mutations===0,'Periodic rendering rewrote the live error message');
    assert(message.getAnimations()[0]===animation&&animation.startTime===started,'Periodic rendering restarted error animation');
    ui('download-scan').click();await pause(50);
    assert(message.getAnimations()[0]!==animation,'Repeated failed click did not restart feedback');
    await pause(2500);
    assert(!message.getAnimations().length&&message.classList.contains('af3-error-message'),'Pulse did not end with persistent highlighting');
    ui('download-start').value='2026-11-21';ui('download-start').dispatchEvent(new Event('change'));
    assert(!message.classList.contains('af3-error-message')&&!message.getAnimations().length,'Correcting dates kept stale error feedback');
    window.showDirectoryPicker=async()=>{throw new DOMException('Cancelled','AbortError')};
    ui('fasta-generate').click();
    assert(ui('fasta-status').classList.contains('af3-error-message'),'Missing FASTA error is not highlighted');
    const transfer=new DataTransfer();transfer.items.add(new File(['>anonymous\nACDE\n'],'anonymous.fasta'));ui('fasta-file').files=transfer.files;
    ui('fasta-file').dispatchEvent(new Event('change'));
    assert(!ui('fasta-status').classList.contains('af3-error-message'),'Choosing a file kept stale FASTA error feedback');
    ui('fasta-generate').click();await until(()=>ui('fasta-stop').hidden);
    assert(!ui('fasta-status').classList.contains('af3-error-message'),'Picker cancellation flashed as an error');
    const rules=[...root().querySelector('style').sheet.cssRules];
    assert(rules.some(rule=>rule.conditionText?.includes('prefers-reduced-motion: reduce')&&[...rule.cssRules].some(style=>style.selectorText==='.af3-error-message'&&style.style.animationName==='none')),'Missing reduced-motion static-highlight rule');
    ui('accounts-tab').click();ui('account-input').value='not-an-email';ui('account-save').click();
    assert(ui('accounts-message').classList.contains('af3-error-message'),'Invalid account error is not highlighted');
    assert(getComputedStyle(ui('accounts-message')).color===errorColor,'Account error color was overridden');
    ui('account-input').value='valid@example.com';ui('account-save').click();
    assert(!ui('accounts-message').classList.contains('af3-error-message'),'Successful account save retained error highlighting');
    assert(state.calls===0&&state.opened.length===0&&state.errors.length===0,'Feedback test submitted a job or raised an error');
    parent.postMessage({type:'af3-case-result',result:{passed:true,message:'errors highlighted, finite pulse/retry, stable polling, reduced motion, success/cancel clearing; 0 submits'}},location.origin);return;
  }
  if(id==='account-email'){await until(()=>ui('v20-btn'),5000);await checkAccountEmail();return}
  if(['account-manager','account-login','account-login-unavailable','account-quota','account-daily-reset','account-persistence','account-storage','account-storage-blocked','account-cross-tab','account-migration'].includes(id)){await until(()=>ui('v20-btn'),5000);await checkAccountManager();return}
  if(id==='storage-writer')return;
  if(id==='panel-ui'){
    await until(()=>ui('v20-btn'),5000);
    assert(!ui('header').textContent.includes('DEV'),'Stable release still displays DEV branding');
    if(!new URLSearchParams(location.search).has('restore')){
      assert(ui('language-select').value==='en','v2 language fallback was lost');
      const migrated=document.getElementById('af3-dev-panel').getBoundingClientRect();
      assert(migrated.left===12&&migrated.top===12,'v2 panel position fallback was lost');
      ui('language-select').value='zh';ui('language-select').dispatchEvent(new Event('change'));
      assert(localStorage.getItem('af3-dev-panel-language')==='zh'&&localStorage.getItem('af3-v20-panel-language')==='en','Upgrade overwrote the legacy preference');
    }
    const saved=JSON.parse(localStorage.getItem('af3-dev-panel-size')||'null');
    if(new URLSearchParams(location.search).get('restore')==='1'){
      assert(saved,'Saved panel size disappeared after reload');
      const loaded=document.getElementById('af3-dev-panel').getBoundingClientRect();
      assert(Math.abs(saved.width-loaded.width)<2&&Math.abs(saved.height-loaded.height)<2,'Reload did not restore the saved panel size');
    }
    await checkPanelUi();return;
  }
  await until(()=>ui('v20-btn')&&!ui('v20-btn').disabled,5000);
  if(id==='account-login-busy'){
    ui('v20-btn').click();
    ui('panel-toggle').dispatchEvent(new MouseEvent('click',{bubbles:true}));assert(!document.getElementById('af3-dev-panel').hasAttribute('data-collapsed'),'Busy panel hid stop controls');
    assertAccountSwitchBlocked();
    ui('stop-btn').click();
    await until(()=>state.summaries.length>0);
    ui('account-login').click();assertInPrivateSwitch(ui('account-login'));
    assert(ui('account-login').getAttribute('aria-disabled')==='false','Switch did not recover after stopping');
    assert(state.calls===0&&state.errors.length===0,'Switch during processing submitted a job or caused an error');
    parent.postMessage({type:'af3-case-result',result:{passed:true,message:'switch blocked during submission; restored after stop; 0 submits'}},location.origin);return;
  }
  if(id==='account-switch-confirm'){
    ui('v20-btn').click();await pause(600);
    assert(state.calls===0&&state.opened.length===0&&state.errors.length===0,'Account change during confirmation started a batch');
    parent.postMessage({type:'af3-case-result',result:{passed:true,message:'account changed in confirmation; 0 task opens or submits'}},location.origin);return;
  }
  const initialQueue=queue.slice();
  if(pagedBatch)assert(document.querySelectorAll('#rows tr').length===10,'Expected exactly 10 visible rows, not the whole queue');
  ui('v20-count').value=pagedBatch?30:['multi-success','stale-row','server-error','failed-error'].includes(id)?2:1;
  ui('v20-btn').click();
  if(pagedBatch){
    assert(state.prompts.length===1,'Expected one startup confirmation');
    const prompt=state.prompts[0],planned=failed?10:30;
    assert(/(?:识别到任务行|当前页识别任务行)：10\b/.test(prompt),'Wrong visible-row count: '+prompt);
    assert(new RegExp('(?:计划处理数量|本次处理上限)：'+planned+'\\b').test(prompt),'Wrong batch limit: '+prompt);
    if(['draft-batch-cancel','failed-batch-limit'].includes(id)){
      await pause(1100);
      assert(state.calls===0&&state.opened.length===0&&state.acknowledged.length===0&&state.removed.length===0,'Cancelled batch acted on a draft');
      assert(state.summaries.length===0&&state.errors.length===0,'Cancelled batch produced a summary or error');
      assert(JSON.stringify(queue)===JSON.stringify(initialQueue),'Cancellation changed the queue');
      assert(!ui('v20-btn').disabled&&!ui('v20-count').disabled,'Cancellation left controls locked');
      parent.postMessage({type:'af3-case-result',result:{passed:true,message:'10 visible rows, planned limit='+planned+', cancelled with 0 task actions'}},location.origin);return;
    }
    ui('v20-btn').disabled=false;ui('v20-btn').click();
    assert(state.prompts.length===1,'Reentry started a second batch');
  }
  await until(()=>state.summaries.length>0);
  // Two polling intervals must not silently re-enable a blocked start button.
  await pause(1100);
  const successes=successCount();
  assert(state.errors.length===0,state.errors.join('; '));
  if(draftBatch){
    const expected=id==='draft-batch-30'?30:13;
    const names=Array.from({length:expected},(_,i)=>'draft_'+i);
    assert(state.calls===expected&&new Set(state.names).size===expected,'Wrong number of single-click submissions: '+state.calls);
    for(const key of ['opened','names','acknowledged','removed'])assert(JSON.stringify(state[key])===JSON.stringify(names),'Wrong '+key+' sequence: '+state[key].join(','));
    assert(successes===expected&&state.summaries.length===1,'Wrong confirmed count or duplicate summary: '+state.summaries.join('; '));
    assert(/跳过：0 个/.test(state.summaries[0])&&/失败：0 个/.test(state.summaries[0]),'Unexpected skip or error: '+state.summaries[0]);
    assert(JSON.stringify(queue)===JSON.stringify(initialQueue.slice(expected)),'Wrong drafts remain after the batch');
    assert(document.querySelectorAll('#rows tr').length===Math.min(queue.length,10),'Final visible page differs from the queue');
    assert(!ui('v20-btn').disabled&&!ui('v20-count').disabled,'Confirmed batch left controls locked');
    if(expected<30)assert(state.summaries[0].includes('列表已空'),'Exhausted queue did not report an empty list');
  }else if(id==='account-switch-submission'){
    assert(state.calls===0,'Account switch during a batch still clicked Confirm');
    assert(ui('v20-btn').disabled,'Account change did not lock Start');
    assert(ui('footer-msg').textContent.includes('账号已变化'),'Account change did not explain why processing stopped');
  }else if(['delayed-success','failed-success','paused-success','stop-confirmed-refresh','sandbox-event-window','failed-sandbox-event-window'].includes(id)){
    assert(state.calls===1,'Confirm clicked '+state.calls+' times; expected exactly once');
    assert(successes===1,'Expected one confirmed launch: '+state.summaries.at(-1));
    assert(!ui('v20-btn').disabled,'Confirmed run cannot start a later batch');
  }else if(id==='multi-success'){
    assert(state.names.join(',')==='draft_0,draft_1','Wrong sequence or duplicate submit: '+state.names.join(','));
    assert(successes===2,'Expected two confirmed launches: '+state.summaries.at(-1));
  }else{
    assert(state.calls===1,'Confirm clicked '+state.calls+' times; expected one and stop');
    assert(successes===(id==='stale-row'?1:0),'A click, closed dialog, old toast or changed row was counted as success: '+state.summaries.at(-1));
    assert(ui('v20-btn').disabled,'Start was re-enabled after an unconfirmed/error/stale-row submission');
    const before=state.calls;ui('v20-btn').disabled=false;ui('v20-btn').click();await pause(600);
    assert(state.calls===before,'Start event bypassed blocked submission state');
  }
  if(['server-error','failed-error','no-toast','stale-row'].includes(id))assert(ui('footer-msg').classList.contains('af3-error-message'),'Submission failure message is not highlighted');
  if(['delayed-success','failed-success','paused-success','stop-confirmed-refresh','sandbox-event-window','failed-sandbox-event-window','multi-success'].includes(id))assert(!ui('footer-msg').classList.contains('af3-error-message'),'Successful or stopped submission flashed as an error');
  if(['server-error','failed-error','no-toast','stale-row'].includes(id))assert([...ui('log-body').querySelectorAll('[data-level="error"]')].some(n=>n.textContent.includes('运行汇总')),'Error filter hides the failed-run summary');
  if(id==='failed-error')assert(!state.earlySuccess,'Failed clone was called submitted before the server response');
  if(id==='paused-success')assert(state.pausedConfirmed,'Success received during pause was not processed until resume');
  parent.postMessage({type:'af3-case-result',result:{passed:true,message:'confirm clicks='+state.calls+', confirmed='+successes}},location.origin);
})().catch(error=>parent.postMessage({type:'af3-case-result',result:{passed:false,message:error.message}},location.origin));
</script>'''


SCENARIOS = [
    'log-controls', 'action-error-feedback',
    'startup-trusted-types', 'panel-ui', 'account-email', 'account-manager', 'account-login', 'account-login-unavailable', 'account-login-busy', 'account-quota', 'account-daily-reset', 'account-persistence',
    'account-storage', 'account-storage-blocked', 'account-cross-tab', 'account-migration', 'account-switch-submission', 'account-switch-confirm',
    'stop-confirmed-refresh', 'delayed-success', 'old-success', 'server-error', 'no-toast', 'sandbox-event-window',
    'failed-success', 'failed-error', 'failed-sandbox-event-window', 'stop-in-flight', 'stale-row',
    'multi-success', 'paused-success',
    'draft-batch-30', 'draft-batch-exhausted', 'draft-batch-cancel', 'draft-batch-loading', 'failed-batch-limit',
]


def main():
    source = Path(__file__).with_name('af3-auto-submitter.user.js')
    if os.environ.get('AF_TEST_UPSTREAM') == '1':
        script = subprocess.check_output(['git', 'show', 'upstream/main:af3-auto-submitter.js'], cwd=source.parent)
    else:
        script = source.read_bytes()
    scenarios = [name.strip() for name in os.environ.get('AF_TEST_CASES', ','.join(SCENARIOS)).split(',') if name.strip()]
    if not scenarios or set(scenarios) - set(SCENARIOS):
        raise SystemExit('Unknown or empty AF_TEST_CASES selection.')
    fast_script = script.replace(b'\r\n', b'\n')
    if any(name.startswith('draft-batch-') for name in scenarios):
        # Only shorten presentation delays; acknowledgements, polling and fixture timers stay real.
        for old, new in [
            (b'const WAIT_FOR_MODAL = 2000;', b'const WAIT_FOR_MODAL = 100;'),
            (b"simulateClick(rows[0], 'rgba(0,0,255,0.2)');\n                await controlledSleep(500);", b"simulateClick(rows[0], 'rgba(0,0,255,0.2)');\n                await controlledSleep(100);"),
        ]:
            assert fast_script.count(old) == 1, 'Draft timing anchor changed'
            fast_script = fast_script.replace(old, new, 1)
    page = PAGE.replace('__SCENARIOS__', json.dumps(scenarios)).encode('utf-8')
    candidates = [
        Path(os.environ.get('PROGRAMFILES(X86)', 'C:/Program Files (x86)')) / 'Microsoft/Edge/Application/msedge.exe',
        Path(os.environ.get('PROGRAMFILES', 'C:/Program Files')) / 'Google/Chrome/Application/chrome.exe',
    ]
    browser = os.environ.get('AF_TEST_BROWSER') or next((str(path) for path in candidates if path.is_file()), None)
    browser = browser or shutil.which('chromium') or shutil.which('google-chrome')
    if not browser:
        raise SystemExit('Install Edge / Chrome / Chromium, or set AF_TEST_BROWSER.')
    finished = threading.Event()
    state = {'report': [], 'stage': 'browser startup', 'passed': False}

    class Handler(BaseHTTPRequestHandler):
        def do_GET(self):
            request = urlsplit(self.path)
            path = request.path
            if path not in ('/', '/case', '/script.js'):
                self.send_error(404)
                return
            self.send_response(200)
            self.send_header('Content-Type', 'application/javascript; charset=utf-8' if path == '/script.js' else 'text/html; charset=utf-8')
            if path == '/case' and self.path.split('?', 1)[-1] == 'id=startup-trusted-types':
                self.send_header('Content-Security-Policy', "require-trusted-types-for 'script'")
            self.end_headers()
            self.wfile.write((fast_script if request.query == 'fast-draft=1' else script) if path == '/script.js' else CASE.encode('utf-8') if path == '/case' else page)

        def do_POST(self):
            if self.path != '/results':
                self.send_error(404)
                return
            try:
                length = int(self.headers.get('Content-Length', '0'))
                if not 0 < length <= 65536:
                    raise ValueError('Invalid result length')
                update = json.loads(self.rfile.read(length))
                if not isinstance(update, dict) or not isinstance(update.get('report'), list) or not all(isinstance(line, str) for line in update['report']):
                    raise ValueError('Invalid result payload')
                state.update(update)
            except (ValueError, UnicodeError):
                self.send_error(400)
                return
            self.send_response(204)
            self.end_headers()
            if update.get('done') is True:
                finished.set()

        def log_message(self, *_args):
            pass

    server = ThreadingHTTPServer(('127.0.0.1', 0), Handler)
    threading.Thread(target=server.serve_forever, daemon=True).start()
    try:
        with tempfile.TemporaryDirectory(prefix='af3-submission-test-') as profile, tempfile.TemporaryFile() as log:
            process = subprocess.Popen([
                browser, '--headless=new', '--disable-gpu', '--no-first-run',
                '--no-default-browser-check', '--disable-background-networking',
                '--disable-extensions', f'--user-data-dir={profile}',
                f'http://127.0.0.1:{server.server_port}/',
            ], stdout=subprocess.DEVNULL, stderr=log)
            try:
                # Larger suites share this runner; each case also has its own timeout.
                deadline = time.monotonic() + max(300, 12 * len(scenarios))
                while not finished.wait(0.25):
                    if process.poll() is not None or time.monotonic() >= deadline:
                        break
                print('\n'.join(state['report']), flush=True)
                if not finished.is_set() or state.get('passed') is not True:
                    log.seek(0, os.SEEK_END)
                    log.seek(max(0, log.tell() - 1800))
                    detail = log.read().decode('utf-8', errors='replace')
                    raise SystemExit(f"Self-check failed or did not finish at: {state['stage']}\n{detail}")
            finally:
                if process.poll() is None:
                    process.terminate()
                    try:
                        process.wait(timeout=10)
                    except subprocess.TimeoutExpired:
                        process.kill()
                        process.wait(timeout=5)
    finally:
        server.shutdown()
        server.server_close()


if __name__ == '__main__':
    main()
