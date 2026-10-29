import test from 'node:test';import assert from 'node:assert/strict';
import {upcoming,today} from '../src/client/api.ts';
test('annual month/day birthdays do not invent a birth year',()=>{
 const current=today();const [year,month,day]=current.split('-').map(Number);
 assert.equal(upcoming({annual:true,month,day,year:null}),0);
 assert.equal(upcoming({annual:false,month:1,day:7,year:null}),null);
});

