"""Offline userscript extraction regressions; synthetic ZIPs, isolated headless browser.

AF_SCORE_TEST_CASES selects cases. No AlphaFold, login profiles or user data.
"""
import base64
import io
import json
import os
from pathlib import Path
import runpy
import struct
import warnings
import zipfile


def make_zip(variant=1, compression=zipfile.ZIP_DEFLATED, change=None):
    entries = {}
    scores = {'protein_A': [.70, .80], 'protein_B': [.90, .85]} if variant == 1 else {'protein_A': [.95, .40], 'protein_B': [.75, .88]}
    for job, ranks in scores.items():
        slug = job.lower()
        entries[f'{slug}/fold_{slug}_job_request.json'] = [{'name': job, 'modelSeeds': [], 'sequences': [
            {'proteinChain': {'sequence': 'ACDEFGHIKLMNPQRSTVWY', 'count': 1}},
            {'proteinChain': {'sequence': 'GAVLIPFYW', 'count': 1}}], 'dialect': 'alphafoldserver', 'version': 1}]
        for model, rank in enumerate(ranks):
            entries[f'{slug}/fold_{slug}_summary_confidences_{model}.json'] = {
                'iptm': rank - .2, 'ptm': .81, 'ranking_score': rank, 'fraction_disordered': .05, 'has_clash': 0,
                'chain_ids': ['A', 'B'], 'chain_iptm': [.72, rank - .2], 'chain_ptm': [.81, .02],
                'chain_pair_iptm': [[.72, rank - .2], [rank - .2, .02]], 'chain_pair_pae_min': [[.75, 2.5 + model], [3 + model, .76]]}
            entries[f'{slug}/fold_{slug}_full_data_{model}.json'] = {
                'pae': [[1, 2, 3, 4], [2, 1, 5, 6], [3, 5, 1, 2], [4, 6, 2, 1]],
                'atom_plddts': [90, 80, 70, 60], 'token_chain_ids': ['A', 'A', 'B', 'B']}
    if change:
        change(entries)
    output = io.BytesIO()
    with warnings.catch_warnings(), zipfile.ZipFile(output, 'w', compression=compression) as archive:
        warnings.simplefilter('ignore', UserWarning)
        for name, value in entries.items():
            archive.writestr(name, json.dumps(value) if not isinstance(value, str) else value)
            if variant == 3:
                archive.writestr(name, json.dumps(value))
    return output.getvalue()


def mutate(data, kind):
    data = bytearray(data)
    central = data.index(b'PK\x01\x02')
    if kind == 'crc':
        payload = 30 + struct.unpack_from('<H', data, 26)[0] + struct.unpack_from('<H', data, 28)[0]
        data[payload + 5] ^= 1
    elif kind == 'encrypted':
        struct.pack_into('<H', data, central + 8, struct.unpack_from('<H', data, central + 8)[0] | 1)
    elif kind == 'zip64':
        struct.pack_into('<H', data, len(data) - 22 + 10, 0xffff)
    elif kind == 'local-name':
        data[30] ^= 1
    return bytes(data)


def broken_summary(entries):
    next(value for key, value in entries.items() if 'summary_confidences' in key)['ranking_score'] = None


def broken_full(entries):
    next(value for key, value in entries.items() if '_full_data_' in key)['pae'][0].pop()


def missing_full(entries):
    for key in list(entries):
        if '_full_data_' in key:
            del entries[key]


def flat_entries(entries):
    flattened = {key.rsplit('/', 1)[-1]: value for key, value in entries.items()}
    entries.clear()
    entries.update(flattened)


def null_iptm(entries):
    for key, value in entries.items():
        if 'summary_confidences' in key:
            value['iptm'] = None


