import test from 'node:test';
import assert from 'node:assert/strict';
import {analyticsRange,bucketReports} from '../frontend/lib/analytics.ts';
test('custom date range follows IST and excludes next day',()=>{
 const range=analyticsRange('Custom Range','2026-09-16','2026-09-16');
 assert.equal(new Date(range.start).toISOString(),'2026-09-15T18:30:00.000Z');
 const rows=[{timestamp:'2026-09-15T18:29:59Z'},{timestamp:'2026-09-15T18:30:00Z'},{timestamp:'2026-09-16T18:29:59Z'},{timestamp:'2026-09-16T18:30:00Z'}];
 assert.equal(bucketReports(rows,range).reduce((s,b)=>s+b.reports,0),2);
});
test('seven day range counts older observations in daily buckets',()=>{
 const now=Date.parse('2026-09-17T00:00:00Z');
 const range=analyticsRange('7 Days','','',now);
 const buckets=bucketReports([{timestamp:'2026-09-12T03:00:00Z'}],range);
 assert.equal(buckets.reduce((s,b)=>s+b.reports,0),1);
 assert.equal(buckets.length,7);
});
test('missing or reversed custom range never produces misleading data',()=>{
 assert.equal(analyticsRange('Custom Range','','').valid,false);
 assert.equal(analyticsRange('Custom Range','2026-09-17','2026-09-16').valid,false);
 assert.deepEqual(bucketReports([],analyticsRange('Custom Range','','')),[]);
});
