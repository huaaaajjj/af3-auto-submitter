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
const fs={pickers:0,confirms:[],commits:[],aborts:0,removed:[],writers:[],mtime:100};
const absent=()=>new DOMException('Missing','NotFoundError');
class Directory {
 constructor(name){this.kind='directory';this.name=name;this.files=new Map();this.dirs=new Map()}
 put(name,data){this.files.set(name,new File([data],name,{lastModified:++fs.mtime}))}
 async *entries(){for(const name of this.files.keys())yield [name,await this.getFileHandle(name)]}
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
    if(csv&&id==='score-partial'&&fs.commits.length===1)throw new DOMException('Disk full','QuotaExceededError');
    staged=data;
    if(csv&&id==='score-stop-write')ui('download-stop').click();
    if(csv&&id==='score-manifest-change')batch.put('manifest.json',manifestText+' ');
   },async close(){
    if(csv&&id==='score-close-denied')throw new DOMException('Locked','NoModificationAllowedError');
    dir.put(name,staged);if(csv){fs.commits.push(name);if(id==='score-stop-close')ui('download-stop').click()}
   },async abort(){fs.aborts++}};
  }};
 }
 async removeEntry(name){if(!this.files.has(name))throw absent();this.files.delete(name);fs.removed.push(name)}
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
if(['score-existing','score-cancel','score-write-denied','score-close-denied','score-stop-write','score-output-change'].includes(id))results.put('all_scores.csv','old CSV sentinel');
window.showDirectoryPicker=async options=>{
 fs.pickers++;assert(options.mode==='readwrite','Wrong folder permission request');
 if(id==='score-picker-cancel')throw new DOMException('Cancelled','AbortError');
 if(id==='score-picker-denied')throw new DOMException('Denied','NotAllowedError');
 return batch;
};
window.confirm=message=>{
 fs.confirms.push(message);
 if(id==='score-output-change')results.put('all_scores.csv','new external CSV');
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
 const file=results.files.get(name);assert(file,'Missing '+name+'; '+uiStatus());
 const bom=new Uint8Array(await file.slice(0,3).arrayBuffer());
 assert(bom.join(',')==='239,187,191','Missing CSV BOM: '+name);
 return csv(await file.text());
}
(async()=>{
 const script=document.createElement('script');script.src='/script.js';document.head.append(script);
 await waitFor(()=>ui('download-extract'),'Missing extraction button');
 assert(!ui('download-extract').disabled,'Local extraction must work without a website scan');
 const reused=id==='score-reuse'||id==='score-reuse-no-picker';
 if(reused){
  const hash=async text=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text))),v=>v.toString(16).padStart(2,'0')).join('');
  manifest.batches[0].jsonSha256=await hash(inputJson);manifest.batches[0].fastaSha256=await hash(inputFasta);
  batch.put('manifest.json',JSON.stringify(manifest));ui('fasta-restore').click();
  await waitFor(()=>ui('fasta-stop').hidden,'Restore did not finish');
  assert(ui('fasta-status').textContent.includes('Choose the batch folder'),'Restore failed: '+ui('fasta-status').textContent);
  if(id==='score-reuse-no-picker')window.showDirectoryPicker=undefined;
 }
 if(id==='score-no-picker')window.showDirectoryPicker=undefined;
 if(id==='score-no-decompressor')window.DecompressionStream=undefined;
 const inputBefore=new Map(batch.files),zipBefore=new Map([...results.files].filter(([name])=>name.endsWith('.zip')));
 manifestText=await batch.files.get('manifest.json').text();
 if(id==='score-lock')await new Promise(ready=>navigator.locks.request('af3-results:'+manifest.runId,async()=>{ready();await new Promise(resolve=>fs.unlock=resolve)}));
 ui('download-extract').click();
 await waitFor(()=>ui('download-stop').hidden,'Extraction did not finish',60000);fs.unlock?.();
 const status=uiStatus();
 const success=['score-extract','score-existing','score-reuse','score-reuse-no-picker','score-stored','score-flat','score-missing-full','score-null-iptm'].includes(id);
 if(success){
  assert(fs.commits.length===7,'Expected 7 CSV commits, got '+fs.commits+'; '+status);
  const best=await table('all_scores.csv'),all=await table('all_scores_all_models.csv'),missing=await table('all_scores_missing.csv');
  assert(best.length===3&&all.length===9&&missing.length===2,'Wrong best/all/missing counts');
  const ix=key=>best[0].indexOf(key);
  assert(best[1][ix('job')]==='protein_a'&&best[1][ix('fasta_header')]==='protein_A'&&best[1][ix('ranking_score')]==='0.95'&&best[1][ix('model')]==='0'&&best[1][ix('source_zip')]==='protein_B__1234.zip','Wrong global best selection or manifest order');
  assert(best[2][ix('job')]==='protein_b'&&best[2][ix('ranking_score')]==='0.9','Wrong second global best');
  assert(best[1][ix('peptide')]==='GAVLIPFYW'&&best[1][ix('n_chains')]==='2'&&Number(best[1][ix('pae_inter_mean')])===4.5,'Missing sequence/PAE metrics');
  const one=await table('folds_one_scores_best.csv'),pairs=await table('folds_one_scores_pairs.csv');
  assert(one[1][one[0].indexOf('job')]==='protein_b'&&one[2][one[0].indexOf('model')]==='1'&&pairs.length===9,'Wrong per-ZIP best or directed pair rows');
  if(id==='score-missing-full')assert(one[1][one[0].indexOf('n_tokens')]==='','Missing full-data file fabricated structural metrics');
  if(id==='score-null-iptm')assert(one[1][one[0].indexOf('iptm')]==='','Null ipTM was converted to a score');
  assert(fs.confirms.length===1,'CSV generation did not ask exactly once');
  if(id==='score-existing')assert(fs.confirms[0].includes('all_scores.csv')&&fs.confirms[0].includes('overwrite'),'Replacement confirmation omitted the existing filename');
  assert(status.includes('2 ZIPs')&&status.includes('2 jobs')&&status.includes('8 models'),'Wrong extraction summary: '+status);
 }else{
  const partial=id==='score-partial'||id==='score-stop-close';
  if(id!=='score-output-change')assert(fs.commits.length===(partial?1:0),'False partial/success count '+fs.commits+'; '+status);
  if(id==='score-output-change')assert(await results.files.get('all_scores.csv').text()==='new external CSV','Overwrote a concurrently changed output');
  if(['score-cancel','score-write-denied','score-close-denied','score-stop-write'].includes(id))assert(await results.files.get('all_scores.csv').text()==='old CSV sentinel','Failed write overwrote old CSV');
  assert(!status.includes('Saved 7 CSV'),'Failure reported full success');
  if(partial)assert(status.includes('Saved 1 CSV'),'Partial close count missing');
  if(id.startsWith('score-stop')||id==='score-cancel'||id==='score-picker-cancel')assert(/cancel|stop/i.test(status),'Cancellation not reported');
  const csvNames=[...results.files.keys()].filter(name=>name.endsWith('.csv'));
  assert(csvNames.every(name=>name==='all_scores.csv'||fs.commits.includes(name)),'Uncommitted placeholders remain');
 }
 for(const [name,file] of inputBefore)if(!(name==='manifest.json'&&id==='score-manifest-change'))assert(batch.files.get(name)===file,'Input changed: '+name);
 for(const [name,file] of zipBefore)assert(results.files.get(name)===file,'ZIP changed: '+name);
 assert(fs.pickers===(id==='score-no-picker'?0:1),'Folder picker not reused/fallen back correctly: '+fs.pickers);
 assert(fs.writers.every(mode=>mode==='exclusive'),'Non-exclusive CSV writer');
 assert(state.transportCalls.length===0&&state.downloads.length===0&&state.bulkDownloads.length===0&&state.submits===0&&state.clones===0&&state.deletes===0&&state.nativeCheckboxClicks===0,'Extraction performed a website action');
 assert(state.errors.length===0,state.errors.join('; '));
 parent.postMessage({type:'af3-case-result',result:{passed:true,message:status}},location.origin);
})().catch(error=>parent.postMessage({type:'af3-case-result',result:{passed:false,message:error.message}},location.origin));
</script>'''
CASE = CASE.replace('__FIXTURES__', json.dumps(FIXTURES))
SCENARIOS = [
    'score-extract', 'score-stored', 'score-flat', 'score-reuse', 'score-reuse-no-picker', 'score-existing', 'score-cancel',
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
