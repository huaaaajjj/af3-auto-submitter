"""Opt-in ZIP-transfer tests; legacy download tests still forbid every transfer.

Reuses the synthetic history and stdlib headless runner. Only this fixture
provides a writable in-memory folder and a narrowly checked fetch response.
No AlphaFold, login profile, real directory chooser or protein data is used.
AF_RESULTS_TEST_CASES selects comma-separated cases.
"""

import base64
import io
import os
from pathlib import Path
import runpy
import zipfile


archive = io.BytesIO()
with zipfile.ZipFile(archive, 'w', compression=zipfile.ZIP_STORED) as output:
    output.writestr('fixture.txt', 'synthetic result, no protein data')
NONEMPTY_ZIP = base64.b64encode(archive.getvalue()).decode('ascii')


history = runpy.run_path(str(Path(__file__).with_name('test_download.py')))['CASE']
# Reuse the history DOM, pagination and owned-menu timings, not the old test body.
CASE = history.split('const reviewChecks=')[0]
CASE = CASE.replace("const menuIdentity=", "const menuIdentity=id.startsWith('results-')||", 1)
CASE = CASE.replace("if(job.filler||", "if(id.startsWith('results-')||job.filler||", 1)
CASE = CASE.replace("let fillerIndex=0;", "jobs[1].name='protein_A';jobs[2].name='protein_B';jobs[3].name='CON:part';\nlet fillerIndex=0;", 1)
CASE += r'''
window.WIZ_global_data={oPEP7c:'fixture@example.com'};
localStorage.setItem('af3-dev-panel-language','en');
const fs={pickers:0,confirms:[],fetches:[],commits:[],aborts:0,removes:[],writerModes:[],created:[]};
const reuseOpened=id.startsWith('results-reuse-');
const missing=()=>new DOMException('Not found','NotFoundError');
class MemoryDirectory {
 constructor(name){this.name=name;this.kind='directory';this.files=new Map();this.directories=new Map()}
 async getDirectoryHandle(name,options={}){
  if(id==='results-permission'||fs.outputDenied)throw new DOMException('Denied','NotAllowedError');
  if(!this.directories.has(name)){if(!options.create)throw missing();this.directories.set(name,new MemoryDirectory(name));fs.created.push(name)}
  return this.directories.get(name);
 }
 async getFileHandle(name,options={}){
  if(!this.files.has(name)){if(!options.create)throw missing();this.files.set(name,new Uint8Array())}
  const dir=this;
  return {kind:'file',name,async isSameEntry(other){return other.name===name},
   async getFile(){if(!dir.files.has(name))throw missing();return new File([dir.files.get(name)],name)},
   async createWritable(options={}){
    fs.writerModes.push(options.mode);let chunks=[],staged=null;
    if(id==='results-writer-denied'&&name!=='manifest.json')throw new DOMException('Locked','NoModificationAllowedError');
    return {
     async write(value){
      if(name==='manifest.json'){assert(typeof value==='string','Manifest writer received non-text data');staged=value;return}
      assert(value instanceof Uint8Array,'ZIP writer received nonbinary data');
      if(id==='results-write-failure'||id==='results-cleanup-failure')throw Error('Synthetic disk full');
      chunks.push(value.slice());
      if(id==='results-stop-write'||id==='results-stop-cleanup-failure')ui('download-stop').click();
      if(id==='results-manifest-change')batchDir.files.set('manifest.json',initialManifest+' ');
      if(id==='results-row-change'){jobs[1].modified='2026-11-13 22:59';renderRows()}
     },
     async close(){
      if(id==='results-close-failure'&&name!=='manifest.json')throw Error('Synthetic close failure');
      const bytes=name==='manifest.json'?staged:new Uint8Array(await new Blob(chunks).arrayBuffer());dir.files.set(name,bytes);
      if(name!=='manifest.json')fs.commits.push({name,bytes});
      if(id==='results-stop-after-close')ui('download-stop').click();
     },
     async abort(){chunks=[];fs.aborts++}
    };
   }
  };
 }
 async removeEntry(name){fs.removes.push(name);if(id.includes('cleanup-failure'))throw new DOMException('Denied','NotAllowedError');this.files.delete(name)}
}
const batchDir=new MemoryDirectory('af3_20261120000000_0123abcd');
const manifest={format:'af3-fasta-batches',version:1,revision:3,runId:'20261120000000_0123abcd',generationComplete:true,
 source:{name:'synthetic.fasta',records:jobs.length},settings:{batchSize:30,sequenceFormat:'protein-lines'},
 batches:[{index:1,jsonFile:'synthetic_part001.json',fastaFile:'synthetic_part001.fasta',account:'fixture@example.com',attempts:[],
 jobs:jobs.map((job,i)=>({record:i+1,header:job.name,name:job.name,importStatus:'confirmed',predictionStatus:'completed',jobId:job.id,modified:job.modified}))}]};
if(id==='results-invalid-manifest')manifest.version=99;
if(id==='results-incomplete-manifest')manifest.generationComplete=false;
if(id==='results-other-account')manifest.batches[0].account='other@example.com';
if(id==='results-missing-id')manifest.batches[0].jobs[1].jobId=null;
if(id==='results-wrong-id')manifest.batches[0].jobs[1].jobId='different-job';
if(id==='results-wrong-name')manifest.batches[0].jobs[1].name='different_name';
let initialManifest=JSON.stringify(manifest);
batchDir.files.set('manifest.json',initialManifest);batchDir.files.set('synthetic_part001.fasta','FASTA sentinel');batchDir.files.set('synthetic_part001.json','JSON sentinel');
async function prepareOpenedBatch(){
 const sequence='ACDEFGHIKLMNPQRSTVWY';
 const savedJobs=jobs.map(job=>({name:job.name,modelSeeds:[],sequences:[{proteinChain:{sequence,count:1}}],dialect:'alphafoldserver',version:1}));
 const savedJson=JSON.stringify(savedJobs,null,2)+'\n';
 const savedFasta=jobs.map(job=>'>'+job.name+'\n'+sequence).join('\n')+'\n';
 const sha256=async value=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value))),byte=>byte.toString(16).padStart(2,'0')).join('');
 manifest.batches[0].jobs=jobs.map((job,i)=>({record:i+1,header:job.name,name:job.name,chainLengths:[sequence.length],importStatus:'confirmed',predictionStatus:'completed',jobId:job.id,modified:job.modified}));
 manifest.batches[0].jsonSha256=await sha256(savedJson);manifest.batches[0].fastaSha256=await sha256(savedFasta);
 initialManifest=JSON.stringify(manifest);
 batchDir.files.set('manifest.json',initialManifest);batchDir.files.set('synthetic_part001.fasta',savedFasta);batchDir.files.set('synthetic_part001.json',savedJson);
}
if(id==='results-no-manifest')batchDir.files.delete('manifest.json');
if(id==='results-bad-json')batchDir.files.set('manifest.json','{broken');
if(id==='results-existing-directory')batchDir.directories.set('results',new MemoryDirectory('results'));
window.showDirectoryPicker=async options=>{
 fs.pickers++;assert(options.mode==='readwrite','Picker did not request write permission');
 if(id==='results-picker-cancel')throw new DOMException('Cancelled','AbortError');
 if(id==='results-picker-denied')throw new DOMException('Denied','NotAllowedError');
 if(id==='results-picker-stop')ui('download-stop').click();
 if(id==='results-picker-account')window.WIZ_global_data.oPEP7c='other@example.com';
 return batchDir;
};
if(id==='results-unsupported')window.showDirectoryPicker=undefined;
if(id==='results-timeout'){
 const nativeTimeout=window.setTimeout.bind(window);
 window.setTimeout=(fn,ms,...args)=>nativeTimeout(fn,ms===60000?100:ms,...args);
}
window.confirm=message=>{fs.confirms.push(message);return !['results-confirm-cancel','results-reuse-cancel'].includes(id)};
// Valid empty ZIP; split chunks exercise signature and end-record buffering.
const zip=id==='results-nonempty-zip'?Uint8Array.from(atob('__NONEMPTY_ZIP__'),char=>char.charCodeAt(0)):new Uint8Array(22);
if(id!=='results-nonempty-zip')zip.set([80,75,5,6]);
window.fetch=async (url,options)=>{
 assert(options.credentials==='same-origin'&&options.mode==='same-origin'&&options.redirect==='error'&&options.signal,'Unsafe ZIP request options');
 assert(fs.confirms.length===1,'Transfer started without confirmation');
 const path=new URL(url,location.href).pathname,match=/^\/_\/v2\/folds\/([^/]+)\/folds.zip$/.exec(path);
 assert(new URL(url,location.href).origin===location.origin&&match,'Unexpected transfer URL');
 fs.fetches.push(match[1]);
 if(id==='results-reentry')ui('download-save').dispatchEvent(new MouseEvent('click',{bubbles:true}));
 if(id==='results-network-failure'||(id==='results-partial-failure'&&fs.fetches.length===2))throw new TypeError('Synthetic fetch failed https://secret.invalid/?token=never-log');
 if(id==='results-stop-fetch'||id==='results-account-fetch'||id==='results-context-fetch'||id==='results-timeout'){
  if(id==='results-stop-fetch')ui('download-stop').click();
  else if(id==='results-account-fetch')window.WIZ_global_data.oPEP7c='other@example.com';
  else if(id==='results-context-fetch')document.getElementById('history-search').value='changed';
  return new Promise((resolve,reject)=>{
   const abort=()=>reject(new DOMException('Aborted','AbortError'));
   if(options.signal.aborted)abort();else options.signal.addEventListener('abort',abort,{once:true});
  });
 }
 const bytes=id==='results-html-response'?new TextEncoder().encode('<html>Sign in</html>'):id==='results-not-zip'?new Uint8Array(22):id==='results-truncated'?zip.slice(0,12):zip;
 const headers=new Headers({'Content-Type':id==='results-html-response'?'text/html':'application/zip','Content-Length':String(bytes.length+(id==='results-length-mismatch'?1:0))});
 let index=0;
 const body=new ReadableStream({
  pull(controller){
   if(options.signal.aborted){controller.error(new DOMException('Aborted','AbortError'));return}
   if(id==='results-stream-failure'&&index){controller.error(Error('Synthetic read failure'));return}
   if(index>=bytes.length){controller.close();return}
   const end=Math.min(bytes.length,index+(index?7:2));controller.enqueue(bytes.slice(index,end));index=end;
  }
 });
 return {ok:id!=='results-http-error',status:id==='results-http-error'?403:200,headers,body,url:String(url),redirected:id==='results-redirect-response'};
};
// Alter only the menu that this fixture opens; never click its Download action.
const baseMenu=showIdentityMenu;
showIdentityMenu=(button,job)=>{
 baseMenu(button,job);
 const panel=document.getElementById(button.getAttribute('aria-controls'));
 const download=panel.querySelector('a[download]');
 if(id==='results-foreign-link')download.href='https://unrelated.invalid/file.zip';
 if(id==='results-credential-link')download.href=location.protocol+'//user:secret@'+location.host+'/file.zip';
 if(id==='results-script-link')download.href='javascript:void(0)';
 if(id==='results-missing-link')download.remove();
 if(id==='results-duplicate-link')panel.append(download.cloneNode(true));
 if(id==='results-menu-identity-change'){
  setTimeout(()=>{const result=panel.querySelector('a:not([download])');if(result)result.href='/fold/replaced-id'},0);
 }
};
const status=()=>ui('download-status').textContent;
async function settle(){await pause(50);await until(()=>!ui('download-scan').disabled);await pause(80)}
async function scanResults(){
 ui('download-start').value='2026-11-12';ui('download-end').value='2026-11-13';
 ui('download-scan').click();await settle();
 assert(ui('download-results').querySelectorAll('input[data-job-key]').length===4,'Expected 4 scanned jobs: '+status());
 assert(fs.pickers===(reuseOpened?1:0)&&fs.fetches.length===0,'A scan started a ZIP transfer or opened a folder');
}
(async()=>{
 const script=document.createElement('script');script.src='/script.js';document.head.append(script);
 await until(()=>ui('download-scan')&&ui('download-save'));
 assert(ui('download-save').disabled,'Saving was enabled without a scan');
 if(reuseOpened){
  await prepareOpenedBatch();
  ui('fasta-restore').click();
  await until(()=>ui('fasta-stop').hidden);
  assert(ui('fasta-status').textContent.includes('Choose the batch folder'),'Batch restore failed: '+ui('fasta-status').textContent);
  assert(fs.pickers===1,'Opening an existing batch did not use the fixture picker exactly once');
  assert(!ui('download-scan').disabled,'Opening batch left download controls disabled: fasta='+ui('fasta-status').textContent+' download='+ui('download-status').textContent);
  if(id==='results-reuse-no-picker')window.showDirectoryPicker=undefined;
  if(id==='results-reuse-invalid')batchDir.files.set('manifest.json','{broken');
  if(id==='results-reuse-denied')fs.outputDenied=true;
  if(id==='results-reuse-mismatch'){
   const changed=JSON.parse(batchDir.files.get('manifest.json'));changed.batches[0].jobs[1].jobId='different-job';
   batchDir.files.set('manifest.json',JSON.stringify(changed));
  }
 }
 await scanResults();
 if(id==='results-preserve-existing'){
  const output=new MemoryDirectory('results');batchDir.directories.set('results',output);
  const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode('id:end-late'));
  const code=Array.from(new Uint8Array(digest),b=>b.toString(16).padStart(2,'0')).join('').slice(0,16);
  output.files.set('protein_A__'+code+'.zip','existing file sentinel');
 }
 if(id==='results-lock-contention')await new Promise(ready=>navigator.locks.request('af3-results:'+manifest.runId,async lock=>{
  assert(lock,'Fixture could not acquire results lock');ready();await new Promise(release=>fs.releaseLock=release);
 }));
 if(id==='results-missing-account')window.WIZ_global_data.oPEP7c='';
 if(id==='results-menu-identity-change')jobs[1].publicId='replaced-id';
 const beforeSave=new Map(batchDir.files);
 ui('download-save').click();
 assert(ui('account-login').disabled||id==='results-unsupported'||id==='results-missing-account','Account switch enabled during saving');
 await settle();
 fs.releaseLock?.();
 const firstStatus=status(),firstFetches=fs.fetches.length;
 if(reuseOpened)assert(fs.pickers===1,'Saving reopened the folder picker after a successful batch restore');
 if(id==='results-save')assert(fs.pickers===1,'No opened batch: saving must ask for a folder');
 if(reuseOpened&&id!=='results-reuse-invalid'&&id!=='results-reuse-mismatch')assert(fs.confirms.length===1&&fs.confirms[0].includes(batchDir.name+'/results'),'Reusing a folder skipped its destination confirmation');
 const transferFailures=['results-writer-denied','results-network-failure','results-html-response','results-not-zip','results-truncated','results-length-mismatch','results-http-error','results-redirect-response','results-stream-failure','results-write-failure','results-close-failure','results-stop-fetch','results-stop-write','results-stop-after-close','results-account-fetch','results-context-fetch','results-manifest-change','results-row-change','results-cleanup-failure','results-stop-cleanup-failure','results-timeout'];
 if(transferFailures.includes(id))assert(fs.fetches.length===1,'Transfer failure case did not reach its intended boundary: '+status());
 if(id==='results-partial-failure')assert(fs.fetches.length===2,'Partial failure did not reach the second transfer');
 const good=['results-save','results-nonempty-zip','results-existing-directory','results-reentry','results-repeat-skip','results-reuse-open','results-reuse-no-picker'];
 if(good.includes(id)){
  assert(fs.commits.length===4&&fs.fetches.join(',')==='end-late,end-early,start-late,start-early','Wrong saved result set: '+JSON.stringify(fs.fetches)+'; '+status());
  assert(status().includes('Saved 4/4'),'False or missing close-success summary: '+status());
  assert(fs.confirms[0].includes(batchDir.name+'/results'),'Confirmation omitted destination');
  for(const {name,bytes} of fs.commits){
   assert(name.endsWith('.zip')&&name.length<180&&!/[<>:"/\\|?*\x00-\x1f]/.test(name),'Unsafe filename: '+name);
   assert(bytes.length===zip.length&&bytes.every((byte,i)=>byte===zip[i]),'ZIP bytes changed');
  }
  if(id==='results-repeat-skip'){
   const snapshot=[...batchDir.directories.get('results').files.entries()];
   ui('download-save').click();await settle();
   assert(fs.fetches.length===4&&fs.commits.length===4&&status().includes('Skipped 4 existing'),'Existing files were fetched or overwritten: '+status());
   assert(snapshot.every(([name,bytes])=>batchDir.directories.get('results').files.get(name)===bytes),'An existing result was changed');
  }
 }else if(id==='results-preserve-existing'){
  assert(fs.commits.length===3&&fs.fetches.length===3&&!fs.fetches.includes('end-late'),'An existing file was fetched or overwritten');
  assert([...batchDir.directories.get('results').files.values()].includes('existing file sentinel'),'Existing file contents changed');
  assert(status().includes('Saved 3/4')&&status().includes('Skipped 1 existing'),'Existing-file count was wrong: '+status());
 }else{
  const expected=id==='results-partial-failure'||id==='results-stop-after-close'?1:0;
  assert(fs.commits.length===expected,'Incorrect successful-file count: '+fs.commits.length+'; '+status());
  assert(!status().includes('Saved 4/4')&&!status().includes('token=never-log'),'False success or leaked transfer URL: '+status());
  if(expected)assert(status().includes('Saved 1/4'),'Partial success was not reported: '+status());
  if(['results-picker-cancel','results-confirm-cancel','results-reuse-cancel'].includes(id))assert(status().includes('cancelled'),'Cancellation was not explained: '+status());
  if(reuseOpened)assert(fs.fetches.length===0&&!batchDir.directories.has('results'),'Invalid/cancelled reused folder created outputs or transferred data');
  if(['results-no-manifest','results-invalid-manifest','results-incomplete-manifest','results-bad-json','results-other-account','results-missing-id','results-wrong-id','results-wrong-name','results-confirm-cancel','results-picker-cancel','results-picker-denied','results-picker-stop','results-picker-account','results-unsupported','results-missing-account'].includes(id)){
   assert(fs.fetches.length===0&&!batchDir.directories.has('results'),'Invalid/cancelled folder created outputs or transferred data');
  }
  const output=batchDir.directories.get('results');
  const cleanupFailed=id.includes('cleanup-failure');
  assert(!output||output.files.size===expected+(cleanupFailed?1:0),'An incomplete ZIP placeholder was left behind');
  if(cleanupFailed)assert(fs.removes.length===1&&status().includes('Could not remove'),'Cleanup failure was hidden: '+status());
  if(id==='results-lock-contention')assert(fs.fetches.length===0&&!output&&status().includes('Another page'),'Results mutex did not block writes');
 }
 for(const [name,contents] of beforeSave){
  assert(batchDir.files.get(name)===contents+(id==='results-manifest-change'&&name==='manifest.json'?' ':''),'Script changed a source file: '+name);
 }
 assert(batchDir.files.size===beforeSave.size,'Script added a source file');
 assert(fs.writerModes.every(mode=>mode==='exclusive'),'ZIP writer was not exclusive');
 assert(state.downloads.length===0&&state.bulkDownloads.length===0&&state.nativeCheckboxClicks===0&&state.nativeClears===0,'Saving clicked a native Download or changed native selections');
 assert(state.submits===0&&state.clones===0&&state.deletes===0&&state.rowOpens===0,'Saving invoked an unrelated action');
 assert(!document.querySelector('[role="menu"]'),'Saving left an owned menu open');
 assert(state.transportCalls.length===0&&state.errors.length===0,'Unexpected transport/error: '+state.transportCalls+' '+state.errors);
 parent.postMessage({type:'af3-case-result',result:{passed:true,message:'committed='+fs.commits.length+', ZIP requests='+firstFetches+', '+firstStatus}},location.origin);
})().catch(error=>parent.postMessage({type:'af3-case-result',result:{passed:false,message:error.message}},location.origin));
</script>'''
CASE = CASE.replace('__NONEMPTY_ZIP__', NONEMPTY_ZIP)

