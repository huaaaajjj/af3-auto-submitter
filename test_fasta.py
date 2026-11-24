"""Account-free FASTA integration checks using the full release userscript in Edge.

Run all cases with ``python -B test_fasta.py`` or choose comma-separated IDs via
AF_FASTA_TEST_CASES. Filesystem handles are in-memory; File/DataTransfer/events
are browser-native. No OS picker, account, protein files or network are used.
Only unconfirmed cases shorten FASTA_IMPORT_TIMEOUT; polling stays real.
"""

import os
from pathlib import Path
import runpy
from unittest.mock import patch


CASE = r'''<!doctype html><meta charset="utf-8"><title>Synthetic FASTA fixture</title>
<style>
body{font:14px sans-serif}gdm-af-history,gdm-af-request,gdm-af-upload-dialog,mat-paginator,mat-chip-option{display:block}
button,input{margin:4px}td,th{padding:6px}.job{display:block}
</style>
<gdm-af-request><div class="points">Remaining jobs: 30</div></gdm-af-request>
<button id="native-upload">Upload JSON</button>
<gdm-af-history>
<input placeholder="Search History">
<div id="filters">
<mat-chip-option><button aria-selected="true">Saved draft</button></mat-chip-option>
<mat-chip-option><button aria-selected="false">Completed</button></mat-chip-option>
<mat-chip-option><button aria-selected="false">Failed</button></mat-chip-option>
<mat-chip-option><button aria-selected="false">In progress</button></mat-chip-option>
</div>
<table><thead><tr><th class="mat-column-status">Status</th><th>Name</th><th>Modified</th></tr></thead><tbody id="rows"></tbody></table>
<mat-paginator><select aria-label="Items per page"><option value="10">10</option><option value="20">20</option><option value="100">100</option></select>
<button aria-label="First page">First</button><button aria-label="Previous page">Previous</button>
<span class="mat-mdc-paginator-range-label"></span><button aria-label="Next page">Next</button>
</mat-paginator></gdm-af-history>
<div id="overlay"></div><div id="notices"></div>
<script>
'use strict';
const id=new URLSearchParams(location.search).get('id');
localStorage.setItem('af3-dev-panel-language','en');
window.WIZ_global_data={oPEP7c:'fixture@example.com'};
const owner='fixture@example.com';
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const ui=name=>document.getElementById('af3-dev-panel')?.shadowRoot?.getElementById('af3-'+name);
const assert=(value,message)=>{if(!value)throw Error(message)};
async function until(read,label,timeout=16000){const end=Date.now()+timeout;while(Date.now()<end){if(read())return;await pause(25)}throw Error('Timed out: '+label+'; '+ui('fasta-status')?.textContent)}
const state={history:[],page:0,pageSize:10,sizeChanges:[],pageMoves:[],uploads:[],saves:[],validations:0,closed:0,pickers:0,commits:[],aborts:0,
    confirms:[],confirmValue:true,behavior:'success',nativeSaved:0,rowOpens:0,predictions:0,errors:[],transports:[],writeError:'',pickerMode:'normal',pageDelay:90};
window.addEventListener('error',event=>state.errors.push(event.message));
window.addEventListener('unhandledrejection',event=>state.errors.push(String(event.reason)));
window.confirm=message=>{state.confirms.push(String(message));if(String(message).startsWith('Upload batch'))state.uploadAuthorized=state.confirmValue;if(state.changeOnConfirm)window.WIZ_global_data.oPEP7c='other@example.com';return state.confirmValue};
window.alert=()=>{};
for(const name of ['fetch','GM_xmlhttpRequest','GM_download'])window[name]=()=>{state.transports.push(name);throw Error('Unexpected transport '+name)};
XMLHttpRequest.prototype.open=function(){state.transports.push('XHR');throw Error('Unexpected XHR')};
navigator.sendBeacon=()=>{state.transports.push('beacon');throw Error('Unexpected beacon')};
URL.createObjectURL=()=>{state.transports.push('blob URL');throw Error('Unexpected blob URL')};
window.GM_openInTab=()=>{throw Error('Unexpected account window')};
const notFound=name=>new DOMException('Missing '+name,'NotFoundError');
// The committed map changes only on close, matching FileSystemWritableFileStream.
class MemoryDirectory {
 constructor(name){this.kind='directory';this.name=name;this.files=new Map();this.directories=new Map()}
 async getDirectoryHandle(name,options={}){if(name==='results'&&options.create&&state.resultsError)throw new DOMException('Cannot create results folder',state.resultsError);if(!this.directories.has(name)){if(!options.create)throw notFound(name);this.directories.set(name,new MemoryDirectory(name))}return this.directories.get(name)}
 async getFileHandle(name,options={}){
  if(!this.files.has(name)){if(!options.create)throw notFound(name);this.files.set(name,'')}
  const dir=this;
  return {kind:'file',name,async getFile(){if(!dir.files.has(name))throw notFound(name);return new File([dir.files.get(name)],name,{type:'text/plain'})},
   async createWritable(options={}){state.writerModes??=[];state.writerModes.push(options.mode);let staged=null,ended=false;return {
    async write(value){if(ended)throw Error('Closed writer');if(state.writeError===name||state.writeError==='*'||(name==='manifest.json'&&state.failPhase&&JSON.parse(value).batches.some(batch=>batch.attempts.some(attempt=>attempt.phase===state.failPhase))))throw Error('Synthetic write denied');staged=await new Blob([value]).text()},
    async close(){
     if(ended)throw Error('Closed writer');assert(staged!==null,'Writer closed without content');
     if(state.closeError===name)throw Error('Synthetic close failure');
     dir.files.set(name,staged);state.commits.push({dir:dir.name,name,text:staged});ended=true;
     if(name==='manifest.json'&&state.stopAtSaveJournal&&!state.stoppedAtJournal&&JSON.parse(staged).batches.some(batch=>batch.attempts.at(-1)?.saveClickedAt)){
      state.stoppedAtJournal=true;ui('fasta-stop').click();
     }
    },
    async abort(){ended=true;state.aborts++}
   }}
  };
 }
}
const parentDir=new MemoryDirectory('synthetic-output');let chosenDir=parentDir;
window.showDirectoryPicker=async options=>{
 state.pickers++;assert(options.mode==='readwrite','Picker must request writable handles');
 if(state.pickerMode==='cancel')throw new DOMException('Synthetic cancellation','AbortError');
 if(state.pickerMode==='deferred')await new Promise(resolve=>state.releasePicker=resolve);
 return chosenDir;
};
const picker=window.showDirectoryPicker;
function filters(names){for(const button of document.querySelectorAll('#filters button'))button.setAttribute('aria-selected',String(names.includes(button.textContent)));state.page=0;renderHistory()}
for(const button of document.querySelectorAll('#filters button'))button.onclick=()=>filters([button.textContent]);
function visibleHistory(){const names=Array.from(document.querySelectorAll('#filters button[aria-selected="true"]'),n=>n.textContent);return state.history.filter(job=>job.account===window.WIZ_global_data.oPEP7c&&names.includes(job.status))}
const historyTable=document.querySelector('gdm-af-history table'),emptyHistory=document.createElement('div');
emptyHistory.className='loading';emptyHistory.textContent='No jobs found with filters specified';
function renderHistory(){
 const jobs=visibleHistory();state.page=Math.min(state.page,Math.max(0,Math.ceil(jobs.length/state.pageSize)-1));const body=historyTable.querySelector('tbody');body.replaceChildren();
 for(const job of jobs.slice(state.page*state.pageSize,(state.page+1)*state.pageSize)){
  const row=document.createElement('tr');if(!state.omitIds)row.dataset.jobId=job.id;row.className='mat-mdc-row';
  const status=document.createElement('td');status.className='mat-column-status';status.textContent=job.status;const checkbox=document.createElement('input');checkbox.type='checkbox';status.append(checkbox);
  const name=document.createElement('td');name.className='mat-column-name';name.textContent=job.name;const date=document.createElement('td');date.className='mat-column-date';date.textContent=job.modified||'2026-11-16 12:00';
  row.append(status,name,date);row.onclick=()=>{state.rowOpens++;if(id==='fasta-presubmit-record')showPrediction(job)};body.append(row);
  if(id.startsWith('fasta-menu-')){
   const cell=document.createElement('td');cell.className='mat-column-options';
   const trigger=document.createElement('button');trigger.className='fold-actions';trigger.setAttribute('aria-haspopup','menu');trigger.setAttribute('aria-expanded','false');
   const icon=document.createElement('mat-icon');icon.textContent='more_vert';trigger.append(icon);cell.append(trigger);row.append(cell);
   trigger.onclick=event=>{
    event.stopPropagation();
    if(trigger.getAttribute('aria-expanded')==='true'){
     document.getElementById(trigger.getAttribute('aria-controls'))?.remove();trigger.setAttribute('aria-expanded','false');trigger.removeAttribute('aria-controls');state.menuCloses=(state.menuCloses||0)+1;return;
    }
    state.menuReads=(state.menuReads||0)+1;
    const panel=document.createElement('div');panel.id='history-menu-'+state.menuReads;panel.setAttribute('role','menu');
    const link=document.createElement('a');link.textContent='Open results';link.href=(id==='fasta-menu-foreign'?'https://other.invalid':'')+'/fold/'+job.id;
    link.onclick=e=>{e.preventDefault();state.rowOpens++};panel.append(link);
    if(id==='fasta-menu-conflict'){const other=link.cloneNode(true);other.href='/fold/different-id';panel.append(other)}
    document.getElementById('overlay').append(panel);trigger.setAttribute('aria-expanded','true');trigger.setAttribute('aria-controls',panel.id);
    if(id==='fasta-menu-stop')ui('fasta-stop').click();
    if(id==='fasta-menu-account')window.WIZ_global_data.oPEP7c='other@example.com';
    if(id==='fasta-menu-row-change')name.textContent='changed_name';
   };
  }
 }
 const paginator=document.querySelector('mat-paginator');
 paginator.querySelector('[aria-label="First page"]').disabled=state.page===0;
 paginator.querySelector('[aria-label="Previous page"]').disabled=state.page===0;
 paginator.querySelector('[aria-label="Next page"]').disabled=(state.page+1)*state.pageSize>=jobs.length;
 paginator.querySelector('.mat-mdc-paginator-range-label').textContent=state.rangeOverride??(jobs.length?`${state.page*state.pageSize+1} – ${Math.min((state.page+1)*state.pageSize,jobs.length)} of ${jobs.length}`:'0 of 0');
 if(id==='fasta-empty-history'){
  if(jobs.length){emptyHistory.remove();paginator.before(historyTable)}
  else{historyTable.remove();paginator.before(emptyHistory)}
 }
}
const pageSelect=document.querySelector('mat-paginator select');
pageSelect.onchange=()=>{
 state.page=Math.floor(state.page*state.pageSize/Number(pageSelect.value));state.pageSize=Number(pageSelect.value);state.sizeChanges.push(state.pageSize);
 if(id==='fasta-page-size-native-failed'){pageSelect.value='10';state.pageSize=10}
 renderHistory();
};
for(const [label,change] of [['First page',()=>0],['Previous page',()=>state.page-1],['Next page',()=>state.page+1]])document.querySelector(`[aria-label="${label}"]`).onclick=()=>{
 const target=change();state.pageMoves.push(target);
 if(id.startsWith('fasta-history-placeholders')){
  state.page=target;renderHistory();
  document.querySelectorAll('#rows .mat-column-name,#rows .mat-column-date').forEach(cell=>cell.replaceChildren());
  setTimeout(renderHistory,state.pageDelay);return;
 }
 const spinner=document.createElement('mat-spinner');spinner.textContent='Loading';document.querySelector('gdm-af-history').append(spinner);
 setTimeout(()=>{state.page=target;renderHistory();spinner.remove()},state.pageDelay);
};
function showPrediction(job){
 const request=document.querySelector('gdm-af-request');request.querySelector('.continue')?.remove();
 const next=document.createElement('button');next.className='continue';next.textContent='Continue and preview job';
 next.onclick=()=>{
  next.remove();const dialog=document.createElement('gdm-af-preview-dialog');dialog.setAttribute('role','dialog');
  const name=document.createElement('div');name.className='name';const input=document.createElement('input');input.value=job.name;name.append(input);
  const quota=document.createElement('p');quota.textContent='Remaining jobs: 30';
  const confirm=document.createElement('button');confirm.textContent='Confirm and submit job';
  confirm.onclick=()=>{state.predictions++;const notice=document.createElement('mat-snack-bar-container');notice.textContent='Job successfully launched.';document.getElementById('notices').append(notice);dialog.remove()};
  dialog.append(name,quota,confirm);document.getElementById('overlay').append(dialog);
 };request.append(next);
}
function addHistory(jobs,status='Saved draft',account=owner){for(const job of jobs)if(!state.history.some(old=>old.name===job.name&&old.account===account))state.history.push({name:job.name,id:'fixture-'+(state.history.length+1),status,account});renderHistory()}
addHistory(Array.from({length:112},(_,i)=>({name:'unrelated_'+i})));
if(id.startsWith('fasta-page-size-material')){
 const control=document.createElement('mat-select'),value=document.createElement('span');
 control.setAttribute('role','combobox');control.setAttribute('aria-expanded','false');
 value.className='mat-mdc-select-value';value.textContent='10';control.append(value);pageSelect.replaceWith(control);
 const decoy=document.createElement('mat-option');decoy.setAttribute('role','option');decoy.textContent='100';
 decoy.onclick=()=>state.foreignOptionClicks=(state.foreignOptionClicks||0)+1;document.getElementById('overlay').append(decoy);
 control.onkeydown=event=>{
  if(event.key==='Escape'){event.stopPropagation();document.getElementById('fasta-size-panel')?.remove();control.setAttribute('aria-expanded','false');control.removeAttribute('aria-controls');control.removeAttribute('aria-owns')}
 };
 control.onclick=()=>{
  state.selectOpens=(state.selectOpens||0)+1;
  if(control.getAttribute('aria-expanded')==='true'){
   document.getElementById('fasta-size-panel')?.remove();control.setAttribute('aria-expanded','false');control.removeAttribute('aria-controls');control.removeAttribute('aria-owns');return;
  }
  control.setAttribute('aria-expanded','true');
  if(id==='fasta-page-size-material-account')setTimeout(()=>{window.WIZ_global_data.oPEP7c='other@example.com';renderHistory()},30);
  if(id==='fasta-page-size-material-stop')setTimeout(()=>ui('fasta-stop').click(),30);
  if(id==='fasta-page-size-material-stop-late')setTimeout(()=>ui('fasta-stop').click(),90);
  setTimeout(()=>{
   if(control.getAttribute('aria-expanded')!=='true')return;
   const panel=document.createElement('div');panel.id='fasta-size-panel';panel.setAttribute('role','listbox');panel.onkeydown=control.onkeydown;
   control.setAttribute(id==='fasta-page-size-material-owns'?'aria-owns':'aria-controls',panel.id);
   const values=id==='fasta-page-size-material-missing'?['10','20']:id==='fasta-page-size-material-duplicate'?['10','100','100']:['10','20','100'];
   for(const text of values){
    const option=document.createElement('mat-option');option.setAttribute('role','option');option.textContent=text;
    option.onclick=()=>{
     state.sizeOptionClicks=(state.sizeOptionClicks||0)+1;panel.remove();control.setAttribute('aria-expanded','false');control.removeAttribute('aria-controls');control.removeAttribute('aria-owns');
     setTimeout(()=>{
      const size=Number(text);state.page=Math.floor(state.page*state.pageSize/size);state.pageSize=size;state.sizeChanges.push(size);value.textContent=' '+text+' ';
      const spinner=document.createElement('mat-spinner');document.querySelector('gdm-af-history').append(spinner);
      setTimeout(()=>{renderHistory();spinner.remove()},100);
      if(id==='fasta-page-size-material-user-change')setTimeout(()=>{value.textContent='20';state.pageSize=20;renderHistory()},30);
     },70);
    };panel.append(option);
   }
   document.getElementById('overlay').append(panel);
  },100);
 };
}
function cancelDialog(dialog){if(dialog.isConnected){dialog.remove();state.closed++}}
document.getElementById('native-upload').onclick=()=>{
 assert(state.uploadAuthorized,'Upload occurred before explicit confirmation');state.uploadAuthorized=false;
 const dialog=document.createElement('gdm-af-upload-dialog');dialog.setAttribute('role','dialog');
 const input=document.createElement('input');input.type='file';input.accept='.json';
 const jobsNode=document.createElement('div');jobsNode.className='jobs';
 const confirm=document.createElement('button');confirm.className='confirm';confirm.disabled=true;confirm.textContent='Submit job as draft';
 const cancel=document.createElement('button');cancel.textContent='Cancel';cancel.onclick=()=>cancelDialog(dialog);
 const prediction=document.createElement('button');prediction.textContent='Confirm and submit';prediction.onclick=()=>state.predictions++;
 dialog.append(input,jobsNode,confirm,cancel,prediction);document.getElementById('overlay').append(dialog);
 const attempt={dialog,input,changes:0,jobs:[],saveClicks:0,behavior:state.behavior,account:window.WIZ_global_data.oPEP7c};state.uploads.push(attempt);
 input.addEventListener('change',async event=>{
  try{
   assert(event instanceof Event&&event.bubbles,'Expected a real bubbling input change');assert(input.files instanceof FileList&&input.files.length===1&&input.files[0] instanceof File,'Expected native File/DataTransfer selection');
   attempt.changes++;assert(attempt.changes===1,'File selection was retried');attempt.file=input.files[0];attempt.jobs=JSON.parse(await attempt.file.text());
   const journal=manifest(state.activeDir).batches.find(batch=>batch.jsonFile===attempt.file.name);assert(journal?.status==='validating'&&journal.account===attempt.account&&journal.attempts.at(-1)?.phase==='validation','Validation began before durable attempt journal');
   for(const job of attempt.jobs){const row=document.createElement('div');row.className='job processing';const name=document.createElement('span');name.className='name';name.textContent=job.name;row.append(name);jobsNode.append(row)}
   confirm.textContent=attempt.jobs.length===1?'Submit job as draft':`Submit ${attempt.jobs.length} jobs as drafts`;
   if(attempt.behavior==='validation-timeout')return;
   setTimeout(()=>{for(const row of jobsNode.children)row.className='job '+(attempt.behavior==='warning'?'warning':'ok');state.validations++;confirm.disabled=attempt.behavior==='warning'},180);
  }catch(error){state.errors.push(String(error))}
 });
 confirm.onclick=()=>{
  attempt.saveClicks++;assert(attempt.saveClicks===1,'Draft save was retried');assert(attempt.changes===1&&!confirm.disabled,'Draft save before successful validation');
  assert(Array.from(jobsNode.children).every(row=>row.classList.contains('ok')),'Draft save bypassed native validation');
  const journal=manifest(state.activeDir).batches.find(batch=>batch.jsonFile===attempt.file.name);assert(journal?.status==='uncertain'&&journal.attempts.at(-1)?.saveClickedAt,'Draft save sent before durable uncertainty journal');state.saves.push(attempt);
  if(id==='fasta-import-streaming'){
   cancelDialog(dialog);
   const spinner=document.createElement('mat-spinner');document.querySelector('gdm-af-history').append(spinner);
   attempt.jobs.forEach((job,index)=>setTimeout(()=>{addHistory([job],'Saved draft',attempt.account);state.nativeSaved++;if(index===attempt.jobs.length-1)spinner.remove()},350*(index+1)));
   return;
  }
  setTimeout(()=>{
   const jobs=attempt.behavior==='partial'?attempt.jobs.slice(0,7):attempt.jobs;
   addHistory(jobs,'Saved draft',attempt.account);state.nativeSaved+=jobs.length;
   if(attempt.behavior!=='unclosed')cancelDialog(dialog);
  },260);
 };
};
function choose(text,name='synthetic.fasta'){
 const transfer=new DataTransfer();transfer.items.add(new File([text],name,{type:'text/plain'}));ui('fasta-file').files=transfer.files;ui('fasta-file').dispatchEvent(new Event('change',{bubbles:true}));
}
const sequence='ACDEFGHIKLMNPQRSTVWY';
const fasta=count=>Array.from({length:count},(_,i)=>'>synthetic_'+(i+1)+'\n'+sequence+'\n').join('');
const busy=()=>!ui('fasta-stop').hidden;
async function settled(){await until(()=>!busy(),'FASTA operation end')}
async function clickFasta(action){assert(!ui('fasta-'+action).disabled,'Disabled FASTA action: '+action);ui('fasta-'+action).click();await settled()}
async function generate(text=fasta(31),name='synthetic.fasta'){
 chosenDir=parentDir;choose(text,name);await clickFasta('generate');
 const dirs=Array.from(parentDir.directories.values());const dir=dirs.at(-1);assert(dir?.files.has('manifest.json'),'Manifest not committed: '+ui('fasta-status').textContent);state.activeDir=dir;return dir;
}
const manifest=dir=>JSON.parse(dir.files.get('manifest.json'));
async function hash(text){return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text))),n=>n.toString(16).padStart(2,'0')).join('')}
async function checkFiles(dir,text,count){
 const m=manifest(dir);assert(m.format==='af3-fasta-batches'&&m.version===1&&m.generationComplete,'Wrong manifest format or incomplete generation');
 assert(m.source.records===count&&m.source.sha256===await hash(text),'Source record count/hash mismatch');
 assert(m.settings.batchSize===30&&m.summary.generated===count,'Generation count/batch size mismatch');
 assert(m.batches.length===Math.ceil(count/30),'Wrong boundary split: '+count);
 assert(dir.files.size===m.batches.length*2+1,'Missing/extra batch files');
 assert(dir.directories.get('results')?.kind==='directory','Generation did not create results beside manifest.json');
 const names=new Set();let seen=0;
 for(const batch of m.batches){
  const json=dir.files.get(batch.jsonFile),savedFasta=dir.files.get(batch.fastaFile),jobs=JSON.parse(json);
  assert(await hash(json)===batch.jsonSha256&&await hash(savedFasta)===batch.fastaSha256,'Batch hash mismatch');
  assert(jobs.length===Math.min(30,count-seen)&&jobs.length===batch.jobs.length,'Batch exceeds 30 or drops records');
  assert((savedFasta.match(/^>/gm)||[]).length===jobs.length,'FASTA batch record count mismatch');
  for(const [i,job] of jobs.entries()){
   assert(job.dialect==='alphafoldserver'&&job.version===1&&job.modelSeeds.length===0,'Wrong server JSON dialect');
   assert(job.name===batch.jobs[i].name&&job.name.length<=100&&!names.has(job.name),'Truncated/colliding/incorrect task name');names.add(job.name);
   assert(batch.jobs[i].record===++seen&&batch.jobs[i].importStatus==='pending'&&batch.jobs[i].predictionStatus==='unknown','Generated job is not pending/unknown');
  }
 }
 assert(seen===count&&!m.importComplete&&!m.predictionComplete&&m.summary.imported===0,'Generation falsely marks imported/complete');
 return m;
}
async function restore(dir){chosenDir=dir;await clickFasta('restore')}
function syntheticClick(node){node.dispatchEvent(new MouseEvent('click',{bubbles:true,cancelable:true}))}
function noCompletion(dir){const m=manifest(dir);assert(!m.importComplete&&!m.predictionComplete&&!m.predictionFinished,'Unconfirmed operation marked all complete');return m}
async function assertNoRetry(uploadCount,saveCount){await pause(1500);assert(state.uploads.length===uploadCount&&state.saves.length===saveCount,'Unconfirmed operation automatically retried')}
function assertSafe(){assert(state.predictions===0,'Prediction launched');assert(state.transports.length===0,'Unexpected transport '+state.transports);assert(!state.errors.length,state.errors.join('; '));assert(state.uploads.every(upload=>upload.saveClicks<=1),'Multiple draft-save clicks')}
(async()=>{
 const script=document.createElement('script');script.src='/script.js';await new Promise((resolve,reject)=>{script.onload=resolve;script.onerror=()=>reject(Error('Userscript load failed'));document.head.append(script)});
 await until(()=>ui('fasta-section'),'FASTA panel');assert(!ui('fasta-mode')&&!ui('fasta-tail'),'Protein layout and tail controls must be removed');
 if(id.startsWith('fasta-menu-')){
  const dir=await generate(fasta(2)),m=manifest(dir),batch=m.batches[0];state.omitIds=true;
  const save=new Date(Date.now()-60000).toISOString();batch.account=owner;
  batch.attempts=[{account:owner,startedAt:save,saveClickedAt:save,endedAt:save,result:'unconfirmed'}];
  for(const job of batch.jobs){job.submittedAt=new Date(Date.now()-30000).toISOString();job.predictionStatus='submitted'}
  dir.files.set('manifest.json',JSON.stringify(m));addHistory(batch.jobs,'Completed');filters(['Completed']);await restore(dir);
  const before=dir.files.get('manifest.json');await clickFasta('sync');const after=manifest(dir);
  if(id==='fasta-menu-identity'){
   assert(after.summary.completed===2&&after.batches[0].jobs.every(job=>job.jobId?.startsWith('fixture-')),'History marked complete without binding menu-only job IDs');
   assert(state.menuReads===2&&state.menuCloses===2,'Did not read and close exactly the tracked row menus');
  }else{
   assert(!after.batches[0].jobs.some(job=>job.jobId),'Unsafe menu identity was persisted');
   assert(dir.files.get('manifest.json')===before,'Failed identity resolution changed the manifest');
   if(['fasta-menu-stop','fasta-menu-account','fasta-menu-row-change'].includes(id))assert(state.menuCloses===1,'Owned menu was not closed after interruption');
  }
  assert(state.rowOpens===0&&!state.uploads.length&&!state.saves.length,'History identity lookup opened a prediction or uploaded files');
 }else if(id==='fasta-import-streaming'){
  const dir=await generate(fasta(30));await clickFasta('import');
  assert(manifest(dir).importComplete&&manifest(dir).summary.imported===30,'Streaming draft refresh exceeded the inner 8-second page wait: '+ui('fasta-status').textContent);
  assert(state.uploads.length===1&&state.saves.length===1&&state.nativeSaved===30,'Streaming verification retried the upload or draft save');
 }else if(id==='fasta-boundaries'){
  for(const count of [1,30,31,60,61]){const text=fasta(count);const dir=await generate(text);const m=await checkFiles(dir,text,count);assert(m.batches.map(batch=>batch.jobs.length).join(',')===Array.from({length:Math.ceil(count/30)},(_,i)=>Math.min(30,count-i*30)).join(','),'Boundary batch sizes wrong')}
  assert(state.uploads.length===0&&state.saves.length===0&&state.confirms.length===0,'Local generation uploaded data');
 }else if(id==='fasta-lines-names'){
  const headers=['duplicate header','duplicate header','long '+('Q'.repeat(180)),'long '+('Q'.repeat(180)),' spaced   title ','A'.repeat(99)+' description','job','job_2','job'];
  const text=headers.map(header=>'>'+header+'\nacdefghiklmnpqrstvwy\n').join('');let dir=await generate(text,'odd file name.fa');let m=await checkFiles(dir,text,headers.length);
  assert(m.batches[0].jobs.every((job,i)=>job.header===headers[i].trim()),'Headers not preserved in manifest');
  const jobs=JSON.parse(dir.files.get(m.batches[0].jsonFile));
  assert(jobs[0].name==='duplicate header'&&jobs[1].name==='duplicate header_2','Header is not used as the website job name');
  assert(jobs.slice(-3).map(job=>job.name).join(',')==='job,job_2,job_3','Naturally suffixed headers collide with duplicate names');
  assert(jobs[4].name==='spaced title'&&jobs[5].name==='A'.repeat(99),'Job names retain ambiguous whitespace after normalization/truncation');
  assert(jobs.every(job=>job.sequences.length===1&&job.sequences[0].proteinChain.sequence===sequence),'Single-line protein changed');
  const chains=['A'.repeat(75),'WQWQWQWQWQ','CDEF'];
  const multi='\uFEFF>title_claims_ACDEFGHIKL\r\n'+chains[0]+'\r\n\r\nwqwqwqwqwq\r\nC D E F\r\n';
  dir=await generate(multi);m=await checkFiles(dir,multi,1);
  const job=JSON.parse(dir.files.get(m.batches[0].jsonFile))[0];
  assert(job.name==='title_claims_ACDEFGHIKL'&&job.sequences.length===3,'Header or one-chain-per-line mapping failed');
  assert(JSON.stringify(job.sequences.map(entity=>entity.proteinChain.sequence))===JSON.stringify(chains),'Chains were concatenated or split by a peptide heuristic');
  assert(m.batches[0].jobs[0].chainLengths.join(',')==='75,10,4'&&m.settings.sequenceFormat==='protein-lines'&&!('mode' in m.settings)&&!('peptideLength' in m.settings),'Line format/chain lengths not recorded');
  assert(dir.files.get(m.batches[0].fastaFile)==='>title_claims_ACDEFGHIKL\n'+chains.join('\n')+'\n','FASTA output rewrapped a chain and changed its boundaries');
  const saved=dir.files.get(m.batches[0].fastaFile),roundtrip=await generate(saved);const roundM=manifest(roundtrip);
  assert(JSON.stringify(JSON.parse(roundtrip.files.get(roundM.batches[0].jsonFile))[0].sequences)===JSON.stringify(job.sequences),'Reimporting saved FASTA changed chain boundaries');
  await restore(dir);assert(!ui('fasta-import').disabled,'A saved three-chain job cannot be reopened');
  const edges=await generate('>limit\n'+'A'.repeat(2700)+'\n'+'G'.repeat(300)+'\n>repeated\nACDE\nACDE\n');
  const edgeJobs=JSON.parse(edges.files.get(manifest(edges).batches[0].jsonFile));
  assert(edgeJobs[0].sequences.map(entity=>entity.proteinChain.sequence.length).join(',')==='2700,300','Valid per-chain/total boundaries were concatenated');
  assert(edgeJobs[1].sequences.length===2&&edgeJobs[1].sequences.every(entity=>entity.proteinChain.count===1),'Identical lines were merged into one chain');
 }else if(id==='fasta-legacy-restore'){
  const generated=await generate(fasta(1)),original=new Map(generated.files);
  for(const mode of ['monomer','complex']){
   const dir=new MemoryDirectory('legacy-'+mode);dir.files=new Map(original);const m=manifest(dir),batch=m.batches[0],job=batch.jobs[0];
   delete m.settings.sequenceFormat;m.settings.mode=mode;m.settings.peptideLength=mode==='complex'?10:null;
   const chains=mode==='complex'?['A'.repeat(75),'W'.repeat(10)]:['A'.repeat(85)];
   job.name='af3_'+m.runId+'_00001_legacy';job.header='legacy';job.chainLengths=chains.map(chain=>chain.length);
   const json=JSON.stringify([{name:job.name,modelSeeds:[],sequences:chains.map(sequence=>({proteinChain:{sequence,count:1}})),dialect:'alphafoldserver',version:1}],null,2)+'\n';
   const fastaText='>legacy\n'+chains.join('').match(/.{1,60}/g).join('\n')+'\n';
   batch.jsonSha256=await hash(json);batch.fastaSha256=await hash(fastaText);dir.files.set(batch.jsonFile,json);dir.files.set(batch.fastaFile,fastaText);dir.files.set('manifest.json',JSON.stringify(m));
   await restore(dir);
   assert(!ui('fasta-import').disabled&&dir.files.get(batch.jsonFile)===json,'Restore reinterpreted a 4.0.0 '+mode+' job using new line boundaries');
  }
 }else if(id==='fasta-multichain-import'){
  const text=Array.from({length:31},(_,i)=>'>complex_'+i+'\nACDEFG\nHIKL\nMNPQRSTVWY\n').join('');
  const dir=await generate(text),m=await checkFiles(dir,text,31);
  assert(m.batches.map(batch=>batch.jobs.length).join(',')==='30,1','Chains were counted as separate jobs for batching');
  await restore(dir);await clickFasta('import');await clickFasta('import');
  assert(manifest(dir).importComplete&&manifest(dir).summary.imported===31,'Multichain batch import did not reconcile all jobs');
  assert(state.saves.length===2&&state.uploads.every(upload=>upload.jobs.every(job=>job.sequences.length===3&&job.sequences.every(chain=>Object.keys(chain).join(',')==='proteinChain'))),'Upload changed chain counts or included a non-protein entity');
 }else if(id==='fasta-invalid'){
  const invalid=['ACDE\n','>\nACDE\n','>   \nACDE\n','>empty\n>valid\nACDE\n','>valid\nACDE\n>empty\n',
   ...['B','Z','J','O','U','X','*','-',':','1','α','ß','ſ','ı','Ａ'].map(letter=>'>good\nACDE\n>bad\nACD'+letter+'E\n'),'>too-long\n'+'A'.repeat(2701)];
  for(const text of invalid){const before=parentDir.directories.size;choose(text);await clickFasta('generate');assert(parentDir.directories.size===before,'Invalid FASTA silently skipped/accepted a record');assert(/FASTA|amino|residue|header|chain/i.test(ui('fasta-status').textContent),'No invalid-FASTA diagnostic')}
  choose(new Uint8Array([62,97,10,255]));await clickFasta('generate');assert(parentDir.directories.size===0,'Invalid UTF-8 accepted');
  choose('>total\n'+'A'.repeat(2700)+'\n'+'G'.repeat(301)+'\n');await clickFasta('generate');assert(parentDir.directories.size===0,'Total residue limit bypassed across chains');
  assert(state.uploads.length===0,'Invalid input uploaded');
 }else if(id==='fasta-results-directory'){
  const dir=await generate(fasta(1));await checkFiles(dir,fasta(1),1);
  const results=dir.directories.get('results');
  assert(results&&results.files.size===0&&results.directories.size===0,'New results folder must be empty');
  results.files.set('saved-result.zip','Keep result bytes');
  await restore(dir);
  assert(dir.directories.get('results')===results&&results.files.get('saved-result.zip')==='Keep result bytes','Restore replaced existing results');
  for(const error of ['NotAllowedError','TypeMismatchError']){
   state.resultsError=error;choose(fasta(1));chosenDir=parentDir;await clickFasta('generate');
   const failed=Array.from(parentDir.directories.values()).at(-1);
   assert(!failed.files.has('manifest.json')||!manifest(failed).generationComplete,'Missing results folder was marked complete');
   assert(ui('fasta-import').disabled&&ui('fasta-status').textContent.includes('Cannot create results folder'),'Results creation error did not stop generation');
  }
  state.resultsError='';await checkFiles(await generate(fasta(1)),fasta(1),1);
  assert(state.uploads.length===0&&!state.transports.length,'Results folder creation started upload or network access');
 }else if(id==='fasta-local-errors'){
  await clickFasta('generate');assert(state.pickers===0&&/Choose a non-empty/.test(ui('fasta-status').textContent),'Missing input did not fail locally');
  choose('');await clickFasta('generate');assert(state.pickers===0,'Empty file invoked picker');
  window.showDirectoryPicker=undefined;choose(fasta(1));await clickFasta('generate');assert(/cannot choose/.test(ui('fasta-status').textContent)&&state.pickers===0,'Unsupported picker not handled');window.showDirectoryPicker=picker;
  state.pickerMode='cancel';await clickFasta('generate');assert(/Stopped/.test(ui('fasta-status').textContent)&&parentDir.directories.size===0,'Picker cancel created files');state.pickerMode='normal';
  for(const failure of ['synthetic_part001.fasta','synthetic_part001.json','manifest.json']){
   state.writeError=failure;choose(fasta(1));const before=state.commits.length;await clickFasta('generate');const dir=Array.from(parentDir.directories.values()).at(-1);
   assert(!dir.files.get(failure)&&state.commits.slice(before).every(commit=>commit.name!==failure),'Failed writer committed content before close');
   assert(/write|denied|stopped/i.test(ui('fasta-status').textContent)&&ui('fasta-import').disabled,'Write failure left import enabled');
  }
  assert(state.aborts===3&&state.uploads.length===0,'Write error not aborted, or data uploaded');
 }else if(id==='fasta-restore'){
  const dir=await generate();const original=new Map(dir.files);const m=manifest(dir),batch=m.batches[0];
  await restore(dir);assert(/Choose the batch folder/.test(ui('fasta-status').textContent),'Valid folder not restored');
  const invalidFolders=[
   files=>files.delete('manifest.json'),files=>files.delete(batch.jsonFile),files=>files.delete(batch.fastaFile),
   files=>files.set(batch.jsonFile,files.get(batch.jsonFile)+' '),files=>files.set(batch.fastaFile,files.get(batch.fastaFile)+'A'),
   files=>{const manifest=JSON.parse(files.get('manifest.json'));manifest.version=99;files.set('manifest.json',JSON.stringify(manifest))},
   files=>{const manifest=JSON.parse(files.get('manifest.json'));manifest.batches[0].jobs[1].name=manifest.batches[0].jobs[0].name;files.set('manifest.json',JSON.stringify(manifest))},
   files=>{const manifest=JSON.parse(files.get('manifest.json'));manifest.generationComplete=false;files.set('manifest.json',JSON.stringify(manifest))}
  ];
  for(const mutate of invalidFolders){const bad=new MemoryDirectory('tampered');bad.files=new Map(original);mutate(bad.files);const commits=state.commits.length;await restore(bad);assert(state.commits.length===commits,'Tampered/missing files were resumed and persisted');assert(/changed|invalid|Missing/i.test(ui('fasta-status').textContent),'Tampered folder lacks diagnostic')}
  const interrupted=new MemoryDirectory('interrupted');interrupted.files=new Map(original);const record=JSON.parse(interrupted.files.get('manifest.json'));
  record.batches[0].account=owner;record.batches[0].status='validating';record.batches[0].attempts=[{account:owner,startedAt:new Date().toISOString(),saveClickedAt:new Date().toISOString(),endedAt:null,result:'pending'}];interrupted.files.set('manifest.json',JSON.stringify(record));
  await restore(interrupted);assert(manifest(interrupted).batches[0].status==='uncertain'&&manifest(interrupted).batches[0].attempts[0].result==='interrupted'&&ui('fasta-import').disabled,'Interrupted draft save became automatically retryable');noCompletion(interrupted);
  assert(!state.uploads.length,'Restore uploaded data');
 }else if(id==='fasta-sync-feedback'||id==='fasta-history-placeholders'){
  const dir=await generate(fasta(1));addHistory(manifest(dir).batches[0].jobs);await clickFasta('sync');
  assert(/No script import records/.test(ui('fasta-status').textContent),'Generated-only history check silently returned to the idle text');
  assert(!manifest(dir).importComplete&&!state.uploads.length&&!state.saves.length,'Checking an unimported run uploaded or claimed jobs');
  state.history=state.history.filter(row=>row.name!==manifest(dir).batches[0].jobs[0].name);renderHistory();
  await clickFasta('import');filters(['Completed']);await clickFasta('sync');
  assert(/History check complete/.test(ui('fasta-status').textContent)&&/0\/1/.test(ui('fasta-status').textContent),'An empty-filter check did not show a zero-match result');
  assert(manifest(dir).lastHistoryCheck.matched===0&&manifest(dir).lastHistoryCheck.total===1,'Check result counts were not saved');
  filters(['Saved draft']);ui('fasta-sync').click();
  await until(()=>/Checking website history.*page/.test(ui('fasta-status').textContent),'History page progress');await settled();
  assert(/History check complete/.test(ui('fasta-status').textContent)&&/1\/1/.test(ui('fasta-status').textContent),'Successful history check has no persistent result');
  await pause(700);assert(/History check complete/.test(ui('fasta-status').textContent),'Status polling erased the check result');
  window.WIZ_global_data.oPEP7c='other@example.com';renderHistory();await clickFasta('sync');
  assert(/original import account/.test(ui('fasta-status').textContent),'Wrong-account history check gave no explanation');
  assert(manifest(dir).summary.imported===1&&!manifest(dir).predictionComplete,'Wrong-account check changed recorded results');
  window.WIZ_global_data.oPEP7c=owner;renderHistory();ui('language-select').value='zh';ui('language-select').dispatchEvent(new Event('change'));await clickFasta('sync');
  assert(/核对完成/.test(ui('fasta-status').textContent)&&/1\/1/.test(ui('fasta-status').textContent),'Chinese history result is missing');
  assert(state.uploads.length===1&&state.saves.length===1,'History check triggered another upload');
 }else if(id.startsWith('fasta-page-size-')){
  const dir=await generate(fasta(1)),original=dir.files.get('manifest.json');
  if(id==='fasta-page-size-already'){pageSelect.value='100';pageSelect.onchange();state.sizeChanges=[]}
  if(id==='fasta-page-size-native-missing')pageSelect.querySelector('[value="100"]').remove();
  const fails=/missing|failed|duplicate|account|user-change|stop/.test(id);
  await clickFasta(fails?'import':'sync');
  if(fails){
   assert(/100|account changed|page size changed|Stopped/.test(ui('fasta-status').textContent),'Page-size failure did not stop clearly: '+ui('fasta-status').textContent);
   assert(dir.files.get('manifest.json')===original&&!state.uploads.length&&!state.saves.length,'Failed size selection uploaded or rewrote records');
  }else{
   assert(state.pageSize===100&&/No script import records/.test(ui('fasta-status').textContent),'History did not finish using100: '+ui('fasta-status').textContent);
   assert(state.sizeChanges.length===(id==='fasta-page-size-already'?0:1),'100 was not chosen exactly once');
   await clickFasta('import');assert(manifest(dir).importComplete&&state.uploads.length===1&&state.saves.length===1,'Import/reconciliation lost the100-row context');
   assert(state.sizeChanges.length===(id==='fasta-page-size-already'?0:1),'An already100 paginator was clicked again');
  }
  await pause(200);assert(!state.foreignOptionClicks&&!document.getElementById('fasta-size-panel'),'An unrelated option was clicked or our dropdown was left open');
 }else if(id==='fasta-empty-history'){
  const dir=await generate(fasta(31));state.history=[];renderHistory();
  assert(!document.querySelector('gdm-af-history table')&&emptyHistory.isConnected,'Empty history retained a table');
  const original=dir.files.get('manifest.json');emptyHistory.textContent='History failed to load';await clickFasta('sync');
  assert(/Cannot identify one history table/.test(ui('fasta-status').textContent)&&dir.files.get('manifest.json')===original,'An unknown loading/error message was treated as an empty list');
  emptyHistory.textContent='No jobs found with filters specified';await clickFasta('sync');
  assert(/No script import records/.test(ui('fasta-status').textContent)&&!state.uploads.length&&!state.saves.length,'Empty history check failed or uploaded jobs');
  await clickFasta('import');assert(manifest(dir).batches[0].status==='imported'&&state.uploads.length===1&&state.saves.length===1,'First batch could not be imported from the empty draft list');
  await clickFasta('import');assert(manifest(dir).importComplete&&manifest(dir).summary.imported===31&&state.uploads.length===2&&state.saves.length===2,'Next batch failed after empty history became populated');
 }else if(id==='fasta-history-placeholders-stop'){
  const dir=await generate(fasta(1)),original=dir.files.get('manifest.json');state.pageDelay=600;
  ui('fasta-sync').click();await until(()=>state.pageMoves.length>0,'Blank loading rows');
  assert(!document.querySelector('#rows .mat-column-name').textContent&&!document.querySelector('mat-spinner'),'Fixture did not expose spinner-free placeholder rows');
  ui('fasta-stop').click();await settled();
  assert(/Stopped/.test(ui('fasta-status').textContent)&&dir.files.get('manifest.json')===original,'Stopping during placeholders changed the manifest or reported success');
  await until(()=>document.querySelector('#rows .mat-column-name').textContent,'Loading rows restored');
  await clickFasta('sync');assert(/No script import records/.test(ui('fasta-status').textContent),'Retry after stopping on placeholders failed');
  assert(!state.uploads.length&&!state.saves.length,'Placeholder retry imported jobs');
 }else if(id==='fasta-history-ambiguous'){
  const dir=await generate(fasta(1)),original=dir.files.get('manifest.json');
  const other=document.createElement('table');other.append(document.querySelector('thead').cloneNode(true));document.body.append(other);
  await clickFasta('sync');
  assert(/Cannot identify one history table/.test(ui('fasta-status').textContent),'Ambiguous tables were silently accepted');
  assert(dir.files.get('manifest.json')===original&&!state.uploads.length&&!state.saves.length,'Ambiguous history changed records or uploaded jobs');
 }else if(id==='fasta-sync-progress'){
  const dir=await generate(fasta(1)),progress=ui('fasta-progress');
  assert(progress?.tagName==='PROGRESS'&&progress.hidden,'Native progress bar is missing or visible while idle');
  assert(progress.getAttribute('aria-label')&&progress.getAttribute('aria-describedby')==='af3-fasta-status','Progress bar lacks an accessible label/status');
  state.pageDelay=500;ui('fasta-sync').click();
  assert(!progress.hidden&&!progress.hasAttribute('value'),'A new check reused stale progress instead of waiting for a total');
  await until(()=>progress.hasAttribute('value')&&progress.value===100,'First scanned page');
  assert(progress.max===112&&/100\/112/.test(ui('fasta-status').textContent),'Scan progress does not reflect the website total');
  ui('fasta-stop').click();await settled();
  assert(progress.hidden&&/Stopped/.test(ui('fasta-status').textContent)&&!manifest(dir).lastHistoryCheck,'Stopped scan showed completion or saved a check');
  state.rangeOverride='Unknown total';renderHistory();ui('fasta-sync').click();
  await until(()=>/Checking website history.*page/.test(ui('fasta-status').textContent),'Unknown-total scan');
  assert(!progress.hidden&&!progress.hasAttribute('value'),'Unknown total displayed a fake percentage');await settled();
  assert(progress.hidden&&!state.uploads.length&&!state.saves.length,'Completed scan left progress running or uploaded data');
  state.rangeOverride=null;renderHistory();ui('fasta-sync').click();
  await until(()=>progress.hasAttribute('value')&&progress.value===100,'Retry scan progress');await settled();
  assert(progress.hidden&&/No script import records/.test(ui('fasta-status').textContent),'Retry progress did not finish normally');
  addHistory(Array.from({length:112},(_,i)=>({name:'extra_'+i})));ui('fasta-sync').click();
  await until(()=>progress.hasAttribute('value')&&progress.value===100,'Stable total before a change');assert(progress.max===224,'Wrong initial total');
  state.rangeOverride='101 – 200 of 225';
  await until(()=>/page 2/.test(ui('fasta-status').textContent),'Changed-total page');
  assert(!progress.hasAttribute('value')&&!ui('fasta-status').textContent.includes('%'),'Changing totals retained a misleading percentage');await settled();
  state.rangeOverride='1 – 100 of 1,234';renderHistory();ui('fasta-sync').click();
  await until(()=>progress.hasAttribute('value'),'Thousands-separated total');assert(progress.max===1234,'Grouped native total was not parsed');ui('fasta-stop').click();await settled();
  state.rangeOverride='1 – 100 of 9007199254740992';renderHistory();ui('fasta-sync').click();
  await until(()=>/Checking website history.*page/.test(ui('fasta-status').textContent),'Unsafe total');
  assert(!progress.hasAttribute('value'),'Unsafe integer total displayed a percentage');ui('fasta-stop').click();await settled();
  state.rangeOverride=null;state.writeError='manifest.json';ui('fasta-sync').click();await settled();
  assert(progress.hidden&&/write failed/.test(ui('fasta-status').textContent),'Failed save left an animated or successful progress state');
 }else if(id==='fasta-context-errors'){
  const dir=await generate(fasta(1)),original=dir.files.get('manifest.json'),search=document.querySelector('[placeholder="Search History"]');
  const blocked=async expected=>{await clickFasta('sync');assert(expected.test(ui('fasta-status').textContent),'Wrong preflight reason: '+ui('fasta-status').textContent);assert(ui('fasta-progress').hidden,'A blocked check left a progress bar running')};
  search.value='test';await blocked(/Search History.*not empty/);search.value='';
  window.WIZ_global_data.oPEP7c='';await blocked(/identify.*account/);window.WIZ_global_data.oPEP7c=owner;renderHistory();
  filters([]);await blocked(/Select.*History/);filters(['Saved draft']);
  const example=document.createElement('mat-chip-option'),exampleButton=document.createElement('button');exampleButton.textContent='Examples';exampleButton.setAttribute('aria-selected','true');example.append(exampleButton);document.getElementById('filters').append(example);
  await blocked(/Examples/);example.remove();filters(['Saved draft']);
  const size=document.querySelector('mat-paginator select'),option=new Option('20','20');size.add(option);
  const heading=document.querySelector('th'),url=location.href;state.pageDelay=500;
  for(const [change,restore,reason] of [
   [()=>{window.WIZ_global_data.oPEP7c='other@example.com'},()=>{window.WIZ_global_data.oPEP7c=owner},/account changed/],
   [()=>filters(['Completed']),()=>filters(['Saved draft']),/filters changed/],
   [()=>{size.value='20'},()=>{size.value='100'},/page size changed/],
   [()=>heading.setAttribute('aria-sort','ascending'),()=>heading.removeAttribute('aria-sort'),/sort changed/],
   [()=>history.replaceState(null,'',url+'&changed=1'),()=>history.replaceState(null,'',url),/page address changed/],
  ]){
   ui('fasta-sync').click();await until(()=>ui('fasta-progress').hasAttribute('value'),'Started scan before context change');change();await settled();
   assert(reason.test(ui('fasta-status').textContent),'Context-change reason is unclear: '+ui('fasta-status').textContent);
   assert(ui('fasta-progress').hidden,'Context error left progress running');restore();renderHistory();
  }
  assert(dir.files.get('manifest.json')===original&&!state.uploads.length&&!state.saves.length,'Rejected context changed records or uploaded jobs');
 }else if(id==='fasta-stale-journal'){
  const dir=await generate(fasta(1));const initial=dir.files.get('manifest.json'),initialRevision=manifest(dir).revision;
  assert(Number.isSafeInteger(initialRevision)&&initialRevision>0,'Manifest has no durable revision');
  let release;
  const held=navigator.locks.request('af3-fasta-manifest:'+manifest(dir).runId,()=>new Promise(resolve=>release=resolve));
  await until(()=>release,'Concurrent writer lock');const commits=state.commits.length;
  try{await clickFasta('sync');assert(dir.files.get('manifest.json')===initial&&state.commits.length===commits,'A lock conflict overwrote the journal');assert(ui('fasta-import').disabled,'Lock conflict left stale import enabled')}
  finally{release();await held}
  await restore(dir);assert(manifest(dir).revision>initialRevision,'Restore did not persist a fresh revision');
  const fresh=dir.files.get('manifest.json');state.closeError='manifest.json';await clickFasta('sync');
  assert(dir.files.get('manifest.json')===fresh&&ui('fasta-import').disabled,'Close failure committed or kept import enabled');state.closeError='';await restore(dir);
  const newer=manifest(dir);newer.revision++;
  newer.batches[0].account=owner;newer.batches[0].status='uncertain';
  newer.batches[0].attempts=[{account:owner,phase:'saving_drafts',startedAt:new Date().toISOString(),saveClickedAt:new Date().toISOString(),endedAt:null,result:'pending'}];
  const durable=JSON.stringify(newer);dir.files.set('manifest.json',durable);const before=state.commits.length;
  await clickFasta('sync');
  assert(dir.files.get('manifest.json')===durable&&state.commits.length===before,'An old page deleted a newer save attempt');
  assert(ui('fasta-import').disabled&&!state.uploads.length&&!state.saves.length,'Stale journal allowed another upload');
  assert(state.writerModes.every(mode=>mode==='exclusive'),'Writer did not request exclusive filesystem access');
  await restore(dir);const recovered=manifest(dir);
  assert(recovered.batches[0].status==='uncertain'&&recovered.batches[0].attempts[0].result==='interrupted'&&ui('fasta-import').disabled,'Restoring the latest attempt allowed duplicate import');
 }else if(id==='fasta-restore-truncated'){
  const dir=await generate(fasta(31)),original=new Map(dir.files);
  const edits=[
   m=>{m.batches.pop();m.batches[0].status='imported';m.batches[0].account=owner;for(const job of m.batches[0].jobs)job.importStatus='confirmed';m.importComplete=true},
   m=>{m.source.records=30},m=>{m.source.records='31'},m=>{m.batches[0].jobs[0].record=99},
  ];
  for(const edit of edits){
   const bad=new MemoryDirectory('truncated');bad.files=new Map(original);const m=JSON.parse(bad.files.get('manifest.json'));edit(m);const text=JSON.stringify(m);bad.files.set('manifest.json',text);
   const commits=state.commits.length;await restore(bad);
   assert(state.commits.length===commits&&bad.files.get('manifest.json')===text&&ui('fasta-import').disabled,'Incomplete or reordered source records were accepted');
  }
  assert(!state.uploads.length&&!state.saves.length,'A truncated manifest uploaded data');
 }else if(id==='fasta-old-completed-name'){
  const dir=await generate(fasta(1)),job=manifest(dir).batches[0].jobs[0];
  addHistory([{name:job.name}], 'Completed', owner);state.behavior='validation-timeout';ui('fasta-import').click();
  await until(()=>state.uploads[0]?.changes===1,'Native validation started');ui('fasta-stop').click();await settled();
  filters(['Completed']);await clickFasta('sync');const m=manifest(dir);
  assert(!m.importComplete&&!m.predictionComplete&&m.summary.imported===0,'Older Completed job with reused title falsely completed import');
  assert(state.saves.length===0&&state.predictions===0,'Reused-title recovery uploaded or launched prediction');
  state.history.find(row=>row.name===job.name).status='Saved draft';filters(['Saved draft']);await clickFasta('sync');
  assert(!manifest(dir).importComplete&&manifest(dir).summary.imported===0,'Same-name draft without this run sending a save falsely confirmed import');
  assert(/lack evidence/.test(ui('fasta-status').textContent)&&manifest(dir).lastHistoryCheck.unverified===1,'Unverified same-name record was silently ignored');
  await restore(dir);state.history=state.history.filter(row=>row.name!==job.name);state.omitIds=true;filters(['Saved draft']);state.behavior='success';
  await clickFasta('import');assert(manifest(dir).importComplete&&!manifest(dir).batches[0].jobs[0].jobId,'No-ID draft fixture did not import');
  state.history.find(row=>row.name===job.name).status='Completed';filters(['Completed']);state.omitIds=false;renderHistory();
  await clickFasta('sync');
  assert(!manifest(dir).predictionComplete&&manifest(dir).summary.completed===0,'Prediction without a bound draft ID was guessed from a reused title');
  assert(/job IDs/.test(ui('fasta-status').textContent),'Missing task-identity diagnostic for reused title');
 }else if(id==='fasta-submit-evidence-completed'){
  const dir=await generate(fasta(2)),m=manifest(dir),batch=m.batches[0],saveAt=new Date(Date.now()-60000).toISOString();
  batch.account=owner;batch.status='uncertain';
  batch.attempts=[{account:owner,phase:'saving_drafts',startedAt:saveAt,saveClickedAt:saveAt,endedAt:new Date(Date.now()-50000).toISOString(),result:'not_saved'}];
  for(const job of batch.jobs){job.submittedAt=new Date(Date.now()-30000).toISOString();job.predictionStatus='submitted'}
  dir.files.set('manifest.json',JSON.stringify(m));
  addHistory(batch.jobs.map(job=>({name:job.name})),'Completed',owner);
  await restore(dir);filters(['Completed']);await clickFasta('sync');
  let after=manifest(dir);
  assert(after.summary.imported===0&&after.batches[0].status!=='imported'&&after.lastHistoryCheck.unverified===2,'A proven-unsent attempt used submission history to confirm import');
  const fresh=JSON.parse(dir.files.get('manifest.json'));fresh.batches[0].attempts[0].result='pending';fresh.batches[0].attempts[0].endedAt=null;fresh.batches[0].status='uncertain';
  dir.files.set('manifest.json',JSON.stringify(fresh));await restore(dir);filters(['Completed']);await clickFasta('sync');
  after=manifest(dir);
  assert(/核对完成|verified 2\/2/.test(ui('fasta-status').textContent),'Confirmed submission history check has no result: '+ui('fasta-status').textContent);
  assert(after.batches[0].status==='imported'&&after.summary.imported===2,'Sent save plus confirmed submission did not confirm the import');
  assert(after.summary.completed===2&&after.predictionComplete&&after.batches[0].attempts[0].result==='confirmed','Completed history did not update prediction totals');
  assert(after.batches[0].jobs.every(job=>job.importStatus==='confirmed'&&job.predictionStatus==='completed'&&job.completedAt),'Per-job completion was not recorded');
  const before=dir.files.get('manifest.json');await clickFasta('sync');
  assert(dir.files.get('manifest.json')!==before&&manifest(dir).summary.imported===2,'Repeated check changed the confirmed totals');
  assert(!state.uploads.length&&!state.saves.length&&state.predictions===0,'History confirmation uploaded or launched predictions');
 }else if(id==='fasta-duplicate-reconcile'){
  const iso=ms=>new Date(Date.now()+ms).toISOString();
  const local=ms=>{const d=new Date(Date.now()+ms),p=n=>String(n).padStart(2,'0');return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`};
  const recent=local(-30000),dir=await generate(fasta(2)),m=manifest(dir),batch=m.batches[0];
  batch.account=owner;batch.status='uncertain';
  batch.attempts=[{account:owner,phase:'saving_drafts',startedAt:iso(-180000),saveClickedAt:iso(-120000),endedAt:null,result:'pending'}];
  for(const job of batch.jobs){job.submittedAt=iso(-60000);job.predictionStatus='submitted'}
  dir.files.set('manifest.json',JSON.stringify(m));
  for(const job of batch.jobs){
   state.history.push({name:job.name,id:'old-'+job.record,status:'Completed',account:owner,modified:'2026-11-02 16:35'});
   state.history.push({name:job.name,id:'new-'+job.record,status:'Completed',account:owner,modified:recent});
  }
  renderHistory();await restore(dir);filters(['Completed']);await clickFasta('sync');
  let after=manifest(dir);
  assert(after.batches[0].status==='imported'&&after.summary.imported===2,'Reused old titles blocked this run import');
  assert(after.summary.completed===2&&after.predictionComplete,'This run completed rows were not applied');
  assert(after.batches[0].jobs.every(job=>job.predictionStatus==='completed'&&job.modified===recent),'A duplicated row outside this run was chosen');
  await clickFasta('sync');assert(manifest(dir).summary.imported===2&&manifest(dir).summary.completed===2,'Repeated sync lost duplicate disambiguation');
  const logText=document.getElementById('af3-dev-panel').shadowRoot.getElementById('af3-log-body')?.textContent||'';
  assert(/History check started: account fixture@example\.com; filters completed\./.test(logText),'Detailed check-start log missing: '+logText.slice(-500));
  assert(/History read: 2 names, 4 rows\./.test(logText),'Detailed scan-total log missing');
  assert(/Batch 1 \(2 jobs\): confirmed 2; duplicate titles resolved 2; unverified 0; status imported\./.test(logText),'Detailed batch log missing: '+logText.slice(-300));
  const dup=await generate(fasta(1)),dm=manifest(dup),db=dm.batches[0];
  db.account=owner;db.status='uncertain';
  db.attempts=[{account:owner,phase:'saving_drafts',startedAt:iso(-180000),saveClickedAt:iso(-120000),endedAt:null,result:'pending'}];
  for(const job of db.jobs){job.submittedAt=iso(-60000);job.predictionStatus='submitted'}
  dup.files.set('manifest.json',JSON.stringify(dm));
  for(const job of db.jobs){
   state.history.push({name:job.name,id:'dup-a',status:'Completed',account:owner,modified:local(-50000)});
   state.history.push({name:job.name,id:'dup-b',status:'Completed',account:owner,modified:local(-40000)});
  }
  renderHistory();await restore(dup);filters(['Completed']);await clickFasta('sync');
  assert(manifest(dup).summary.imported===0&&/already exists|已存在本批/.test(ui('fasta-status').textContent),'Two plausible duplicate records were silently accepted');
  assert(!state.uploads.length&&state.saves.length===0&&state.predictions===0,'Duplicate reconciliation uploaded or launched predictions');
 }else if(id==='fasta-not-saved-restore'){
  const dir=await generate(fasta(1));state.stopAtSaveJournal=true;
  await clickFasta('import');
  assert(state.stoppedAtJournal&&state.uploads.length===1&&state.saves.length===0,'Stop did not hit the durable pre-save boundary');
  let m=noCompletion(dir),attempt=m.batches[0].attempts.at(-1);
  assert(attempt.result==='not_saved'&&attempt.endedAt&&m.batches[0].status==='ready','A proven-unsent attempt was not durably ended');
  await restore(dir);assert(manifest(dir).batches[0].status==='ready'&&!ui('fasta-import').disabled,'Reload permanently blocked a proven-unsent batch');
  m=manifest(dir);attempt=m.batches[0].attempts.at(-1);attempt.saveClickedAt=attempt.savePreparedAt||attempt.startedAt;
  dir.files.set('manifest.json',JSON.stringify(m));await restore(dir);
  assert(manifest(dir).batches[0].status==='ready'&&!ui('fasta-import').disabled,'An ended not_saved legacy marker became uncertain');
  m=manifest(dir);attempt=m.batches[0].attempts.at(-1);attempt.endedAt=null;attempt.result='pending';
  dir.files.set('manifest.json',JSON.stringify(m));await restore(dir);
  assert(manifest(dir).batches[0].status==='uncertain'&&ui('fasta-import').disabled,'An interrupted possibly-sent attempt became retryable');
 }else if(id==='fasta-manifest-limit'){
  choose('>'+'汉'.repeat(1500)+'\n'+sequence+'\n');await clickFasta('generate');
  assert(parentDir.directories.size===0&&state.commits.length===0,'Oversized UTF-8 manifest was rejected only after output writes');
  assert(/50 MiB|10000|10,000|smaller|limit/i.test(ui('fasta-status').textContent),'Manifest limit diagnostic is missing');
  const dir=await generate(fasta(1)),bad=new MemoryDirectory('oversized');bad.files=new Map(dir.files);
  const large=bad.files.get('manifest.json')+' '.repeat(4096);bad.files.set('manifest.json',large);const commits=state.commits.length;
  await restore(bad);assert(state.commits.length===commits&&bad.files.get('manifest.json')===large&&ui('fasta-import').disabled,'Oversized restore bypassed the shared manifest cap');
 }else if(id==='fasta-batch-limit'){
  choose(fasta(31));await clickFasta('generate');
  assert(parentDir.directories.size===0&&!state.commits.length,'Batch ceiling was checked after output writes');
  const dir=await generate(fasta(30)),m=manifest(dir),bad=new MemoryDirectory('too-many-batches');bad.files=new Map(dir.files);
  m.source.records=31;const batch=JSON.parse(JSON.stringify(m.batches[0]));batch.index=2;batch.jsonFile=batch.jsonFile.replace('_part001','_part002');batch.fastaFile=batch.fastaFile.replace('_part001','_part002');
  const job=JSON.parse(JSON.stringify(batch.jobs[0]));job.record=31;job.header='synthetic_31';job.name='af3_'+m.runId+'_00031_synthetic_31';batch.jobs=[job];
  const json=JSON.stringify([{name:job.name,modelSeeds:[],sequences:[{proteinChain:{sequence,count:1}}],dialect:'alphafoldserver',version:1}],null,2)+'\n';
  const savedFasta='>synthetic_31\n'+sequence+'\n';batch.jsonSha256=await hash(json);batch.fastaSha256=await hash(savedFasta);bad.files.set(batch.jsonFile,json);bad.files.set(batch.fastaFile,savedFasta);m.batches.push(batch);
  bad.files.set('manifest.json',JSON.stringify(m));const commits=state.commits.length;await restore(bad);
  assert(state.commits.length===commits&&ui('fasta-import').disabled,'Restore accepted more batches than generation supports');
 }else if(id==='fasta-presubmit-record'){
  const dir=await generate(fasta(1));await clickFasta('import');const tracked=manifest(dir).batches[0].jobs[0];
  state.writeError='manifest.json';await clickFasta('sync');assert(ui('fasta-import').disabled,'Failed local record write was not represented');
  state.history=state.history.filter(job=>job.name===tracked.name);filters(['Saved draft']);await until(()=>!ui('v20-btn').disabled,'Tracked draft ready');
  ui('v20-count').value='1';ui('v20-btn').click();await until(()=>ui('stop-btn').disabled,'Tracked draft submission stopped');
  assert(state.rowOpens===1&&state.predictions===0,'Known-unsaved manifest was checked only after prediction Confirm');
  assert(!manifest(dir).batches[0].jobs[0].submittedAt&&ui('v20-btn').disabled,'Blocked prediction was recorded as submitted or remained actionable');
 }else if(id==='fasta-import-happy'){
  const dir=await generate();await checkFiles(dir,fasta(31),31);assert(state.uploads.length===0,'Generation started upload');
  state.confirmValue=false;await clickFasta('import');assert(!state.uploads.length&&!state.saves.length&&!manifest(dir).batches[0].attempts.length,'Confirmation cancellation still uploaded/saved');state.confirmValue=true;
  for(let i=0;i<2;i++){
   await clickFasta('import');const m=manifest(dir),batch=m.batches[i];assert(batch.status==='imported'&&batch.attempts.length===1&&batch.attempts[0].result==='confirmed','Happy native save not confirmed');
   assert(state.uploads.length===i+1&&state.saves.length===i+1,'Batch was uploaded/saved more than once');assert(await state.uploads[i].file.text()===dir.files.get(batch.jsonFile),'Uploaded bytes differ from saved JSON');
  }
  let m=manifest(dir);assert(m.importComplete&&m.summary.imported===31&&!m.predictionComplete&&!m.predictionFinished&&m.summary.submitted===0&&m.summary.completed===0,'Import completion conflated with prediction');
  assert(m.batches.every(batch=>batch.jobs.every(job=>job.jobId&&job.importedAt&&job.predictionStatus==='draft'&&!job.submittedAt&&!job.completedAt)),'Confirmed imports missing durable IDs/timestamps');
  assert(state.pageSize===100&&state.pageMoves.includes(1)&&state.page===0,'Hundred-row history pagination not exhausted/reset');
  const jobs=m.batches.flatMap(batch=>batch.jobs);for(const [i,job] of jobs.entries())state.history.find(row=>row.name===job.name).status=i===0?'Completed':i===1?'Failed':'In progress';
  filters(['Completed','Failed','In progress']);await clickFasta('sync');m=manifest(dir);assert(m.summary.completed===1&&m.summary.failed===1&&m.summary.submitted===31&&!m.predictionComplete&&!m.predictionFinished,'Status sync did not distinguish completed/failed/running');
  for(const row of state.history)if(jobs.some(job=>job.name===row.name))row.status='Completed';filters(['Completed']);await clickFasta('sync');m=manifest(dir);assert(m.predictionComplete&&m.predictionFinished&&m.summary.completed===31,'Completion sync failed');
  filters(['Saved draft']);await clickFasta('sync');assert(manifest(dir).summary.completed===31,'Absence under filter erased completion');
  assert(state.uploads.length===2&&state.saves.length===2&&state.confirms.length===3,'History sync uploaded/saved/confirmed again');
 }else if(id==='fasta-journal-error'){
  for(const phase of ['validation','saving_drafts']){
   state.failPhase='';const dir=await generate(fasta(1));state.failPhase=phase;const uploads=state.uploads.length;await clickFasta('import');noCompletion(dir);
   assert(state.uploads.length===uploads+1&&!state.saves.length&&ui('fasta-import').disabled,'Journal failure still sent a draft-save request');
   assert(state.uploads.at(-1).changes===(phase==='validation'?0:1),'Validation started before its journal was saved');
   assert(/write failed/.test(ui('fasta-status').textContent),'Journal write error not surfaced');
  }
 }else if(id==='fasta-import-tampered'){
  const dir=await generate(fasta(1)),batch=manifest(dir).batches[0],original=dir.files.get(batch.jsonFile);dir.files.set(batch.jsonFile,original+' ');
  await clickFasta('import');assert(!state.uploads.length&&/invalid\/changed/.test(ui('fasta-status').textContent),'Changed JSON uploaded');noCompletion(dir);
  dir.files.delete(batch.jsonFile);await clickFasta('import');assert(!state.uploads.length&&/Missing/.test(ui('fasta-status').textContent),'Missing JSON uploaded');
 }else if(['fasta-partial','fasta-unclosed','fasta-warning','fasta-validation-timeout','fasta-stop-validation','fasta-stop-save','fasta-account-validation','fasta-account-save','fasta-account-confirm'].includes(id)){
  const dir=await generate(fasta(30));const behavior=id.replace('fasta-','');state.behavior=['partial','unclosed','warning','validation-timeout'].includes(behavior)?behavior:'success';
  if(behavior==='account-confirm')state.changeOnConfirm=true;
  ui('fasta-import').click();
  if(behavior.endsWith('-validation')){await until(()=>state.uploads[0]?.changes===1,'Native validation started');if(behavior.startsWith('stop'))ui('fasta-stop').click();else{window.WIZ_global_data.oPEP7c='other@example.com';renderHistory()}}
  if(behavior.endsWith('-save')){await until(()=>state.saves.length===1,'Draft save sent');if(behavior.startsWith('stop'))ui('fasta-stop').click();else{window.WIZ_global_data.oPEP7c='other@example.com';renderHistory()}}
  await settled();let m=noCompletion(dir);const shouldSave=['partial','unclosed','stop-save','account-save'].includes(behavior);
  assert(state.saves.length===(shouldSave?1:0),'Warning/stop/account-change bypassed validation or save count wrong');
  if(shouldSave){assert(['partial','uncertain'].includes(m.batches[0].status)&&ui('fasta-import').disabled,'Uncertain batch is retryable');await until(()=>state.nativeSaved>0,'Delayed native save');}
  if(behavior==='partial')assert(m.summary.imported===7&&m.batches[0].status==='partial','Partial draft history not represented');
  await assertNoRetry(behavior==='account-confirm'?0:1,shouldSave?1:0);
  if(shouldSave){
   for(const upload of state.uploads)cancelDialog(upload.dialog);window.WIZ_global_data.oPEP7c=owner;renderHistory();
   addHistory(m.batches[0].jobs);await clickFasta('sync');m=manifest(dir);assert(m.importComplete&&m.summary.imported===30&&!m.predictionComplete,'History-only recovery failed');assert(state.saves.length===1&&state.uploads.length===1,'Recovery reuploaded uncertain batch');
  }
 }else if(id==='fasta-mutual-exclusion'){
  state.pickerMode='deferred';choose(fasta(1));ui('fasta-generate').click();await until(()=>state.releasePicker,'Pending directory permission');
  assert(ui('v20-btn').disabled&&ui('download-scan').disabled&&ui('fasta-restore').disabled,'Generation did not disable other workflows');
  const pickers=state.pickers;for(const action of ['restore','import','sync','generate'])syntheticClick(ui('fasta-'+action));syntheticClick(ui('v20-btn'));syntheticClick(ui('download-scan'));
  assert(state.pickers===pickers&&!state.uploads.length&&!state.rowOpens,'Busy generation allowed another workflow');state.releasePicker();await settled();state.activeDir=Array.from(parentDir.directories.values()).at(-1);state.pickerMode='normal';
  ui('fasta-import').click();await until(()=>state.uploads[0]?.changes===1,'Busy native validation');
  assert(ui('v20-btn').disabled&&ui('download-scan').disabled&&ui('fasta-generate').disabled,'Import did not exclude other workflows');
  syntheticClick(ui('v20-btn'));syntheticClick(ui('download-scan'));syntheticClick(ui('fasta-generate'));await settled();assert(state.pickers===pickers&&!state.rowOpens,'Busy import allowed another workflow');
  filters(['Completed']);for(const row of state.history)row.status='Completed';renderHistory();state.pageDelay=600;
  ui('download-start').value='2026-11-16';ui('download-end').value='2026-11-16';ui('download-scan').click();await until(()=>!ui('download-stop').hidden,'Busy history scan');
  assert(ui('fasta-generate').disabled&&ui('fasta-sync').disabled,'Download scan did not exclude FASTA');syntheticClick(ui('fasta-generate'));syntheticClick(ui('fasta-sync'));ui('download-stop').click();await until(()=>ui('download-stop').hidden,'Stopped history scan');assert(state.pickers===pickers,'FASTA ran during download scan');
  filters(['Saved draft']);for(const row of state.history)row.status='Saved draft';renderHistory();await until(()=>!ui('v20-btn').disabled,'Draft submit control ready');ui('v20-count').value='1';ui('v20-btn').click();await until(()=>!ui('stop-btn').disabled,'Submission busy');
  assert(ui('fasta-generate').disabled&&ui('fasta-sync').disabled,'Submission did not exclude FASTA');syntheticClick(ui('fasta-generate'));syntheticClick(ui('fasta-sync'));ui('stop-btn').click();await until(()=>ui('stop-btn').disabled,'Stopped submission');assert(state.pickers===pickers&&state.saves.length===1,'FASTA ran during submission');
 }else throw Error('Unknown case '+id);
 assertSafe();parent.postMessage({type:'af3-case-result',result:{passed:true,message:'committed files='+state.commits.length+', native uploads='+state.uploads.length+', draft saves='+state.saves.length+', predictions=0'}},location.origin);
})().catch(error=>parent.postMessage({type:'af3-case-result',result:{passed:false,message:error.message+'; status='+ui('fasta-status')?.textContent}},location.origin));
</script>'''


