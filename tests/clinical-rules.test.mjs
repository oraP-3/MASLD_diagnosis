import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateBmi, deriveCmrf, evaluateGlycemia, classifyOfficeBp, evaluateBpDyslipidemia, evaluateBloodPressure, evaluateUricAcid, classifySld, calculateFib4, evaluateFib4, evaluatePlatelets, shouldShowNit, interpretNit } from '../clinical-rules.js';

test('BMI helper rounds to one decimal place',()=>assert.equal(calculateBmi(182,88),26.6));
test('CMRF is derived from numeric inputs without manual checkboxes',()=>{const c=deriveCmrf({sex:'male',bmi:22.5,waist:90,hba1c:5.8,sbp:125,dbp:78,tg:120,hdl:55,diagnosedDiabetes:false,antihypertensiveTreatment:false,lipidTreatment:false});assert.equal(c.statuses.glucose,true);assert.equal(c.count,1)});
test('waist is requested only when it can determine the final CMRF',()=>{const c=deriveCmrf({sex:'male',bmi:22.5,waist:null,hba1c:5.4,fastingGlucose:99,sbp:120,dbp:75,tg:110,hdl:60,diagnosedDiabetes:false,antihypertensiveTreatment:false,lipidTreatment:false});assert.equal(c.needsWaist,true)});
test('MASLD and MetALD alcohol boundaries follow Japanese 2026 thresholds',()=>{const c={hasAny:true,count:1,needsWaist:false,canRuleOutAll:false,unknownKeys:[]};assert.equal(classifySld({steatosis:true,sex:'male',alcoholGWeek:209,otherCause:false},c).id,'masld');assert.equal(classifySld({steatosis:true,sex:'male',alcoholGWeek:210,otherCause:false},c).id,'metald');assert.equal(classifySld({steatosis:true,sex:'male',alcoholGWeek:420,otherCause:false},c).id,'metald');assert.equal(classifySld({steatosis:true,sex:'male',alcoholGWeek:421,otherCause:false},c).id,'ald')});
test('FIB-4 calculation preserves full precision for classification',()=>{const score=calculateFib4({age:65,ast:40,alt:45,plateletsWan:18.5});assert.ok(Math.abs(score-2.0950546816214244)<1e-12)});
test('age 66 uses the 2.0 lower FIB-4 threshold',()=>{assert.equal(evaluateFib4(65,1.5).id,'intermediate');assert.equal(evaluateFib4(66,1.5).id,'low');assert.equal(evaluateFib4(66,2.0).id,'intermediate');assert.equal(evaluateFib4(66,2.68).id,'high')});
test('platelet supporting bands use 15 and 20 man/uL boundaries',()=>{assert.equal(evaluatePlatelets(14.9).id,'high');assert.equal(evaluatePlatelets(15).id,'intermediate');assert.equal(evaluatePlatelets(20).id,'intermediate');assert.equal(evaluatePlatelets(20.1).id,'low')});
test('NIT output remains suggestive rather than definitive',()=>{const r=interpretNit({vcteKpa:8.2,swe:'',sweUnit:'kpa',mreKpa:'',elf:'',type4Collagen7s:'',m2bpgi:''});assert.equal(r[0].status,'f2');assert.match(r[0].detail,/示唆/)});
test('NIT severity uses green below F2 and yellow at or above F2',()=>{const r=interpretNit({vcteKpa:7.9,swe:'',sweUnit:'kpa',mreKpa:'',elf:'',type4Collagen7s:'',m2bpgi:''});assert.equal(r[0].status,'below');assert.equal(r[0].severityLabel,'≥F2未満')});
test('MRE and ELF can escalate to F4 red status at guideline cutoffs',()=>{const r=interpretNit({vcteKpa:20,swe:'',sweUnit:'kpa',mreKpa:4.45,elf:11.8,type4Collagen7s:7,m2bpgi:2});const byKey=Object.fromEntries(r.map(x=>[x.key,x]));assert.equal(byKey.vcte.status,'f2');assert.equal(byKey.mre.status,'f4');assert.equal(byKey.elf.status,'f4');assert.equal(byKey.type4.status,'f2');assert.equal(byKey.m2bpgi.status,'f2')});