SCENARIOS = [
    'results-save', 'results-nonempty-zip', 'results-existing-directory', 'results-repeat-skip', 'results-reentry',
    'results-reuse-open', 'results-reuse-no-picker', 'results-reuse-cancel', 'results-reuse-invalid', 'results-reuse-denied', 'results-reuse-mismatch',
    'results-unsupported', 'results-picker-cancel', 'results-picker-denied', 'results-confirm-cancel',
    'results-no-manifest', 'results-bad-json', 'results-invalid-manifest', 'results-incomplete-manifest',
    'results-other-account', 'results-missing-account', 'results-missing-id', 'results-wrong-id', 'results-wrong-name',
    'results-picker-stop', 'results-picker-account', 'results-permission', 'results-writer-denied',
    'results-foreign-link', 'results-credential-link', 'results-script-link', 'results-missing-link', 'results-duplicate-link',
    'results-menu-identity-change', 'results-network-failure', 'results-partial-failure',
    'results-html-response', 'results-not-zip', 'results-truncated', 'results-length-mismatch',
    'results-http-error', 'results-redirect-response', 'results-stream-failure',
    'results-write-failure', 'results-close-failure', 'results-stop-fetch', 'results-stop-write',
    'results-stop-after-close', 'results-account-fetch', 'results-context-fetch', 'results-manifest-change', 'results-row-change',
    'results-preserve-existing', 'results-lock-contention', 'results-timeout', 'results-cleanup-failure', 'results-stop-cleanup-failure',
]


def main():
    harness = runpy.run_path(str(Path(__file__).with_name('test_submission.py')))
    runner = harness['main']
    runner.__globals__.update(CASE=CASE, SCENARIOS=SCENARIOS, PAGE=harness['PAGE'])
    os.environ['AF_TEST_CASES'] = os.environ.get('AF_RESULTS_TEST_CASES', ','.join(SCENARIOS))
    runner()


if __name__ == '__main__':
    main()