FIXTURES = {name: base64.b64encode(data).decode('ascii') for name, data in {
    'one': make_zip(), 'two': make_zip(2), 'stored': make_zip(compression=zipfile.ZIP_STORED),
    'flat': make_zip(change=flat_entries),
    'bzip': make_zip(compression=zipfile.ZIP_BZIP2), 'duplicate': make_zip(3),
    'crc': mutate(make_zip(compression=zipfile.ZIP_STORED), 'crc'),
    'encrypted': mutate(make_zip(), 'encrypted'), 'zip64': mutate(make_zip(), 'zip64'),
    'local-name': mutate(make_zip(), 'local-name'),
    'traversal': make_zip(change=lambda entries: entries.update({'../escape.json': {}})),
    'bad-json': make_zip(change=lambda entries: entries.update({next(key for key in entries if 'summary_confidences' in key): '{broken'})),
    'bad-summary': make_zip(change=broken_summary), 'bad-full': make_zip(change=broken_full),
    'missing-full': make_zip(change=missing_full), 'null-iptm': make_zip(change=null_iptm),
}.items()}

history = runpy.run_path(str(Path(__file__).with_name('test_download.py')))['CASE']
CASE = history.split('const reviewChecks=', 1)[0] + r'''
window.WIZ_global_data={oPEP7c:'fixture@example.com'};
localStorage.setItem('af3-dev-panel-language','en');
const zipFixtures=__FIXTURES__;
const fs={pickers:0,options:[],confirms:[],commits:[],aborts:0,removed:[],writers:[],mtime:100,contentReads:0,scanApproved:false,progress:{scan:0,reads:[],writes:[]}};
const absent=()=>new DOMException('Missing','NotFoundError');
class Directory {
 constructor(name){this.kind='directory';this.name=name;this.files=new Map();this.dirs=new Map()}
 put(name,data){
  const file=new File([data],name,{lastModified:++fs.mtime});
  if(name.endsWith('.zip')){const slice=file.slice.bind(file);file.slice=(...args)=>{assert(fs.scanApproved,'Read archive content before scan confirmation');
   if(id==='score-progress'){
    const progress=ui('score-progress'),label=ui('score-progress-text');
    assert(progress&&!progress.hidden&&label&&!label.hidden,'ZIP extraction progress is not visible');
    assert(progress.tagName==='PROGRESS'&&progress.max===2&&progress.value===(name==='folds_one.zip'?0:1),'ZIP progress counted the current unfinished archive');
    assert(progress.getAttribute('aria-labelledby')===label.id,'Progress bar has no accessible label');
    assert(label.textContent.includes(name==='folds_one.zip'?'0/2 (0%)':'1/2 (50%)'),'ZIP progress text/count is wrong: '+label.textContent);
    fs.progress.reads.push(progress.value);
   }
   fs.contentReads++;return slice(...args)}}
  this.files.set(name,file);
 }
 async *entries(){
  if(id==='score-progress'){
   const progress=ui('score-progress');
   assert(progress&&!progress.hidden&&!progress.hasAttribute('value'),'Unknown directory scan showed missing or fabricated determinate progress');
   fs.progress.scan++;
  }
  for(const name of this.files.keys())yield [name,await this.getFileHandle(name)];for(const entry of this.dirs)yield entry}
 async isSameEntry(other){return other===this}
 async resolve(other){if(other===this)return [];for(const [name,dir] of this.dirs){const path=await dir.resolve(other);if(path)return [name,...path]}return null}
 async getDirectoryHandle(name,options={}){if(!this.dirs.has(name)){if(!options.create)throw absent();this.dirs.set(name,new Directory(name))}return this.dirs.get(name)}
 async getFileHandle(name,options={}){
  if(!this.files.has(name)){if(!options.create)throw absent();this.put(name,'')}
  const dir=this;
  return {name,kind:'file',async isSameEntry(other){return other.name===name},async getFile(){
   if(id==='score-stop-read'&&name.endsWith('.zip'))ui('download-stop').click();
   if(!dir.files.has(name))throw absent();return dir.files.get(name);
  },async createWritable(options={}){
   fs.writers.push(options.mode);const csv=name.endsWith('.csv');let staged='';
   if(csv&&id==='score-write-denied')throw new DOMException('Disk full','QuotaExceededError');
   return {async write(data){
    if(csv&&id==='score-progress'){
     const progress=ui('score-progress'),label=ui('score-progress-text');
     assert(progress&&!progress.hidden&&progress.max===7&&progress.value===fs.commits.length,'CSV progress advanced before successful file close');
     assert(label.textContent.includes(fs.commits.length+'/7'),'CSV progress text is wrong: '+label.textContent);
     fs.progress.writes.push(progress.value);
    }
    if(csv&&id==='score-partial'&&fs.commits.length===1)throw new DOMException('Disk full','QuotaExceededError');
    staged=data;
    if(csv&&id==='score-cleanup-failure')throw Error('Synthetic write failure');
    if(csv&&id==='score-stop-cleanup-failure')ui('download-stop').click();
    if(csv&&id==='score-stop-write')ui('download-stop').click();
    if(csv&&id==='score-manifest-change')batch.put('manifest.json',manifestText+' ');
   },async close(){
    if(csv&&id==='score-close-denied')throw new DOMException('Locked','NoModificationAllowedError');
    dir.put(name,staged);if(csv){fs.commits.push(name);if(id==='score-stop-close')ui('download-stop').click()}
   },async abort(){fs.aborts++}};
  }};
 }
 async removeEntry(name){if(id.includes('cleanup-failure'))throw new DOMException('Denied','NotAllowedError');if(!this.files.has(name))throw absent();this.files.delete(name);fs.removed.push(name)}
}
const batch=new Directory('af3_20261120000000_0123abcd'),results=new Directory('results');
batch.dirs.set('results',results);
const records=['protein_A','protein_B','missing_job'];
const manifest={format:'af3-fasta-batches',version:1,revision:3,runId:'20261120000000_0123abcd',generationComplete:true,
 source:{name:'synthetic.fasta',records:records.length},settings:{batchSize:30,sequenceFormat:'protein-lines'},
 batches:[{index:1,status:'imported',jsonFile:'synthetic_part001.json',fastaFile:'synthetic_part001.fasta',account:'fixture@example.com',attempts:[],
 jobs:records.map((name,i)=>({record:i+1,header:name,name,chainLengths:[20,9],importStatus:'confirmed',predictionStatus:'completed',jobId:'job-'+i}))}]};
let manifestText=JSON.stringify(manifest);
batch.put('manifest.json',manifestText);
const sequences=['ACDEFGHIKLMNPQRSTVWY','GAVLIPFYW'];
const inputJson=JSON.stringify(records.map(name=>({name,sequences:sequences.map(sequence=>({proteinChain:{sequence,count:1}})),modelSeeds:[],dialect:'alphafoldserver',version:1})));
const inputFasta=records.map(name=>'>'+name+'\n'+sequences.join('\n')).join('\n')+'\n';
batch.put('synthetic_part001.json',inputJson);batch.put('synthetic_part001.fasta',inputFasta);
const bytes=key=>Uint8Array.from(atob(zipFixtures[key]),char=>char.charCodeAt(0));
let primary='one';
for(const key of ['stored','flat','bzip','crc','encrypted','zip64','local-name','traversal','bad-json','bad-summary','bad-full','missing-full','null-iptm','duplicate'])if(id==='score-'+key)primary=key;
results.put('folds_one.zip',bytes(primary));results.put('protein_B__1234.zip',bytes('two'));
if(id==='score-empty')results.files.clear();
if(id==='score-corrupt')results.put('folds_one.zip',new Uint8Array([80,75,3,4,0]));
if(id==='score-missing-results')batch.dirs.delete('results');
if(id==='score-bad-manifest')batch.put('manifest.json','{broken');
const reused=['score-reuse','score-reuse-no-picker','score-unrelated-open','score-local-manifest','score-local-manifest-invalid'].includes(id);
const standalone=['score-standalone','score-nested','score-unrelated-open','score-scan-cancel','score-picker-default','score-duplicate-basenames','score-reentry','score-progress'].includes(id);
const output=reused||standalone?results:batch;
if(id==='score-nested'||id==='score-duplicate-basenames'){
 const nested=new Directory('nested');nested.put(id==='score-nested'?'extra.zip':'folds_one.zip',bytes('two'));results.dirs.set('nested',nested);
}
if(['score-existing','score-cancel','score-write-denied','score-close-denied','score-stop-write','score-output-change'].includes(id))output.put('all_scores.csv','old CSV sentinel');
window.showDirectoryPicker=async options=>{
 fs.pickers++;fs.options.push(options);assert(options.mode==='readwrite','Wrong folder permission request');
 if(!fs.restoring&&id==='score-picker-stop')ui('download-stop').click();
 if(!fs.restoring&&id==='score-reentry')ui('download-extract').dispatchEvent(new MouseEvent('click',{bubbles:true}));
 if(id==='score-picker-cancel')throw new DOMException('Cancelled','AbortError');
 if(id==='score-picker-denied')throw new DOMException('Denied','NotAllowedError');
 return fs.restoring?batch:reused||standalone?results:batch;
};
window.confirm=message=>{
 fs.confirms.push(message);
 const scan=message.startsWith('Chosen folder:');
 if(scan){assert(fs.contentReads===0,'Preview ran after archive parsing');if(id==='score-preview-change')results.put('folds_one.zip',bytes('two'));fs.scanApproved=id!=='score-scan-cancel';return fs.scanApproved}
 if(id==='score-progress'){
  const progress=ui('score-progress'),label=ui('score-progress-text');
  assert(progress&&!progress.hidden&&progress.max===2&&progress.value===2,'Finished parsing progress was not reported before write confirmation');
  assert(label.textContent.includes('2/2 (100%)'),'Final ZIP parsing percentage is wrong');
  assert(uiStatus().includes('preparing CSV'),'Missing report-preparation phase');
  ui('language-select').value='zh';ui('language-select').dispatchEvent(new Event('change'));
  assert(label.textContent.includes('ZIP 已解析')&&progress.value===2,'Progress translation reset its value');
  ui('language-select').value='en';ui('language-select').dispatchEvent(new Event('change'));
 }
 if(id==='score-output-change')output.put('all_scores.csv','new external CSV');
 return id!=='score-cancel';
};
const uiStatus=()=>ui('download-status')?.textContent||'';
async function waitFor(read,label,timeout=15000){const end=Date.now()+timeout;while(Date.now()<end){if(read())return;await pause(20)}throw Error(label+': '+uiStatus()+'; '+state.errors.join('; '))}
function csv(text){
 text=text.replace(/^﻿/,'');const rows=[],row=[];let field='',quote=false;
 for(let i=0;i<text.length;i++){const c=text[i];
  if(c==='"'){if(quote&&text[i+1]==='"'){field+='"';i++}else quote=!quote}
  else if(c===','&&!quote){row.push(field);field=''}
  else if((c==='\r'||c==='\n')&&!quote){if(c==='\r'&&text[i+1]==='\n')i++;row.push(field);rows.push(row.splice(0));field=''}
  else field+=c;
 }
 if(field||row.length){row.push(field);rows.push(row)}return rows;
}
async function table(name){
 const file=(name.startsWith('all_scores')?output:results).files.get(name);assert(file,'Missing '+name+'; '+uiStatus());
 const bom=new Uint8Array(await file.slice(0,3).arrayBuffer());
 assert(bom.join(',')==='239,187,191','Missing CSV BOM: '+name);
 return csv(await file.text());
}
(async()=>{
 const script=document.createElement('script');script.src='/script.js';document.head.append(script);
 await waitFor(()=>ui('download-extract'),'Missing extraction button');
 assert(!ui('download-extract').disabled,'Local extraction must work without a website scan');
 if(id==='score-progress')assert(ui('score-progress')?.hidden&&ui('score-progress-text')?.hidden,'Extraction progress was visible before starting');
 assert(!ui('download-save')&&!document.getElementById('af3-dev-panel').shadowRoot.textContent.includes('Saves separate ZIPs'),'Removed ZIP-save button/help is still present');

 if(reused){
  const hash=async text=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text))),v=>v.toString(16).padStart(2,'0')).join('');
  manifest.batches[0].jsonSha256=await hash(inputJson);manifest.batches[0].fastaSha256=await hash(inputFasta);
  batch.put('manifest.json',JSON.stringify(manifest));fs.restoring=true;ui('fasta-restore').click();
  await waitFor(()=>ui('fasta-stop').hidden,'Restore did not finish');
  assert(ui('fasta-status').textContent.includes('Choose the batch folder'),'Restore failed: '+ui('fasta-status').textContent);
  fs.restoring=false;
  if(id==='score-reuse-no-picker')window.showDirectoryPicker=undefined;
  if(id==='score-unrelated-open')batch.dirs.delete('results');
  if(id==='score-local-manifest'||id==='score-local-manifest-invalid'){
   const local=structuredClone(manifest);local.source.records=2;
   local.batches[0].jobs=[local.batches[0].jobs[1],local.batches[0].jobs[0]].map((job,index)=>({...job,record:index+1}));
   results.put('manifest.json',id==='score-local-manifest-invalid'?'{broken':JSON.stringify(local));
  }

 }
 if(id==='score-no-picker')window.showDirectoryPicker=undefined;
 if(id==='score-no-decompressor')window.DecompressionStream=undefined;
 const inputBefore=new Map(batch.files),zipBefore=new Map([...results.files].filter(([name])=>name.endsWith('.zip')));
 manifestText=await batch.files.get('manifest.json').text();
 if(id==='score-lock')await new Promise(ready=>navigator.locks.request('af3-score-extraction',async()=>{ready();await new Promise(resolve=>fs.unlock=resolve)}));
 ui('download-extract').click();
 await waitFor(()=>ui('download-stop').hidden,'Extraction did not finish',60000);fs.unlock?.();
 const status=uiStatus();
 const success=['score-extract','score-existing','score-reuse','score-stored','score-flat','score-missing-full','score-null-iptm','score-standalone','score-nested','score-unrelated-open','score-picker-default','score-duplicate-basenames','score-reentry','score-progress'].includes(id);
 if(id==='score-local-manifest'){
  const best=await table('all_scores.csv'),missing=await table('all_scores_missing.csv'),ix=key=>best[0].indexOf(key);
  assert(fs.commits.length===7&&best.length===3&&missing.length===1&&status.includes('missing manifest jobs: 0'),'Chosen folder own manifest was overridden by the opened parent: '+status);
  assert(best[1][ix('job')]==='protein_b'&&best[1][ix('in_fasta')]==='yes'&&best[2][ix('job')]==='protein_a','Own manifest order/membership was not preserved');
 }else if(success){
  assert(fs.commits.length===(['score-nested','score-duplicate-basenames'].includes(id)?9:7),'Expected 7 CSV commits, got '+fs.commits+'; '+status);
  const best=await table('all_scores.csv'),all=await table('all_scores_all_models.csv'),missing=await table('all_scores_missing.csv');
  assert(best.length===3&&all.length===(['score-nested','score-duplicate-basenames'].includes(id)?13:9)&&missing.length===(standalone?1:2),'Wrong best/all/missing counts');
  const ix=key=>best[0].indexOf(key);
  assert(best[1][ix('job')]==='protein_a'&&best[1][ix('fasta_header')]===(standalone?'':'protein_A')&&best[1][ix('ranking_score')]==='0.95'&&best[1][ix('model')]==='0'&&best[1][ix('source_zip')]===(id==='score-duplicate-basenames'?'nested/folds_one.zip':id==='score-nested'?'nested/extra.zip':reused||standalone?'protein_B__1234.zip':'results/protein_B__1234.zip'),'Wrong global best selection or manifest order');
  if(standalone)assert(best[1][ix('in_fasta')]===''&&status.includes('missing manifest jobs: —'),'Standalone output invented manifest membership or missing counts');
  assert(best[2][ix('job')]==='protein_b'&&best[2][ix('ranking_score')]==='0.9','Wrong second global best');
  assert(best[1][ix('peptide')]==='GAVLIPFYW'&&best[1][ix('n_chains')]==='2'&&Number(best[1][ix('pae_inter_mean')])===4.5,'Missing sequence/PAE metrics');
  const one=await table('folds_one_scores_best.csv'),pairs=await table('folds_one_scores_pairs.csv');
  assert(one[1][one[0].indexOf('job')]==='protein_b'&&one[2][one[0].indexOf('model')]==='1'&&pairs.length===9,'Wrong per-ZIP best or directed pair rows');
  if(id==='score-missing-full')assert(one[1][one[0].indexOf('n_tokens')]==='','Missing full-data file fabricated structural metrics');
  if(id==='score-null-iptm')assert(one[1][one[0].indexOf('iptm')]==='','Null ipTM was converted to a score');
  assert(fs.confirms.length===2&&fs.confirms[0].includes('.zip'),'Missing folder-preview confirmation before extraction');
  if(id==='score-existing')assert(fs.confirms[1].includes('all_scores.csv')&&fs.confirms[1].includes('overwrite'),'Replacement confirmation omitted the existing filename');
  assert(status.includes(['score-nested','score-duplicate-basenames'].includes(id)?'3 ZIPs':'2 ZIPs')&&status.includes('2 jobs')&&status.includes(['score-nested','score-duplicate-basenames'].includes(id)?'12 models':'8 models'),'Wrong extraction summary: '+status);
 }else{
  const partial=id==='score-partial'||id==='score-stop-close';
  if(id!=='score-output-change')assert(fs.commits.length===(partial?1:0),'False partial/success count '+fs.commits+'; '+status);
  if(id==='score-output-change')assert(await output.files.get('all_scores.csv').text()==='new external CSV','Overwrote a concurrently changed output');
  if(['score-cancel','score-write-denied','score-close-denied','score-stop-write'].includes(id))assert(await output.files.get('all_scores.csv').text()==='old CSV sentinel','Failed write overwrote old CSV');
  assert(!status.includes('Saved 7 CSV'),'Failure reported full success');
  if(partial)assert(status.includes('Saved 1 CSV'),'Partial close count missing');
  if(id==='score-stop-cleanup-failure')assert(status.includes('Could not remove'),'Cleanup failure was masked as a cancellation');
  if((id.startsWith('score-stop')&&id!=='score-stop-cleanup-failure')||id==='score-cancel'||id==='score-picker-cancel'||id==='score-scan-cancel'||id==='score-picker-stop')assert(/cancel|stop/i.test(status),'Cancellation not reported');
  const csvNames=[...batch.files.keys(),...results.files.keys()].filter(name=>name.endsWith('.csv'));
  assert(csvNames.every(name=>name==='all_scores.csv'||fs.commits.includes(name)||id.includes('cleanup-failure')),'Uncommitted placeholders remain');
 }
 for(const [name,file] of inputBefore)if(!name.endsWith('.csv')&&!(name==='manifest.json'&&id==='score-manifest-change'))assert(batch.files.get(name)===file,'Input changed: '+name);
 for(const [name,file] of zipBefore)if(id!=='score-preview-change')assert(results.files.get(name)===file,'ZIP changed: '+name);
 assert(fs.pickers===(id==='score-no-picker'?0:reused&&id!=='score-reuse-no-picker'?2:1),'Extraction did not always open its own picker: '+fs.pickers);
 if(id==='score-reuse')assert(fs.options[1].startIn===results,'Authorized results was not the suggested folder');
 if(id==='score-scan-cancel')assert(fs.contentReads===0&&fs.commits.length===0&&fs.confirms.length===1,'Scan cancellation parsed ZIPs or wrote CSVs');
 if(id==='score-nested')assert(fs.confirms[0].includes('nested/')&&fs.confirms[0].includes('nested/extra.zip')&&results.dirs.get('nested').files.has('extra_scores_best.csv'),'Nested tree preview or beside-ZIP CSV output missing');
 if(id==='score-duplicate-basenames')assert(results.files.has('folds_one_scores_best.csv')&&results.dirs.get('nested').files.has('folds_one_scores_best.csv'),'Same ZIP basenames in different folders collided');
 if(id==='score-preview-change')assert(fs.contentReads===0&&fs.commits.length===0&&status.includes('changed'),'Changed preview inputs were parsed or written');
 if(id==='score-picker-default'){
  const beforeCount=fs.pickers;fs.contentReads=0;fs.scanApproved=false;
  window.confirm=message=>{fs.confirms.push(message);return false};
  ui('download-extract').click();await waitFor(()=>ui('download-stop').hidden,'Second chooser did not finish');
  assert(fs.pickers===beforeCount+1&&fs.options.at(-1).startIn===results,'Second invocation skipped chooser or lost the last chosen directory');
  assert(fs.contentReads===0,'Second preview cancellation read ZIP contents');
 }
 if(id==='score-local-manifest-invalid')assert(fs.commits.length===0&&fs.contentReads===0&&status.includes('associated manifest.json is invalid'),'Invalid own manifest silently fell back to parent');
 if(id.includes('cleanup-failure'))assert(status.includes('Could not remove')&&status.includes('folds_one_scores_best.csv'),'Failed cleanup did not report the exact placeholder');
 if(id==='score-picker-stop')assert(fs.contentReads===0&&fs.confirms.length===0,'Stop during folder choice proceeded to preview or content reads');
 assert(ui('score-progress')?.hidden&&ui('score-progress-text')?.hidden,'Progress remained active after completion, failure or cancellation');
 if(id==='score-progress')assert(fs.progress.scan>0&&fs.progress.reads.includes(0)&&fs.progress.reads.includes(1)&&fs.progress.writes.join(',')==='0,1,2,3,4,5,6','Missing extraction stage progression');
 assert(fs.writers.every(mode=>mode==='exclusive'),'Non-exclusive CSV writer');
 assert(state.transportCalls.length===0&&state.downloads.length===0&&state.bulkDownloads.length===0&&state.submits===0&&state.clones===0&&state.deletes===0&&state.nativeCheckboxClicks===0,'Extraction performed a website action');
 assert(state.errors.length===0,state.errors.join('; '));
 parent.postMessage({type:'af3-case-result',result:{passed:true,message:status}},location.origin);
})().catch(error=>parent.postMessage({type:'af3-case-result',result:{passed:false,message:error.message}},location.origin));
</script>'''
CASE = CASE.replace('__FIXTURES__', json.dumps(FIXTURES))
SCENARIOS = [
    'score-progress', 'score-local-manifest', 'score-local-manifest-invalid', 'score-cleanup-failure', 'score-stop-cleanup-failure', 'score-picker-stop', 'score-reentry', 'score-preview-change', 'score-duplicate-basenames', 'score-standalone', 'score-nested', 'score-unrelated-open', 'score-scan-cancel', 'score-picker-default', 'score-extract', 'score-stored', 'score-flat', 'score-reuse', 'score-reuse-no-picker', 'score-existing', 'score-cancel',
    'score-picker-cancel', 'score-picker-denied', 'score-no-picker', 'score-no-decompressor',
    'score-missing-results', 'score-bad-manifest', 'score-empty', 'score-corrupt', 'score-crc',
    'score-encrypted', 'score-zip64', 'score-local-name', 'score-traversal', 'score-duplicate', 'score-bzip',
    'score-bad-json', 'score-bad-summary', 'score-bad-full', 'score-missing-full', 'score-null-iptm',
    'score-stop-read', 'score-stop-write', 'score-stop-close', 'score-write-denied', 'score-close-denied',
    'score-partial', 'score-lock', 'score-manifest-change', 'score-output-change',
]


def main():
    harness = runpy.run_path(str(Path(__file__).with_name('test_submission.py')))
    runner = harness['main']
    runner.__globals__.update(CASE=CASE, SCENARIOS=SCENARIOS, PAGE=harness['PAGE'])
    os.environ['AF_TEST_CASES'] = os.environ.get('AF_SCORE_TEST_CASES', ','.join(SCENARIOS))
    runner()


if __name__ == '__main__':
    main()