test('MASLD can coexist with another steatosis etiology',()=>{const c={hasAny:true,count:1,needsWaist:false,canRuleOutAll:false,unknownKeys:[]};const r=classifySld({steatosis:true,sex:'male',alcoholGWeek:0,otherCause:true},c);assert.equal(r.id,'masld');assert.match(r.title,/特定成因併存/)});

test('low-risk FIB-4 with preserved platelets does not request second-line NIT',()=>{assert.equal(shouldShowNit({fib4Evaluation:evaluateFib4(55,0.9),plateletsWan:25}),false)});

test('waist remains relevant after a value is entered so it can be reviewed or corrected',()=>{const c=deriveCmrf({sex:'male',bmi:22.5,waist:95,hba1c:5.4,fastingGlucose:99,sbp:120,dbp:75,tg:110,hdl:60,diagnosedDiabetes:false,antihypertensiveTreatment:false,lipidTreatment:false});assert.equal(c.waistRelevant,true);assert.equal(c.needsWaist,false);assert.equal(c.statuses.body,true)});
test('Japanese 2026 waist criterion is strictly greater than 94/80 cm',()=>{const base={bmi:22.5,hba1c:5.4,fastingGlucose:99,sbp:120,dbp:75,tg:110,hdl:60,diagnosedDiabetes:false,antihypertensiveTreatment:false,lipidTreatment:false};assert.equal(deriveCmrf({...base,sex:'male',waist:94}).statuses.body,false);assert.equal(deriveCmrf({...base,sex:'male',waist:94.1}).statuses.body,true);assert.equal(deriveCmrf({...base,sex:'female',waist:80}).statuses.body,false);assert.equal(deriveCmrf({...base,sex:'female',waist:80.1}).statuses.body,true)});
test('specific-cause SLD waits until decision-relevant CMRFs are resolved',()=>{const c=deriveCmrf({sex:'male',bmi:22.5,waist:null,hba1c:5.4,fastingGlucose:99,sbp:120,dbp:75,tg:110,hdl:60,diagnosedDiabetes:false,antihypertensiveTreatment:false,lipidTreatment:false});const r=classifySld({steatosis:true,sex:'male',alcoholGWeek:0,otherCause:true},c);assert.equal(r.id,'pending');assert.deepEqual(r.missing,['waist'])});
test('FIB-4 classification uses the unrounded value at the high-risk boundary',()=>{assert.equal(evaluateFib4(60,2.6716).id,'high');assert.equal(evaluateFib4(60,1.299).id,'low')});

