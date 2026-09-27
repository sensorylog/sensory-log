/**
 * Sensory Log — Phase E pattern intelligence.
 *
 * Raw entries remain the source of truth. This module only derives descriptive
 * patterns: baselines, recurring signatures, signal relationships, recovery
 * curves, and trends. It never claims causation or diagnosis.
 */

const MIN_SAMPLE = 3;
const DAY_MS = 86400000;

const finite = value => Number.isFinite(Number(value)) ? Number(value) : null;
const avg = values => {
  const valid = values.map(finite).filter(v => v !== null);
  return valid.length ? valid.reduce((a,b)=>a+b,0)/valid.length : null;
};
const round = (value, digits=2) => {
  if (!Number.isFinite(value)) return null;
  const factor=10**digits;
  return Math.round(value*factor)/factor;
};
const parseDate = value => {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [y,m,d]=value.split("-").map(Number);
  const date=new Date(y,m-1,d);
  return date.getFullYear()===y && date.getMonth()===m-1 && date.getDate()===d ? date : null;
};
const sortedEntries = entries => (Array.isArray(entries)?entries:[])
  .filter(e=>e && parseDate(e.date))
  .slice()
  .sort((a,b)=>a.date.localeCompare(b.date));

const observations = (rows, field) => rows.map(e=>finite(e?.[field])).filter(v=>v!==null);
const meanDifference = (a,b) => {
  const va=a.map(finite).filter(v=>v!==null), vb=b.map(finite).filter(v=>v!==null);
  if(va.length<MIN_SAMPLE || vb.length<MIN_SAMPLE) return null;
  const difference=avg(va)-avg(vb);
  return { a:round(avg(va)), b:round(avg(vb)), difference:round(difference), nA:va.length, nB:vb.length };
};

function consecutivePairs(rows) {
  const pairs=[];
  for(let i=0;i<rows.length-1;i++){
    const a=parseDate(rows[i].date), b=parseDate(rows[i+1].date);
    if(a && b && Math.round((b-a)/DAY_MS)===1) pairs.push({previous:rows[i], next:rows[i+1]});
  }
  return pairs;
}

export function baselineProfile(entries=[], window=30) {
  const rows=sortedEntries(entries).slice(-window);
  const fields=["energy","overwhelm","sleepQuality","socialBattery","recovery","masking"];
  const values={};
  for(const field of fields){
    const sample=observations(rows,field);
    values[field]={value:round(avg(sample)),sampleSize:sample.length,window};
  }
  return {window, sampleDays:rows.length, fields:values};
}

export function signalRelationships(entries=[], options={}) {
  const rows=sortedEntries(entries);
  const window=options.window ?? 30;
  const pairs=consecutivePairs(rows).slice(-window);
  const relationships=[];

  const comparePair=(id,label,heavy,light)=>{
    const a=[],b=[];
    for(const pair of pairs){
      const hv=heavy(pair.previous), lv=light(pair.previous), energy=finite(pair.next.energy);
      if(energy===null) continue;
      if(hv) a.push(energy);
      if(lv) b.push(energy);
    }
    const result=meanDifference(a,b);
    if(result) relationships.push({id,label,measure:"nextDayEnergy",...result});
  };

  comparePair("sleep-next-energy","Sleep quality and next-day energy",e=>finite(e.sleepQuality)>=4,e=>finite(e.sleepQuality)!==null&&finite(e.sleepQuality)<=2);
  comparePair("masking-next-energy","Masking and next-day energy",e=>finite(e.masking)>=2,e=>finite(e.masking)!==null&&finite(e.masking)<2);
  comparePair("recovery-next-energy","Recovery need and next-day energy",e=>finite(e.recovery)>=4,e=>finite(e.recovery)!==null&&finite(e.recovery)<=2);

  const sameDay=(field,high,low,label)=>{
    const a=[],b=[];
    for(const e of rows.slice(-window)){
      const x=finite(e[field]), energy=finite(e.energy);
      if(x===null||energy===null) continue;
      if(high(x)) a.push(energy); else if(low(x)) b.push(energy);
    }
    const result=meanDifference(a,b);
    if(result) relationships.push({id:`${field}-same-day-energy`,label,measure:"sameDayEnergy",...result});
  };
  sameDay("overwhelm",x=>x>=4,x=>x<=2,"Sensory load and same-day energy");

  return relationships;
}

