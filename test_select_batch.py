"""Current-batch review selection: no live accounts, downloads or user files.

Reuses the synthetic history/manifest fixture. AF_BATCH_TEST_CASES selects cases.
"""
import os
from pathlib import Path
import runpy

history = runpy.run_path(str(Path(__file__).with_name('test_download.py')))['CASE']
fixture = history.split('const reviewChecks=', 1)[0]
fixture = fixture.replace('const menuIdentity=', "const menuIdentity=id.startsWith('results-')||", 1)
fixture = fixture.replace('if(job.filler||', "if(id.startsWith('results-')||job.filler||", 1)
fixture = fixture.replace('let fillerIndex=0;', "jobs[1].name='protein_A';jobs[2].name='protein_B';jobs[3].name='CON:part';let fillerIndex=0;", 1)
fixture += r'''
window.WIZ_global_data={oPEP7c:'fixture@example.com'};
localStorage.setItem('af3-dev-panel-language','en');
const fs={pickers:0,confirms:[],fetches:[],writerModes:[]};
const missing=()=>new DOMException('Not found','NotFoundError');
class MemoryDirectory {
 constructor(name){this.name=name;this.kind='directory';this.files=new Map()}
 async getDirectoryHandle(){throw missing()}
 async getFileHandle(name){
  if(!this.files.has(name))throw missing();const dir=this;
  return {name,kind:'file',async getFile(){return new File([dir.files.get(name)],name)},async createWritable(options){
   assert(name==='manifest.json','Selection wrote a non-manifest file');fs.writerModes.push(options.mode);let staged;
   return {async write(value){staged=value},async close(){dir.files.set(name,staged)},async abort(){}};
  }};
 }
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

window.showDirectoryPicker=async options=>{fs.pickers++;assert(options.mode==='readwrite','Wrong directory permission');return batchDir};
window.confirm=message=>{fs.confirms.push(message);return true};
const status=()=>ui('download-status').textContent;
async function settle(){await pause(50);await until(()=>!ui('download-scan').disabled);await pause(80)}
'''
fixture = fixture.replace('let fillerIndex=0;', "if(id==='results-batch-multiple')jobs.push(...Array.from({length:25},(_,i)=>({id:'extra-'+i,name:'extra_'+i,modified:'2026-11-13 12:00'})));let fillerIndex=0;", 1)
CASE = fixture.rsplit('(async()=>{', 1)[0] + r'''
const reviewed=()=>Array.from(ui('download-results').querySelectorAll('input[data-job-key]')).filter(input=>input.checked).map(input=>input.dataset.jobKey).sort();
(async()=>{
 const script=document.createElement('script');script.src='/script.js';document.head.append(script);
 await until(()=>ui('download-batch')&&ui('download-extract'));
 assert(!ui('download-save'),'Removed result-save control is still present');
 const button=ui('download-batch');
 assert(button.disabled,'Batch selector enabled without a completed scan');
 const initial=status();button.dispatchEvent(new MouseEvent('click',{bubbles:true}));
 assert(status()===initial&&fs.pickers===0,'Forced selection without a scan opened a picker or masked status');
 assert(ui('download-all').nextElementSibling===button,'Current batch is not next to Select all');
 const allRect=ui('download-all').getBoundingClientRect(),batchRect=button.getBoundingClientRect();
 assert(Math.abs(allRect.top-batchRect.top)<2&&batchRect.left>=allRect.right,'Batch selector is not visually beside Select all');
 const unopened=id==='results-batch-unopened';
 if(!unopened){
  await prepareOpenedBatch();
  const disk=JSON.parse(batchDir.files.get('manifest.json'));
  if(id==='results-batch-account-history'){
   const batch=disk.batches[0],previous=JSON.parse(JSON.stringify(batch));
   batch.account='second@example.com';batch.jobs=batch.jobs.map(job=>({...job,jobId:'second-'+job.jobId}));batch.accountHistory=[previous];
  }
  if(id==='results-batch-idless')disk.batches[0].jobs.forEach(job=>job.jobId=null);
  else{
   disk.batches[0].jobs[2].jobId='an-older-same-name-job';
   disk.batches[0].jobs[3].importStatus='pending';
  }
  if(id==='results-batch-account-history'){
   disk.batches[0].accountHistory[0].jobs[2].jobId='an-older-same-name-job';
   disk.batches[0].accountHistory[0].jobs[3].importStatus='pending';
  }
  if(id==='results-batch-other-account')disk.batches[0].account='other@example.com';
  if(id==='results-batch-wrong-ids')disk.batches[0].jobs.forEach(job=>{job.jobId='old-'+job.jobId;job.importStatus='confirmed'});
  if(id==='results-batch-unconfirmed')disk.batches[0].jobs.forEach(job=>job.importStatus='pending');
  if(id==='results-batch-multiple'){
   const original=disk.batches[0];disk.batches=[];
   for(let start=0;start<original.jobs.length;start+=30){
    const batch={...original,index:disk.batches.length+1,jobs:original.jobs.slice(start,start+30)};
    const stem='synthetic_part'+String(batch.index).padStart(3,'0');batch.jsonFile=stem+'.json';batch.fastaFile=stem+'.fasta';
    const sequence='ACDEFGHIKLMNPQRSTVWY';
    const json=JSON.stringify(batch.jobs.map(job=>({name:job.name,modelSeeds:[],sequences:[{proteinChain:{sequence,count:1}}],dialect:'alphafoldserver',version:1})),null,2)+'\n';
    const fasta=batch.jobs.map(job=>'>'+job.name+'\n'+sequence).join('\n')+'\n';
    const sha256=async text=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text))),b=>b.toString(16).padStart(2,'0')).join('');
    batch.jsonSha256=await sha256(json);batch.fastaSha256=await sha256(fasta);
    batchDir.files.set(batch.jsonFile,json);batchDir.files.set(batch.fastaFile,fasta);disk.batches.push(batch);
   }
  }
  batchDir.files.set('manifest.json',JSON.stringify(disk));
  ui('fasta-restore').click();await until(()=>ui('fasta-stop').hidden);
  assert(ui('fasta-status').textContent.includes('Choose the batch folder'),'Restore failed: '+ui('fasta-status').textContent);
 }
 ui('download-start').value='2026-11-12';ui('download-end').value='2026-11-13';
 ui('download-scan').click();await settle();
 assert(reviewed().length===(id==='results-batch-multiple'?29:4),'Wrong initial date matches: '+status());
 assert(!button.disabled,'Batch selection disabled after a valid scan');
 if(id==='results-batch-language'){
  ui('language-select').value='zh';ui('language-select').dispatchEvent(new Event('change'));
  assert(button.textContent==='选择当前批次','Missing Chinese batch label');
 }
 if(id==='results-batch-language'){ui('language-select').value='en';ui('language-select').dispatchEvent(new Event('change'));}
 const labels=day=>ui('download-results').querySelector('details[data-day="'+day+'"] .af3-day-batches')?.textContent||'';
 if(id==='results-batch-unopened')assert(!labels('2026-11-13'),'Unopened folder guessed batch membership');
 else if(['results-batch-idless','results-batch-other-account','results-batch-wrong-ids','results-batch-unconfirmed'].includes(id))assert(!labels('2026-11-13')&&!labels('2026-11-12'),'Unmatched results should show only their date and total');
 else {
  assert(labels('2026-11-13').includes('Batch 1 ('+(id==='results-batch-multiple'?25:1)+')'),'Missing verified batch/count after date scan: '+labels('2026-11-13'));
  if(id==='results-batch-multiple')assert(labels('2026-11-13').includes('Batch 2 (1)'),'Same-day batches were merged or lost');
  assert(labels('2026-11-12').includes('Batch 1 (1)'),'Batch spanning two dates lost its date label');
 }
 assert(!ui('download-results').textContent.includes('Batch unverified'),'Unmatched placeholder leaked beside verified batch labels');
 const group=ui('download-results').querySelector('details');group.open=true;
 ui('language-select').value='zh';ui('language-select').dispatchEvent(new Event('change'));
 assert(ui('download-results').querySelector('details[data-day="'+group.dataset.day+'"]').open,'Label language redraw collapsed an expanded date');
 assert(!ui('download-results').textContent.includes('批次未核对'),'Unmatched placeholder appeared after switching to Chinese');
 if(!['results-batch-unopened','results-batch-idless','results-batch-other-account','results-batch-wrong-ids','results-batch-unconfirmed'].includes(id))assert(labels('2026-11-12').includes('第 1 批'),'Missing Chinese batch annotation');
 if(id!=='results-batch-language'){ui('language-select').value='en';ui('language-select').dispatchEvent(new Event('change'));}
 if(id==='results-batch-invalid')batchDir.files.set('manifest.json','{broken');
 if(id==='results-batch-stale')document.getElementById('history-search').value='changed search';
 if(id==='results-batch-name'){
  const disk=JSON.parse(batchDir.files.get('manifest.json'));disk.batches[0].jobs[1].name='different_name';
  batchDir.files.set('manifest.json',JSON.stringify(disk));
 }
 if(id==='results-batch-rollback'){
  const disk=JSON.parse(batchDir.files.get('manifest.json'));disk.revision=1;
  disk.batches[0].jobs.forEach(job=>job.jobId=null);batchDir.files.set('manifest.json',JSON.stringify(disk));
 }
 if(id==='results-batch-queue'){
  ui('download-format').value='individual';ui('download-format').dispatchEvent(new Event('change'));
  ui('download-apply').click();await settle();
  assert(!ui('download-next').disabled,'Fixture failed to establish an individual-selection queue');
 }
 if(id==='results-batch-stop'||id==='results-batch-reentry'){
  const original=batchDir.getFileHandle.bind(batchDir);
  let invoked=false;
  batchDir.getFileHandle=async(name,options)=>{
   if(name==='manifest.json'&&!invoked){invoked=true;
    if(id==='results-batch-stop')ui('download-stop').click();else button.dispatchEvent(new MouseEvent('click',{bubbles:true}));
   }
   return original(name,options);
  };
 }
 const beforeSelection=reviewed(),beforeFiles=new Map(batchDir.files),beforeNative=[...state.selected].sort();
 const before={pickers:fs.pickers,confirms:fs.confirms.length,writers:fs.writerModes.length,menus:state.menus.length,
  clears:state.nativeClears,checkboxes:state.nativeCheckboxClicks,changes:state.nativeInputChanges};
 button.click();await settle();
 if(['results-batch-unopened','results-batch-invalid','results-batch-stale','results-batch-stop'].includes(id)){
  assert(reviewed().join()===beforeSelection.join(),'Failed selection discarded the existing choices: '+status());
  if(unopened)assert(status().includes('Open the batch folder'),'Missing-batch guidance was not shown');
 }else{
  const expected=id==='results-batch-rollback'?[]:id==='results-batch-multiple'?jobs.filter((job,i)=>i!==2&&i!==3&&job.modified.startsWith('2026-11-1')&&!['newer','older'].includes(job.id)).map(job=>'id:'+job.id):['results-batch-idless','results-batch-other-account','results-batch-wrong-ids','results-batch-unconfirmed'].includes(id)?[]:id==='results-batch-name'?['id:start-early']:['id:end-late','id:start-early'];
  assert(reviewed().join()===expected.sort().join(),'Wrong current-batch selection: '+reviewed()+'; '+status());
  assert(ui('download-apply').disabled===(expected.length===0),'Native apply availability ignores batch selection');
  if(id==='results-batch-idless')assert(status().includes('6 confirmed jobs have no saved job ID'),'Missing-ID diagnostic did not identify the manifest problem: '+status());
  if(id==='results-batch-other-account')assert(status().includes('no batches for the current account'),'Account mismatch was confused with a date mismatch: '+status());
  if(id==='results-batch-wrong-ids')assert(status().includes('6 saved job IDs')&&!status().includes('no saved job ID'),'Wrong-ID mismatch was confused with missing IDs');
  if(id==='results-batch-unconfirmed')assert(status().includes('no confirmed imports'),'Pending imports were confused with missing IDs');
  if(id==='results-batch-name')assert(!labels('2026-11-13').includes('Batch 1'),'Date labels used stale names instead of the re-read disk manifest');
  if(id==='results-batch-rollback'){
   assert(status().includes('5 confirmed jobs have no saved job ID'),'Lower-revision manifest was not used for selection: '+status());
   assert(!labels('2026-11-13').includes('Batch 1')&&!labels('2026-11-12').includes('Batch 1'),'Lower-revision reread kept stale verified batch labels');
   assert(!labels('2026-11-13')&&!labels('2026-11-12'),'Rollback without verified bindings should not add a batch label');
  }
  if(id==='results-batch-subset'){
   assert(status().includes('2 selected'),'Wrong initial selection count');
   const checkbox=ui('download-results').querySelector('input[data-job-key="id:end-late"]');
   checkbox.closest('details').open=true;checkbox.click();
   assert(status().includes('1 selected'),'Selection count did not update after manual deselection');
   checkbox.click();
  }
  if(id==='results-batch-queue')assert(ui('download-next').disabled&&ui('download-queue').hidden,'Batch change did not invalidate the individual queue');
 }
 assert(fs.pickers===before.pickers&&fs.confirms.length===before.confirms,'Selection opened a picker or a download confirmation');
 assert(fs.writerModes.length===before.writers&&batchDir.files.size===beforeFiles.size,'Selection wrote local files');
 assert([...beforeFiles].every(([name,contents])=>batchDir.files.get(name)===contents),'Selection rewrote manifest or source files');
 assert(state.selected.size===beforeNative.length&&[...state.selected].sort().join()===beforeNative.join(),'Selection changed website checkboxes');
 assert(state.menus.length===before.menus&&state.nativeClears===before.clears&&state.nativeCheckboxClicks===before.checkboxes&&state.nativeInputChanges===before.changes,'Selection invoked a website action');
 assert(fs.fetches.length===0&&state.transportCalls.length===0&&state.downloads.length===0&&state.bulkDownloads.length===0,'Selection transferred a result');
 if(id==='results-batch-refresh'){
  const disk=JSON.parse(batchDir.files.get('manifest.json'));disk.batches[0].jobs[1].jobId='restored-another-id';
  batchDir.files.set('manifest.json',JSON.stringify(disk));ui('fasta-restore').click();await until(()=>ui('fasta-stop').hidden);
  assert(!labels('2026-11-13').includes('Batch 1'),'Reopening a folder kept stale verified batch labels');
  assert(labels('2026-11-12').includes('Batch 1 (1)'),'Reopening a folder removed unchanged verified labels');
  assert(reviewed().join()===['id:end-late','id:start-early'].sort().join(),'Refreshing labels changed the reviewed selection');
 }
 assert(state.submits===0&&state.clones===0&&state.deletes===0&&state.errors.length===0,'Unexpected side effect: '+state.errors);
 parent.postMessage({type:'af3-case-result',result:{passed:true,message:'review selection='+reviewed().length+'; no transfers, writes or native changes'}},location.origin);
})().catch(error=>parent.postMessage({type:'af3-case-result',result:{passed:false,message:error.message}},location.origin));
</script>'''
SCENARIOS = [
    'results-batch-account-history',
    'results-batch-rollback', 'results-batch-refresh', 'results-batch-wrong-ids', 'results-batch-unconfirmed', 'results-batch-multiple', 'results-batch-subset', 'results-batch-unopened', 'results-batch-idless', 'results-batch-other-account',
    'results-batch-invalid', 'results-batch-stale', 'results-batch-name', 'results-batch-stop',
    'results-batch-reentry', 'results-batch-language', 'results-batch-queue',
]


def main():
    harness = runpy.run_path(str(Path(__file__).with_name('test_submission.py')))
    runner = harness['main']
    runner.__globals__.update(CASE=CASE, SCENARIOS=SCENARIOS, PAGE=harness['PAGE'])
    os.environ['AF_TEST_CASES'] = os.environ.get('AF_BATCH_TEST_CASES', ','.join(SCENARIOS))
    runner()


if __name__ == '__main__':
    main()