test('glycemia below 5.7 does not request glucose confirmation',()=>{const r=evaluateGlycemia({diagnosedDiabetes:false,hba1c:5.6,fastingGlucose:'',randomGlucose:''});assert.equal(r.id,'below_masld_cmrf');assert.equal(r.needsGlucoseConfirmation,false)});
test('glycemia 5.7 to 6.4 is MASLD glucose CMRF without diabetes confirmation flow',()=>{const r=evaluateGlycemia({diagnosedDiabetes:false,hba1c:6.1,fastingGlucose:'',randomGlucose:''});assert.equal(r.id,'masld_glucose_cmrf');assert.equal(r.needsGlucoseConfirmation,false)});
test('HbA1c 6.5 or above requests glucose confirmation when diabetes is not diagnosed',()=>{const r=evaluateGlycemia({diagnosedDiabetes:false,hba1c:6.6,fastingGlucose:'',randomGlucose:''});assert.equal(r.id,'hba1c_diabetic_range_needs_glucose');assert.equal(r.needsGlucoseConfirmation,true)});
test('diagnosed diabetes bypasses diagnostic confirmation flow and uses general HbA1c target context',()=>{const inTarget=evaluateGlycemia({diagnosedDiabetes:true,hba1c:6.8,fastingGlucose:'',randomGlucose:''});const above=evaluateGlycemia({diagnosedDiabetes:true,hba1c:7.2,fastingGlucose:150,randomGlucose:''});assert.equal(inTarget.id,'known_diabetes_general_target');assert.equal(above.id,'known_diabetes_above_general_target');assert.equal(above.needsGlucoseConfirmation,false)});
test('fasting glucose can confirm diabetic-type glucose without a selector',()=>{const r=evaluateGlycemia({diagnosedDiabetes:false,hba1c:6.6,fastingGlucose:126,randomGlucose:''});assert.equal(r.id,'hba1c_and_glucose_diabetic_range');assert.match(r.detail,/空腹時血糖 126/);assert.match(r.detail,/最終診断/)});
test('random glucose can confirm diabetic-type glucose without a selector',()=>{const r=evaluateGlycemia({diagnosedDiabetes:false,hba1c:6.6,fastingGlucose:'',randomGlucose:200});assert.equal(r.id,'hba1c_and_glucose_diabetic_range');assert.match(r.detail,/随時血糖 200/)});
test('subthreshold entered glucose remains unconfirmed',()=>{const r=evaluateGlycemia({diagnosedDiabetes:false,hba1c:6.6,fastingGlucose:125,randomGlucose:199});assert.equal(r.id,'hba1c_diabetic_range_glucose_below');assert.equal(r.needsGlucoseConfirmation,true)});
test('either glucose field can make the entered glucose diabetic-type when both are present',()=>{const r=evaluateGlycemia({diagnosedDiabetes:false,hba1c:6.6,fastingGlucose:110,randomGlucose:205});assert.equal(r.id,'hba1c_and_glucose_diabetic_range');assert.match(r.detail,/少なくとも一つ/)});

test('UA 7.0 without treatment is not hyperuricemia and asks no gout or stone questions',()=>{const r=evaluateUricAcid({uricAcid:7.0,urateTreatment:false,goutPresent:null,urinaryStone:null,otherUrateComplication:null,diagnosedDiabetes:false,antihypertensiveTreatment:false});assert.equal(r.id,'no_hyperuricemia');assert.equal(r.showContextQuestions,false)});
test('UA above 7 requests gout history before treatment branching',()=>{const r=evaluateUricAcid({uricAcid:7.1,urateTreatment:false,goutPresent:null,urinaryStone:null,otherUrateComplication:null,diagnosedDiabetes:false,antihypertensiveTreatment:false});assert.equal(r.id,'needs_gout');assert.equal(r.showContextQuestions,true)});
test('gout branch is guideline-supported and uses 6 mg/dL reference target',()=>{const r=evaluateUricAcid({uricAcid:7.4,urateTreatment:false,goutPresent:true,urinaryStone:false,otherUrateComplication:false,diagnosedDiabetes:false,antihypertensiveTreatment:false});assert.equal(r.id,'gout_branch');assert.match(r.detail,/6.0 mg\/dL以下/)});
test('UA 8.0 to 8.9 waits for relevant complication status when unresolved',()=>{const r=evaluateUricAcid({uricAcid:8.2,urateTreatment:false,goutPresent:false,urinaryStone:null,otherUrateComplication:null,diagnosedDiabetes:false,antihypertensiveTreatment:false});assert.equal(r.id,'needs_complication');assert.equal(r.showComplicationQuestion,true)});
test('UA 8.0 to 8.9 with diabetes enters treatment-consideration branch',()=>{const r=evaluateUricAcid({uricAcid:8.2,urateTreatment:false,goutPresent:false,urinaryStone:false,otherUrateComplication:null,diagnosedDiabetes:true,antihypertensiveTreatment:false});assert.equal(r.id,'asymptomatic_ge8_with_complication');assert.match(r.detail,/考慮/)});
test('UA 8.0 to 8.9 with no relevant complication remains lifestyle-first',()=>{const r=evaluateUricAcid({uricAcid:8.2,urateTreatment:false,goutPresent:false,urinaryStone:false,otherUrateComplication:false,diagnosedDiabetes:false,antihypertensiveTreatment:false});assert.equal(r.id,'asymptomatic_8_without_complication');assert.match(r.detail,/生活習慣/)});
test('urinary stone independently counts as a relevant complication',()=>{const r=evaluateUricAcid({uricAcid:8.2,urateTreatment:false,goutPresent:false,urinaryStone:true,otherUrateComplication:null,diagnosedDiabetes:false,antihypertensiveTreatment:false});assert.equal(r.id,'asymptomatic_ge8_with_complication')});
test('UA 9.0 or higher can trigger treatment consideration without complication data',()=>{const r=evaluateUricAcid({uricAcid:9.0,urateTreatment:false,goutPresent:false,urinaryStone:null,otherUrateComplication:null,diagnosedDiabetes:false,antihypertensiveTreatment:false});assert.equal(r.id,'asymptomatic_ge9');assert.equal(r.showComplicationQuestion,false)});
test('urate-lowering treatment preserves treatment context even when current UA is below 7',()=>{const atTarget=evaluateUricAcid({uricAcid:5.9,urateTreatment:true,goutPresent:null,urinaryStone:null,otherUrateComplication:null,diagnosedDiabetes:false,antihypertensiveTreatment:false});const above=evaluateUricAcid({uricAcid:6.5,urateTreatment:true,goutPresent:null,urinaryStone:null,otherUrateComplication:null,diagnosedDiabetes:false,antihypertensiveTreatment:false});assert.equal(atTarget.id,'treated_at_target');assert.equal(above.id,'treated_above_target');assert.equal(atTarget.showContextQuestions,false)});