export function recurringSignatures(entries=[], options={}) {
  const rows=sortedEntries(entries).slice(-(options.window ?? 30));
  const lowEnergy=rows.filter(e=>finite(e.energy)!==null&&finite(e.energy)<=2);
  const signatures=[];

  const frequency=(field,label)=>{
    const counts=new Map();
    lowEnergy.forEach(e=>{
      const values=Array.isArray(e[field])?e[field]:[];
      [...new Set(values)].forEach(v=>counts.set(v,(counts.get(v)||0)+1));
    });
    for(const [value,count] of [...counts.entries()].sort((a,b)=>b[1]-a[1]).slice(0,5)){
      if(count>=MIN_SAMPLE) signatures.push({
        id:`${field}-${value}`,label,value,count,sampleSize:lowEnergy.length,
        frequency:round(count/lowEnergy.length)
      });
    }
  };

  frequency("drains","Frequent drain on lower-energy days");
  frequency("helped","Helpful strategy logged on lower-energy days");

  return signatures;
}

export function recoveryCurves(entries=[], options={}) {
  const rows=sortedEntries(entries);
  const pairs=consecutivePairs(rows).slice(-(options.window ?? 30));
  const samples=[];
  for(const pair of pairs){
    const before=finite(pair.previous.recovery);
    const nextEnergy=finite(pair.next.energy);
    const nextRecovery=finite(pair.next.recovery);
    if(before===null||nextEnergy===null) continue;
    samples.push({
      date:pair.previous.date,
      recoveryNeed:before,
      nextDayEnergy:nextEnergy,
      nextDayRecovery:nextRecovery
    });
  }
  const high=samples.filter(x=>x.recoveryNeed>=4).map(x=>x.nextDayEnergy);
  const moderate=samples.filter(x=>x.recoveryNeed>=2&&x.recoveryNeed<=3).map(x=>x.nextDayEnergy);
  const low=samples.filter(x=>x.recoveryNeed<=1).map(x=>x.nextDayEnergy);
  return {
    sampleSize:samples.length,
    groups:{
      high:{value:round(avg(high)),sampleSize:high.length},
      moderate:{value:round(avg(moderate)),sampleSize:moderate.length},
      low:{value:round(avg(low)),sampleSize:low.length}
    }
  };
}

export function trendProfile(entries=[], options={}) {
  const rows=sortedEntries(entries);
  const window=options.window ?? 30;
  const current=rows.slice(-window);
  const midpoint=Math.ceil(current.length/2);
  const first=current.slice(0,midpoint);
  const second=current.slice(midpoint);
  const fields=["energy","overwhelm","sleepQuality","socialBattery","recovery"];
  const trends={};
  for(const field of fields){
    const a=observations(first,field), b=observations(second,field);
    const difference=a.length>=MIN_SAMPLE&&b.length>=MIN_SAMPLE ? round(avg(b)-avg(a)) : null;
    trends[field]={first:round(avg(a)),second:round(avg(b)),difference,sampleFirst:a.length,sampleSecond:b.length};
  }
  return {window:current.length,trends};
}

export function buildPatternIntelligence(entries=[], options={}) {
  const rows=sortedEntries(entries);
  return Object.freeze({
    version:1,
    sampleDays:rows.length,
    baseline:baselineProfile(rows,options.window ?? 30),
    signatures:recurringSignatures(rows,options),
    relationships:signalRelationships(rows,options),
    recovery:recoveryCurves(rows,options),
    trends:trendProfile(rows,options)
  });
}