SCENARIOS = [
    'fasta-menu-identity', 'fasta-menu-stop', 'fasta-menu-account', 'fasta-menu-row-change', 'fasta-menu-foreign', 'fasta-menu-conflict', 'fasta-import-streaming',
    'fasta-boundaries', 'fasta-lines-names', 'fasta-legacy-restore', 'fasta-multichain-import', 'fasta-invalid', 'fasta-local-errors', 'fasta-results-directory',
    'fasta-restore', 'fasta-import-happy', 'fasta-import-tampered', 'fasta-journal-error',
    'fasta-partial', 'fasta-unclosed', 'fasta-warning', 'fasta-validation-timeout',
    'fasta-stop-validation', 'fasta-stop-save', 'fasta-account-validation',
    'fasta-account-save', 'fasta-account-confirm', 'fasta-mutual-exclusion',
    'fasta-stale-journal', 'fasta-restore-truncated', 'fasta-old-completed-name', 'fasta-submit-evidence-completed', 'fasta-duplicate-reconcile', 'fasta-not-saved-restore',
    'fasta-manifest-limit', 'fasta-batch-limit', 'fasta-presubmit-record', 'fasta-sync-feedback',
    'fasta-page-size-native', 'fasta-page-size-already', 'fasta-page-size-native-missing', 'fasta-page-size-native-failed',
    'fasta-page-size-material', 'fasta-page-size-material-owns', 'fasta-page-size-material-missing', 'fasta-page-size-material-duplicate',
    'fasta-page-size-material-account', 'fasta-page-size-material-user-change', 'fasta-page-size-material-stop',
    'fasta-page-size-material-stop-late',
    'fasta-sync-progress', 'fasta-context-errors', 'fasta-empty-history', 'fasta-history-placeholders', 'fasta-history-placeholders-stop', 'fasta-history-ambiguous',
]
SHORT_CASES = {'fasta-partial', 'fasta-unclosed', 'fasta-validation-timeout'}