test('MASLD glucose CMRF includes fasting glucose >=100 mg/dL',()=>{const c=deriveCmrf({sex:'male',bmi:22.5,waist:90,hba1c:5.4,fastingGlucose:100,sbp:120,dbp:75,tg:110,hdl:60,diagnosedDiabetes:false,antihypertensiveTreatment:false,lipidTreatment:false});assert.equal(c.statuses.glucose,true)});
test('fasting glucose 100 with HbA1c below 5.7 is still MASLD glucose CMRF',()=>{const r=evaluateGlycemia({diagnosedDiabetes:false,hba1c:5.6,fastingGlucose:100,randomGlucose:''});assert.equal(r.id,'masld_glucose_cmrf');assert.match(r.detail,/空腹時血糖 100/)});
test('fasting glucose 126 is diabetic-type even when HbA1c is below 6.5',()=>{const r=evaluateGlycemia({diagnosedDiabetes:false,hba1c:5.8,fastingGlucose:126,randomGlucose:'',separateDayDiabeticTypeConfirmed:false});assert.equal(r.id,'fasting_glucose_diabetic_range_needs_confirmation');assert.equal(r.showSeparateDayConfirmation,true);assert.match(r.detail,/糖尿病型/)});
test('fasting diabetic-type plus separate-day diabetic-type confirmation meets diagnostic criteria',()=>{const r=evaluateGlycemia({diagnosedDiabetes:false,hba1c:5.8,fastingGlucose:130,randomGlucose:'',separateDayDiabeticTypeConfirmed:true});assert.equal(r.id,'fasting_glucose_diabetic_range_repeat_confirmed');assert.equal(r.showSeparateDayConfirmation,true);assert.match(r.title,/診断基準を満たす/)});
test('separate-day confirmation does not alter a sub-diabetic fasting-glucose branch',()=>{const r=evaluateGlycemia({diagnosedDiabetes:false,hba1c:5.8,fastingGlucose:125,randomGlucose:'',separateDayDiabeticTypeConfirmed:true});assert.equal(r.id,'masld_glucose_cmrf');assert.equal(Boolean(r.showSeparateDayConfirmation),false)});
test('UA 9.0 shows treatment consideration before gout history is answered',()=>{const r=evaluateUricAcid({uricAcid:9.0,urateTreatment:false,goutPresent:null,urinaryStone:null,otherUrateComplication:null,diagnosedDiabetes:false,antihypertensiveTreatment:false});assert.equal(r.id,'asymptomatic_ge9');assert.match(r.title,/薬物療法を考慮/)});

