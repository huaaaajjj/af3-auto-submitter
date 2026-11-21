"""Current-batch review selection: no live accounts, downloads or user files.

Reuses the synthetic history/manifest fixture. AF_BATCH_TEST_CASES selects cases.
"""
import os
from pathlib import Path
import runpy

fixture = runpy.run_path(str(Path(__file__).with_name('test_results.py')))['CASE']
CASE = fixture.rsplit('(async()=>{', 1)[0] + r'''
const reviewed=()=>Array.from(ui('download-results').querySelectorAll('input[data-job-key]')).filter(input=>input.checked).map(input=>input.dataset.jobKey).sort();
(async()=>{
 const script=document.createElement('script');script.src='/script.js';document.head.append(script);
 await until(()=>ui('download-batch')&&ui('download-save'));
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
  if(id==='results-batch-idless')disk.batches[0].jobs.forEach(job=>job.jobId=null);
  else{
   disk.batches[0].jobs[2].jobId='an-older-same-name-job';
   disk.batches[0].jobs[3].importStatus='pending';
  }
  if(id==='results-batch-other-account')disk.batches[0].account='other@example.com';
  batchDir.files.set('manifest.json',JSON.stringify(disk));
  ui('fasta-restore').click();await until(()=>ui('fasta-stop').hidden);
  assert(ui('fasta-status').textContent.includes('Choose the batch folder'),'Restore failed: '+ui('fasta-status').textContent);
 }
 ui('download-start').value='2026-11-12';ui('download-end').value='2026-11-13';
 ui('download-scan').click();await settle();
 assert(reviewed().length===4,'Expected four initial date matches: '+status());
 assert(!button.disabled,'Batch selection disabled after a valid scan');
 if(id==='results-batch-language'){
  ui('language-select').value='zh';ui('language-select').dispatchEvent(new Event('change'));
  assert(button.textContent==='选择当前批次','Missing Chinese batch label');
 }
 if(id==='results-batch-invalid')batchDir.files.set('manifest.json','{broken');
 if(id==='results-batch-stale')document.getElementById('history-search').value='changed search';
 if(id==='results-batch-name'){
  const disk=JSON.parse(batchDir.files.get('manifest.json'));disk.batches[0].jobs[1].name='different_name';
  batchDir.files.set('manifest.json',JSON.stringify(disk));
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
  const expected=['results-batch-idless','results-batch-other-account'].includes(id)?[]:id==='results-batch-name'?['id:start-early']:['id:end-late','id:start-early'];
  assert(reviewed().join()===expected.sort().join(),'Wrong current-batch selection: '+reviewed()+'; '+status());
  assert(ui('download-save').disabled===(expected.length===0),'ZIP save availability ignores batch selection');
  assert(ui('download-apply').disabled===(expected.length===0),'Native apply availability ignores batch selection');
  if(!expected.length)assert(status().includes('No jobs'),'No-match result was not explained');
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
 assert(state.submits===0&&state.clones===0&&state.deletes===0&&state.errors.length===0,'Unexpected side effect: '+state.errors);
 parent.postMessage({type:'af3-case-result',result:{passed:true,message:'review selection='+reviewed().length+'; no transfers, writes or native changes'}},location.origin);
})().catch(error=>parent.postMessage({type:'af3-case-result',result:{passed:false,message:error.message}},location.origin));
</script>'''
SCENARIOS = [
    'results-batch-subset', 'results-batch-unopened', 'results-batch-idless', 'results-batch-other-account',
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