def main():
    harness = runpy.run_path(str(Path(__file__).with_name('test_submission.py')))
    runner = harness['main']
    runner.__globals__.update(CASE=CASE, SCENARIOS=SCENARIOS)
    selected = [name.strip() for name in os.environ.get('AF_FASTA_TEST_CASES', ','.join(SCENARIOS)).split(',') if name.strip()]
    if not selected or set(selected) - set(SCENARIOS):
        raise SystemExit('Unknown or empty AF_FASTA_TEST_CASES selection.')
    source = Path(__file__).with_name('af3-auto-submitter.user.js').resolve()
    read_bytes = Path.read_bytes

    def variant(name):
        if name in SHORT_CASES:
            return 'short'
        if name == 'fasta-manifest-limit':
            return 'manifest-limit'
        if name == 'fasta-batch-limit':
            return 'batch-limit'
        return 'normal'

    failures = []
    for mode in ['normal', 'short', 'manifest-limit', 'batch-limit']:
        group = [name for name in selected if variant(name) == mode]
        if not group:
            continue

        def served_bytes(path):
            data = read_bytes(path)
            if path.resolve() == source and mode != 'normal':
                old, new = {
                    'short': (b'const FASTA_IMPORT_TIMEOUT = 60000;', b'const FASTA_IMPORT_TIMEOUT = 1200;'),
                    'manifest-limit': (b'const FASTA_MANIFEST_LIMIT = 50 * 1024 * 1024;', b'const FASTA_MANIFEST_LIMIT = 4096;'),
                    'batch-limit': (b'const FASTA_MAX_BATCHES = 10000;', b'const FASTA_MAX_BATCHES = 1;'),
                }[mode]
                assert data.count(old) == 1, 'FASTA boundary anchor changed'
                data = data.replace(old, new, 1)
            return data

        os.environ['AF_TEST_CASES'] = ','.join(group)
        os.environ.pop('AF_TEST_UPSTREAM', None)
        try:
            with patch.object(Path, 'read_bytes', served_bytes):
                runner()
        except SystemExit as error:
            failures.append(str(error))
    if failures:
        raise SystemExit('\n'.join(failures))


if __name__ == '__main__':
    main()