test('glucose CMRF stays unresolved when HbA1c is negative but fasting glucose is missing',()=>{const c=deriveCmrf({sex:'male',bmi:22.5,waist:90,hba1c:5.4,fastingGlucose:'',sbp:120,dbp:75,tg:110,hdl:60,diagnosedDiabetes:false,antihypertensiveTreatment:false,lipidTreatment:false});assert.equal(c.statuses.glucose,null);assert.ok(c.unknownKeys.includes('glucose'));assert.equal(c.canRuleOutAll,false)});
test('glucose CMRF stays unresolved when fasting glucose is negative but HbA1c is missing',()=>{const c=deriveCmrf({sex:'male',bmi:22.5,waist:90,hba1c:'',fastingGlucose:99,sbp:120,dbp:75,tg:110,hdl:60,diagnosedDiabetes:false,antihypertensiveTreatment:false,lipidTreatment:false});assert.equal(c.statuses.glucose,null);assert.ok(c.unknownKeys.includes('glucose'));assert.equal(c.canRuleOutAll,false)});
test('random glucose field stays visible after it confirms diabetic-type glucose',()=>{const r=evaluateGlycemia({diagnosedDiabetes:false,hba1c:6.6,fastingGlucose:110,randomGlucose:205});assert.equal(r.id,'hba1c_and_glucose_diabetic_range');assert.equal(r.needsGlucoseConfirmation,false);assert.equal(r.showRandomGlucose,true)});
test('random glucose field can hide when fasting glucose already confirms and random glucose is empty',()=>{const r=evaluateGlycemia({diagnosedDiabetes:false,hba1c:6.6,fastingGlucose:126,randomGlucose:''});assert.equal(r.id,'hba1c_and_glucose_diabetic_range');assert.equal(r.showRandomGlucose,false)});


const bpBase = {
  age: 50,
  sex: 'female',
  sbp: 132,
  dbp: 82,
  ldl: 100,
  hdl: 60,
  tg: 100,
  tgFastingStatus: '',
  currentSmoking: false,
  lipidTreatment: false,
  diagnosedDiabetes: false,
  diagnosedCkd: false,
  cvdHistory: false,
  atrialFibrillation: false,
  proteinuriaPresent: null,
  antihypertensiveTreatment: false,
  bpPersistence: '',
};

test('office BP classification uses the higher SBP or DBP category',()=>{
  assert.equal(classifyOfficeBp(118,76).id,'normal');
  assert.equal(classifyOfficeBp(125,76).id,'elevated_normal');
  assert.equal(classifyOfficeBp(125,82).id,'elevated');
  assert.equal(classifyOfficeBp(145,85).id,'grade1');
  assert.equal(classifyOfficeBp(130,102).id,'grade2');
  assert.equal(classifyOfficeBp(181,75).id,'grade3');
});

test('untreated BP at or above 130/80 requests persistence confirmation',()=>{
  const r=evaluateBloodPressure(bpBase);
  assert.equal(r.category.id,'elevated');
  assert.equal(r.showPersistenceQuestion,true);
  assert.equal(r.persistenceConfirmed,false);
  assert.equal(r.timingClass,'needs_confirmation');
});

test('confirmed low-risk elevated BP remains lifestyle and planned reassessment',()=>{
  const r=evaluateBloodPressure({...bpBase,bpPersistence:'home'});
  assert.equal(r.riskLevel,'low');
  assert.equal(r.persistenceConfirmed,true);
  assert.equal(r.timingClass,'lifestyle_planned_reassessment');
});

test('diabetes makes elevated BP high risk and shortens reassessment after persistence confirmation',()=>{
  const r=evaluateBloodPressure({...bpBase,diagnosedDiabetes:true,bpPersistence:'other_office'});
  assert.equal(r.riskLevel,'high');
  assert.ok(r.highRiskReasons.includes('diabetes'));
  assert.equal(r.timingClass,'short_interval_reassessment_with_pharmacologic_consideration');
});

