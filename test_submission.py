"""Stdlib-only, account-free Edge/Chromium tests for the full DEV userscript.

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


PAGE = r'''<!doctype html><meta charset="utf-8"><title>Local submission self-check</title>
<style>body{font:14px sans-serif;margin:24px}iframe{width:1100px;height:700px;border:1px solid #ccc}</style>
<h1>Local synthetic tests — no AlphaFold access</h1><pre id="results">STARTING</pre><div id="frame"></div>
<script>
const scenarios = __SCENARIOS__;
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
if(id.startsWith('account-')&&!restored){localStorage.removeItem(accountsKey);localStorage.setItem('af3-dev-panel-language','zh')}
if(id==='account-storage'){
  localStorage.setItem(accountsKey,'{invalid');
}
if(id==='account-storage-blocked'){
  const originalSet=Storage.prototype.setItem;
  Storage.prototype.setItem=function(key,value){if(key===accountsKey)throw Error('Storage disabled');return originalSet.call(this,key,value)};
}
if(id==='account-switch-submission'||id==='account-switch-confirm')window.WIZ_global_data={oPEP7c:'first@example.com'};
if(id==='startup-trusted-types')window.WIZ_global_data={oPEP7c:'strict.page@example.com'};
// Leave room to grow in the 700px fixture, and verify existing saved sizes still work.
if(id==='panel-ui'&&!new URLSearchParams(location.search).has('restore'))localStorage.setItem('af3-dev-panel-size',JSON.stringify({width:300,height:380}));
const failed=id.startsWith('failed-');
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const root=()=>document.getElementById('af3-dev-panel')?.shadowRoot;
const ui=name=>root()?.getElementById('af3-'+name);
const assert=(value,message)=>{if(!value)throw Error(message)};
async function until(read,timeout=75000){const end=Date.now()+timeout;while(Date.now()<end){if(read())return;await pause(50)}throw Error('Timed out: '+(ui('log-body')?.textContent||''))}
const state={calls:0,names:[],summaries:[],errors:[],opened:[],pausedConfirmed:false,earlySuccess:false};
const queue=['draft_0','draft_1','draft_2'];let current;
window.confirm=()=>{if(id==='account-switch-confirm')window.WIZ_global_data.oPEP7c='second@example.com';return true};
window.alert=message=>state.summaries.push(String(message));
window.addEventListener('error',event=>state.errors.push(event.message));
window.addEventListener('unhandledrejection',event=>state.errors.push(String(event.reason)));
document.getElementById('mode').textContent=failed?'Failed':'Saved draft';
function toast(message){
  let node=document.querySelector('mat-snack-bar-container');
  if(!node){node=document.createElement('mat-snack-bar-container');document.getElementById('notices').append(node)}
  node.textContent=message;
}
function showContinue(name){
  current=name;state.opened.push(name);
  if(id==='account-switch-submission')window.WIZ_global_data.oPEP7c='second@example.com';
  document.getElementById('overlay').replaceChildren();
  const button=document.createElement('button');button.textContent='Continue and preview job';
  button.onclick=()=>showPreview(name);
  document.getElementById('request').replaceChildren(button);
}
function renderRows(){
  const body=document.getElementById('rows');body.replaceChildren();
  for(const name of queue){
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
  if(!failed){queue.splice(queue.indexOf(name),1);renderRows()}
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
    if(id==='delayed-success'){
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
  assert(state.calls===0&&state.opened.length===0,'Panel controls submitted a job');
  assert(state.errors.length===0,state.errors.join('; '));
  parent.postMessage({type:'af3-case-result',result:{passed:true,message:'live quota, pointer/keyboard resize, restore and viewport bounds; 0 submits'}},location.origin);
  return false;
}
renderRows();
if(id==='old-success')toast('Job successfully launched.');
async function checkAccountEmail(){
  assert(ui('account-email'),'Current account email display is missing');
  const email=()=>ui('account-email').textContent;
  const shown=async value=>{await until(()=>email()==='当前账号：'+value,2500)};
  const unknown=async()=>{await until(()=>email().includes('未识别'),2500)};
  await unknown();
  const job=document.createElement('p');job.textContent='job.owner@example.com';document.getElementById('rows').append(job);
  window.WIZ_global_data={oPEP7c:'first.account@example.com'};await shown('first.account@example.com');
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
  const records=JSON.parse(localStorage.getItem(accountsKey)).accounts;
  assert(records.some(item=>item.email==='bootstrap.account@example.com'),'Recognized account was not saved');
  assert(!records.some(item=>item.email==='job.owner@example.com'),'Task owner was saved as a signed-in account');
  assert(state.calls===0&&state.opened.length===0&&state.errors.length===0,'Account readback triggered a task or script error');
  parent.postMessage({type:'af3-case-result',result:{passed:true,message:'email readback, account changes, visible profile priority, unknown/logout, bootstrap, languages; 0 submits'}},location.origin);
}
function assertAccountSwitchUrl(login){
  const logout=new URL(login.href);
  assert(logout.origin===location.origin&&logout.pathname==='/accounts/ClearOSID','Switch must exit the existing website session before signing in');
  const chooser=new URL(logout.searchParams.get('continue'));
  assert(chooser.origin==='https://accounts.google.com'&&chooser.pathname==='/AccountChooser','Switch must show Google account selection');
  const signin=new URL(chooser.searchParams.get('continue'));
  assert(signin.origin===location.origin&&signin.pathname==='/signin','Account selection must return to the official sign-in entry');
  assert(chooser.searchParams.get('osid')==='1'&&chooser.searchParams.get('followup')===signin.href,'Account selection must retain the website sign-in handoff');
  assert(login.target==='_self','Switch must replace the old account page in the same tab');
}
function assertAccountSwitchBlocked(){
  const login=ui('account-login');
  assert(login.getAttribute('aria-disabled')==='true'&&!login.hasAttribute('href')&&login.tabIndex===-1,'Running task left an actionable account switch');
  for(const type of ['click','auxclick']){
    // Even a stale link restored before the next render must not navigate.
    login.href='/accounts/ClearOSID';
    let blocked=false;
    login.addEventListener(type,event=>{blocked=event.defaultPrevented;event.preventDefault()},{once:true});
    login.dispatchEvent(new MouseEvent(type,{cancelable:true,button:type==='auxclick'?1:0}));
    assert(blocked,'Running task allowed '+type+' to exit the website session');
  }
}
async function checkAccountManager(){
  const records=()=>JSON.parse(localStorage.getItem(accountsKey)||'{"accounts":[]}').accounts;
  const cards=()=>Array.from(ui('accounts-list').querySelectorAll('article'));
  const card=email=>cards().find(node=>node.dataset.email===email);
  const save=(email,note='')=>{ui('account-input').value=email;ui('account-note').value=note;ui('account-form').dispatchEvent(new Event('submit',{cancelable:true}))};
  ui('accounts-tab').click();
  assert(ui('tasks-page').hidden&&!ui('accounts-page').hidden,'Account tab did not switch pages');
  assert(ui('accounts-tab').getAttribute('aria-selected')==='true','Account tab is not selected accessibly');
  const login=ui('account-login');
  assertAccountSwitchUrl(login);
  if(id==='account-login'){
    save('saved@example.com','Keep this record');
    const before=localStorage.getItem(accountsKey);
    let prevented=true;
    login.addEventListener('click',event=>{prevented=event.defaultPrevented;event.preventDefault()},{once:true});
    login.click();
    assert(!prevented,'Idle switch did not allow official navigation');
    assert(localStorage.getItem(accountsKey)===before,'Switch removed saved accounts or notes');
    assert(ui('account-login-help').textContent.includes('退出'),'Switch does not explain that it exits the current session');
  }else if(id==='account-storage'||id==='account-storage-blocked'){
    save('memory@example.com','first');save('another@example.com','second');
    assert(cards().length===2&&card('memory@example.com').textContent.includes('first'),'Unavailable storage lost in-page records');
    assert(ui('accounts-message').textContent.includes('当前页面有效'),'Unavailable storage did not report memory-only mode');
    if(id==='account-storage')assert(localStorage.getItem(accountsKey)==='{invalid','Corrupt stored data was overwritten');
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
  }else if(id==='account-cross-tab'){
    save('original@example.com','original');
    const frame=document.createElement('iframe');frame.src='/case?id=storage-writer';frame.hidden=true;
    const loaded=new Promise(resolve=>frame.onload=resolve);document.body.append(frame);await loaded;
    frame.contentWindow.localStorage.setItem(accountsKey,JSON.stringify({version:1,accounts:[{email:'original@example.com',note:'Other tab',quota:null},{email:'other@example.com',note:'Shared',quota:null}]}));
    await until(()=>card('other@example.com')&&card('original@example.com').textContent.includes('Other tab'),2500);
    save('third@example.com','third');assert(records().length===3,'Writing discarded another tab records');
    frame.contentWindow.localStorage.removeItem(accountsKey);
    await until(()=>cards().length===0,2500);frame.remove();
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
  parent.postMessage({type:'af3-case-result',result:{passed:true,message:'account page, local records, quota source and manual login entry; 0 submits'}},location.origin);
  return true;
}
(async()=>{
  const script=document.createElement('script');
  // The fixture authorizes only its script URL; it must not create a default
  // TrustedHTML policy that would hide unsafe HTML writes inside the userscript.
  const scriptPolicy=id==='startup-trusted-types'?trustedTypes.createPolicy('af3-fixture-script',{createScriptURL:value=>value}):null;
  script.src=scriptPolicy?scriptPolicy.createScriptURL('/script.js'):'/script.js';
  await new Promise((resolve,reject)=>{script.onload=resolve;script.onerror=()=>reject(Error('Cannot load userscript'));document.head.append(script)});
  if(id==='startup-trusted-types'){
    assert(state.errors.length===0,'Startup error under the website CSP: '+state.errors.join('; '));
    await until(()=>ui('v20-btn')&&ui('accounts-tab'),5000);
    assert(ui('tasks-page').getClientRects().length,'Tasks page was not rendered under Trusted Types');
    ui('accounts-tab').click();
    assert(ui('accounts-page').getClientRects().length,'Account page was not rendered under Trusted Types');
    assertAccountSwitchUrl(ui('account-login'));
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
  if(id==='account-email'){await until(()=>ui('v20-btn'),5000);await checkAccountEmail();return}
  if(['account-manager','account-login','account-quota','account-persistence','account-storage','account-storage-blocked','account-cross-tab'].includes(id)){await until(()=>ui('v20-btn'),5000);await checkAccountManager();return}
  if(id==='storage-writer')return;
  if(id==='panel-ui'){
    await until(()=>ui('v20-btn'),5000);
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
    assertAccountSwitchBlocked();
    ui('stop-btn').click();
    await until(()=>state.summaries.length>0);
    assertAccountSwitchUrl(ui('account-login'));
    assert(ui('account-login').getAttribute('aria-disabled')==='false','Switch did not recover after stopping');
    assert(state.calls===0&&state.errors.length===0,'Switch during processing submitted a job or caused an error');
    parent.postMessage({type:'af3-case-result',result:{passed:true,message:'switch blocked during submission, including stale click/auxclick; restored after stop; 0 submits'}},location.origin);return;
  }
  if(id==='account-switch-confirm'){
    ui('v20-btn').click();await pause(600);
    assert(state.calls===0&&state.opened.length===0&&state.errors.length===0,'Account change during confirmation started a batch');
    parent.postMessage({type:'af3-case-result',result:{passed:true,message:'account changed in confirmation; 0 task opens or submits'}},location.origin);return;
  }
  ui('v20-count').value=['multi-success','stale-row','server-error','failed-error'].includes(id)?2:1;
  ui('v20-btn').click();
  await until(()=>state.summaries.length>0);
  // Two polling intervals must not silently re-enable a blocked start button.
  await pause(1100);
  const successes=successCount();
  assert(state.errors.length===0,state.errors.join('; '));
  if(id==='account-switch-submission'){
    assert(state.calls===0,'Account switch during a batch still clicked Confirm');
    assert(ui('v20-btn').disabled,'Account change did not lock Start');
    assert(ui('footer-msg').textContent.includes('账号已变化'),'Account change did not explain why processing stopped');
  }else if(['delayed-success','failed-success','paused-success'].includes(id)){
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
  if(id==='failed-error')assert(!state.earlySuccess,'Failed clone was called submitted before the server response');
  if(id==='paused-success')assert(state.pausedConfirmed,'Success received during pause was not processed until resume');
  parent.postMessage({type:'af3-case-result',result:{passed:true,message:'confirm clicks='+state.calls+', confirmed='+successes}},location.origin);
})().catch(error=>parent.postMessage({type:'af3-case-result',result:{passed:false,message:error.message}},location.origin));
</script>'''


SCENARIOS = [
    'startup-trusted-types', 'panel-ui', 'account-email', 'account-manager', 'account-login', 'account-login-busy', 'account-quota', 'account-persistence',
    'account-storage', 'account-storage-blocked', 'account-cross-tab', 'account-switch-submission', 'account-switch-confirm',
    'delayed-success', 'old-success', 'server-error', 'no-toast',
    'failed-success', 'failed-error', 'stop-in-flight', 'stale-row',
    'multi-success', 'paused-success',
]


def main():
    source = Path(__file__).with_name('af3-auto-submitter.dev.user.js')
    if os.environ.get('AF_TEST_UPSTREAM') == '1':
        script = subprocess.check_output(['git', 'show', f'upstream/main:{source.name}'], cwd=source.parent)
    else:
        script = source.read_bytes()
    scenarios = [name.strip() for name in os.environ.get('AF_TEST_CASES', ','.join(SCENARIOS)).split(',') if name.strip()]
    if not scenarios or set(scenarios) - set(SCENARIOS):
        raise SystemExit('Unknown or empty AF_TEST_CASES selection.')
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
            path = self.path.split('?', 1)[0]
            if path not in ('/', '/case', '/script.js'):
                self.send_error(404)
                return
            self.send_response(200)
            self.send_header('Content-Type', 'application/javascript; charset=utf-8' if path == '/script.js' else 'text/html; charset=utf-8')
            if path == '/case' and self.path.split('?', 1)[-1] == 'id=startup-trusted-types':
                self.send_header('Content-Security-Policy', "require-trusted-types-for 'script'")
            self.end_headers()
            self.wfile.write(script if path == '/script.js' else CASE.encode('utf-8') if path == '/case' else page)

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
                deadline = time.monotonic() + max(300, 6 * len(scenarios))
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
