import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateBmi, deriveCmrf, classifySld, calculateFib4, evaluateFib4, evaluatePlatelets, interpretNit } from '../clinical-rules.js';

test('BMI helper rounds to one decimal place',()=>assert.equal(calculateBmi(182,88),26.6));
test('CMRF is derived from numeric inputs without manual checkboxes',()=>{const c=deriveCmrf({sex:'male',bmi:22.5,waist:90,hba1c:5.8,sbp:125,dbp:78,tg:120,hdl:55,diagnosedDiabetes:false,antihypertensiveTreatment:false,lipidTreatment:false});assert.equal(c.statuses.glucose,true);assert.equal(c.count,1)});
test('waist is requested only when it can determine the final CMRF',()=>{const c=deriveCmrf({sex:'male',bmi:22.5,waist:null,hba1c:5.4,sbp:120,dbp:75,tg:110,hdl:60,diagnosedDiabetes:false,antihypertensiveTreatment:false,lipidTreatment:false});assert.equal(c.needsWaist,true)});
test('MASLD and MetALD alcohol boundaries follow Japanese 2026 thresholds',()=>{const c={hasAny:true,count:1,needsWaist:false,canRuleOutAll:false,unknownKeys:[]};assert.equal(classifySld({steatosis:true,sex:'male',alcoholGWeek:209,otherCause:false},c).id,'masld');assert.equal(classifySld({steatosis:true,sex:'male',alcoholGWeek:210,otherCause:false},c).id,'metald');assert.equal(classifySld({steatosis:true,sex:'male',alcoholGWeek:420,otherCause:false},c).id,'metald');assert.equal(classifySld({steatosis:true,sex:'male',alcoholGWeek:421,otherCause:false},c).id,'ald')});
test('FIB-4 calculation matches expected formula',()=>assert.equal(calculateFib4({age:65,ast:40,alt:45,plateletsWan:18.5}),2.10));
test('age 66 uses the 2.0 lower FIB-4 threshold',()=>{assert.equal(evaluateFib4(65,1.5).id,'intermediate');assert.equal(evaluateFib4(66,1.5).id,'low');assert.equal(evaluateFib4(66,2.0).id,'intermediate');assert.equal(evaluateFib4(66,2.68).id,'high')});
test('platelet supporting bands use 15 and 20 man/uL boundaries',()=>{assert.equal(evaluatePlatelets(14.9).id,'high');assert.equal(evaluatePlatelets(15).id,'intermediate');assert.equal(evaluatePlatelets(20).id,'intermediate');assert.equal(evaluatePlatelets(20.1).id,'low')});
test('NIT output remains suggestive rather than definitive',()=>{const r=interpretNit({vcteKpa:8.2,swe:'',sweUnit:'kpa',mreKpa:'',elf:'',type4Collagen7s:'',m2bpgi:''});assert.equal(r[0].status,'suggestive');assert.match(r[0].detail,/示唆/)});

test('MASLD can coexist with another steatosis etiology',()=>{const c={hasAny:true,count:1,needsWaist:false,canRuleOutAll:false,unknownKeys:[]};const r=classifySld({steatosis:true,sex:'male',alcoholGWeek:0,otherCause:true},c);assert.equal(r.id,'masld');assert.match(r.title,/特定成因併存/)});