test('CVD and atrial fibrillation independently create high-risk BP branches',()=>{
  const cvd=evaluateBloodPressure({...bpBase,cvdHistory:true,bpPersistence:'home'});
  const af=evaluateBloodPressure({...bpBase,atrialFibrillation:true,bpPersistence:'home'});
  assert.equal(cvd.riskLevel,'high');
  assert.ok(cvd.highRiskReasons.includes('cvd'));
  assert.equal(af.riskLevel,'high');
  assert.ok(af.highRiskReasons.includes('atrial_fibrillation'));
});

test('proteinuria is requested only when established CKD can change elevated-BP risk',()=>{
  const pending=evaluateBloodPressure({...bpBase,diagnosedCkd:true});
  assert.equal(pending.showProteinuriaQuestion,true);
  assert.equal(pending.needsProteinuria,true);
  assert.equal(pending.riskLevel,'unresolved');

  const positive=evaluateBloodPressure({...bpBase,diagnosedCkd:true,proteinuriaPresent:true,bpPersistence:'home'});
  assert.equal(positive.showProteinuriaQuestion,true);
  assert.equal(positive.needsProteinuria,false);
  assert.equal(positive.riskLevel,'high');
  assert.ok(positive.highRiskReasons.includes('proteinuric_ckd'));

  const negative=evaluateBloodPressure({...bpBase,diagnosedCkd:true,proteinuriaPresent:false,bpPersistence:'home'});
  assert.equal(negative.riskLevel,'low');
});

test('grade II CKD can keep risk bounded without asking proteinuria when action timing is unchanged',()=>{
  const r=evaluateBloodPressure({...bpBase,sbp:165,dbp:92,diagnosedCkd:true});
  assert.equal(r.category.id,'grade2');
  assert.equal(r.showProteinuriaQuestion,false);
  assert.equal(r.riskLevel,'unresolved');
  assert.ok(r.possibleRisks.includes('moderate'));
  assert.ok(r.possibleRisks.includes('high'));
  assert.equal(r.timingClass,'prompt_confirmation');
});

test('three layer-2 factors produce high risk without another trigger',()=>{
  const r=evaluateBloodPressure({...bpBase,age:65,sex:'male',currentSmoking:true,bpPersistence:'home'});
  assert.equal(r.riskLevel,'high');
  assert.ok(r.highRiskReasons.includes('three_layer2_factors'));
});

test('BP dyslipidemia thresholds follow the locked LDL HDL and fasting/nonfasting TG rules',()=>{
  assert.equal(evaluateBpDyslipidemia({...bpBase,ldl:140}).status,true);
  assert.equal(evaluateBpDyslipidemia({...bpBase,hdl:39}).status,true);
  assert.equal(evaluateBpDyslipidemia({...bpBase,tg:150,tgFastingStatus:'fasting'}).status,true);
  assert.equal(evaluateBpDyslipidemia({...bpBase,tg:174,tgFastingStatus:'nonfasting'}).status,false);
  assert.equal(evaluateBpDyslipidemia({...bpBase,tg:175,tgFastingStatus:'nonfasting'}).status,true);
});

test('TG 150-174 asks fasting status only when it can change the JSH risk tier',()=>{
  const unresolved=evaluateBloodPressure({
    ...bpBase,
    age:65,
    sex:'male',
    tg:160,
    tgFastingStatus:'',
  });
  assert.equal(unresolved.showTgFastingQuestion,true);
  assert.equal(unresolved.needsTgFastingStatus,true);

  const nonfasting=evaluateBloodPressure({
    ...bpBase,
    age:65,
    sex:'male',
    tg:160,
    tgFastingStatus:'nonfasting',
    bpPersistence:'home',
  });
  const fasting=evaluateBloodPressure({
    ...bpBase,
    age:65,
    sex:'male',
    tg:160,
    tgFastingStatus:'fasting',
    bpPersistence:'home',
  });
  assert.equal(nonfasting.riskLevel,'moderate');
  assert.equal(fasting.riskLevel,'high');
  assert.equal(fasting.showTgFastingQuestion,true);
});

