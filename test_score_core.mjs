// Fast, dependency-free checks for the actual userscript's local score functions.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const source = readFileSync(new URL('./af3-auto-submitter.user.js', import.meta.url), 'utf8');
const start = source.indexOf('    // --- Local score extraction:');
const end = source.indexOf('    // --- End local score extraction.', start);
assert(start > 0 && end > start, 'Score module boundaries changed');
const context = vm.createContext({
  Blob, TextDecoder, Uint8Array, Uint32Array, DataView, ArrayBuffer,
  downloadState: { stop: false },
  makeStoppedError: () => Object.assign(Error('stopped'), { isUserStop: true }),
  isUserStopError: error => !!error?.isUserStop,
  sleep: () => new Promise(setImmediate),
  t: (key, vars = {}) => key + ': ' + JSON.stringify(vars),
});
vm.runInContext(source.slice(start, end) + '\nglobalThis.core = {scoreRound,scoreCsv,scoreStructure,scoreOutputs,scoreBest,scoreCheck};', context);
const c = context.core;
for (const [value, digits, expected] of [[1.125, 2, 1.12], [1.375, 2, 1.38], [2.675, 2, 2.67],
  [-1.125, 2, -1.12], [0.00005, 4, 0.0001], [0.10005, 4, 0.1001], [0, 4, 0]]) {
  assert.equal(c.scoreRound(value, digits), expected, `Python-compatible round(${value}, ${digits})`);
}
assert.equal(c.scoreRound(null), '');
assert.throws(() => c.scoreRound(Infinity), /scoreInvalidData/);
assert.throws(() => c.scoreRound('0.5'), /scoreInvalidData/);
const stats = await c.scoreStructure({pae: [[0,1,2],[3,0,4],[5,6,0]], token_chain_ids: ['A','B','C'], atom_plddts: [90,80,70]});
assert.equal(stats.pae_inter_mean, 3.5);
assert.equal(stats.pae_inter_min, 1);
assert.equal(stats.plddt_mean, 80);
assert.equal(stats.n_tokens, 3);
const monomer = await c.scoreStructure({pae: [[0,1],[1,0]], token_chain_ids: ['A','A'], atom_plddts: [90,80]});
assert.equal(monomer.pae_inter_min, '');
assert.equal(monomer.pae_inter_mean, '');
await assert.rejects(c.scoreStructure({pae: [[1,2],[1]], token_chain_ids: ['A','B']}), /scoreInvalidData/);
assert.equal(c.scoreCsv([{job:'a,"b\nc', score:-1.25, clash:true, empty:null}], ['job','score','clash','empty']),
  '﻿job,score,clash,empty\r\n"a,""b\nc",-1.25,True,\r\n');
assert(c.scoreCsv([{job:'=SUM(1,2)'}], ['job']).includes("'=SUM(1,2)"));
assert(c.scoreCsv([{job:'\tformula'}], ['job']).includes("'\tformula"));
function row(job, score, extra = {}) {
  return {job,job_name:job,model:0,ranking_score:score,source_zip:'one.zip',n_chains:2,chain_ids:'A;B',
    long_peptide:'ACDE',short_peptide:'FGH',long_peptide_len:4,short_peptide_len:3,_sequences:'["ACDE","FGH"]',...extra};
}
const first = row('first', .9), second = row('first', .9, {model:1});
assert.equal(c.scoreBest([first, second]).get('first'), first, 'Tie must preserve first model');
const manifest = {batches:[{jobs:[{name:'wanted',header:'原始标题'},{name:'missing',header:'Missing'}]}]};
const rows = [row('outside', .99), row('wanted', .8), row('wanted', .95, {model:1}), row('outside', .75, {model:1})];
const report = c.scoreOutputs([{name:'one.zip',rows,pairs:[]}], manifest);
assert.equal(report.jobs, 2); assert.equal(report.models, 4); assert.equal(report.missing, 1);
const merged = report.outputs.find(output => output.name === 'all_scores.csv').text;
assert(merged.indexOf('原始标题,yes,wanted') < merged.indexOf(',no,outside'), 'Manifest order must precede extra results');
assert(report.outputs.some(output => output.name === 'all_scores_missing.csv' && output.text.includes('Missing')));
const single = row('solo', .9, {n_chains:1,chain_ids:'A',short_peptide:'',short_peptide_len:0,chain_iptm_A:null});
const triple = row('tri', .8, {n_chains:3,chain_ids:'A;B;C',chain_iptm_C:.4,pair_iptm_A_C:.5,pair_iptm_C_A:.6});
const multi = c.scoreOutputs([{name:'many.zip',rows:[single,triple],pairs:[]}],{batches:[{jobs:[]}]});
assert(multi.outputs[0].text.includes('chain_iptm_C') && multi.outputs[0].text.includes('pair_iptm_C_A'));
assert.throws(() => c.scoreOutputs([{name:'bad.zip',rows:[row('same',.8),row('same',.9,{_sequences:'["ACDE","FGH","DIFFERENT"]'})],pairs:[]}], manifest), /scoreAmbiguous/);
assert.throws(() => c.scoreOutputs([{name:'a.zip',rows:[row('x',.8,{job_name:'wanted'}),row('y',.9,{job_name:'wanted'})],pairs:[]}], manifest), /scoreAmbiguous/);
assert.throws(() => c.scoreOutputs([{name:'ONE.zip',rows:[first],pairs:[]},{name:'one.ZIP',rows:[first],pairs:[]}], manifest), /scoreOutputConflict/);
const standalone = c.scoreOutputs([{name:'standalone.zip',rows:[row('independent',.8)],pairs:[]}]);
assert.equal(standalone.missing, null, 'Absent manifest must not imply zero missing jobs');
assert(standalone.outputs.find(output=>output.name==='all_scores.csv').text.includes('independent'), 'Standalone scores were discarded');
assert.equal(standalone.outputs.find(output=>output.name==='all_scores_missing.csv').text.trim().split(String.fromCharCode(13,10)).length, 1);
const noMissing = c.scoreOutputs([{name:'one.zip',rows:[row('wanted',.8)],pairs:[]}],{batches:[{jobs:[{name:'wanted',header:'wanted'}]}]});
assert.equal(noMissing.outputs.at(-1).text,'﻿fasta_header,norm_key,n_jobs_found,n_fasta_copies\r\n', 'Empty missing table must replace stale findings');
context.downloadState.stop = true;
assert.throws(() => c.scoreCheck(), /stopped/);
console.log('PASS score core: Python rounding, single/multi-chain stats, CSV escaping, best selection, manifest matching, collisions and stop');