test('grade I high risk does not emit medication-start timing before persistence is confirmed',()=>{
  const unconfirmed=evaluateBloodPressure({...bpBase,sbp:145,dbp:92,diagnosedDiabetes:true});
  const confirmed=evaluateBloodPressure({...bpBase,sbp:145,dbp:92,diagnosedDiabetes:true,bpPersistence:'home'});
  assert.equal(unconfirmed.timingClass,'prompt_confirmation_high_risk');
  assert.equal(confirmed.timingClass,'prompt_pharmacologic_consideration');
});

test('treated patients skip persistence confirmation and use target context',()=>{
  const within=evaluateBloodPressure({...bpBase,sbp:125,dbp:78,antihypertensiveTreatment:true});
  const above=evaluateBloodPressure({...bpBase,sbp:135,dbp:82,antihypertensiveTreatment:true});
  assert.equal(within.showPersistenceQuestion,false);
  assert.equal(within.timingClass,'treated_within_target');
  assert.equal(above.showPersistenceQuestion,false);
  assert.equal(above.timingClass,'treated_above_target');
});

test('grade III BP uses urgent assessment and skips routine persistence question',()=>{
  const r=evaluateBloodPressure({...bpBase,sbp:182,dbp:105});
  assert.equal(r.category.id,'grade3');
  assert.equal(r.timingClass,'urgent_assessment');
  assert.equal(r.showPersistenceQuestion,false);
  assert.equal(r.riskLevel,'high');
});

test('diagnosed CKD is reused by the uric-acid 8 mg/dL complication branch',()=>{
  const r=evaluateUricAcid({
    uricAcid:8.2,
    urateTreatment:false,
    goutPresent:false,
    urinaryStone:false,
    otherUrateComplication:null,
    diagnosedDiabetes:false,
    antihypertensiveTreatment:false,
    diagnosedCkd:true,
  });
  assert.equal(r.id,'asymptomatic_ge8_with_complication');
  assert.equal(r.showComplicationQuestion,false);
});

test('one low eGFR value does not by itself become established CKD in the uric-acid branch',()=>{
  const r=evaluateUricAcid({
    uricAcid:8.2,
    urateTreatment:false,
    goutPresent:false,
    urinaryStone:false,
    otherUrateComplication:null,
    diagnosedDiabetes:false,
    antihypertensiveTreatment:false,
    diagnosedCkd:false,
    eGfr:45,
  });
  assert.equal(r.id,'needs_complication');
});


test('treated grade III BP still routes to urgent assessment',()=>{
  const r=evaluateBloodPressure({...bpBase,sbp:182,dbp:112,antihypertensiveTreatment:true});
  assert.equal(r.category.id,'grade3');
  assert.equal(r.timingClass,'urgent_assessment');
  assert.equal(r.showPersistenceQuestion,false);
});

test('known diabetes suppresses redundant CVD and AF prompt when elevated-BP risk is already high',()=>{
  const r=evaluateBloodPressure({...bpBase,diagnosedDiabetes:true});
  assert.equal(r.riskLevel,'high');
  assert.equal(r.showRiskBackground,false);
  assert.equal(r.showTgFastingQuestion,false);
  assert.equal(r.showProteinuriaQuestion,false);
});

test('three known layer-2 factors suppress redundant CVD and AF prompt',()=>{
  const r=evaluateBloodPressure({...bpBase,age:65,sex:'male',currentSmoking:true});
  assert.equal(r.riskLevel,'high');
  assert.equal(r.showRiskBackground,false);
});

test('confirmed high-risk elevated BP preserves both short-interval reassessment and drug consideration state',()=>{
  const r=evaluateBloodPressure({...bpBase,diagnosedDiabetes:true,bpPersistence:'home'});
  assert.equal(r.riskLevel,'high');
  assert.equal(r.timingClass,'short_interval_reassessment_with_pharmacologic_consideration');
});
