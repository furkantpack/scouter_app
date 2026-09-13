type J = Record<string, unknown>;
export type FundedCompanyReportInput = {
  company: { name: string; investorName?: string | null; stage?: string | null; geography?: string | null; founders?: string[]; description?: string | null };
  analysis: {
    completed_at?: string | null; created_at?: string | null;
    reference_company_json?: J; original_wedge_json?: J; founder_dna_json?: J;
    investor_pattern_json?: J; customer_pattern_json?: J; category_evolution_json?: J;
    value_chain_json?: J; maturity_map_json?: J; historical_validators_json?: J[];
    missing_layers_json?: J[]; final_insight_json?: J; excluded_candidates_json?: J[];
    evidence?: unknown;
  };
  candidates: Array<{
    rank: number; founder_name: string; company_name?: string | null; current_role?: string | null;
    founder_state: string; pattern_branch?: string | null; historical_comparable?: string | null;
    pattern_match_score: number | string; scouter_score?: number | string | null; why_now: string;
    visibility: string; evidence?: J[]; red_flags?: string[]; external_identity?: J | null;
  }>;
  signals?: Array<{ signal_type: string; signal_date?: string | null; explanation: string; why_it_matters: string; source_url: string }>;
};

const W = 595.28, H = 841.89;
const C = { navy: '#14233B', ink: '#1D2A3B', muted: '#607083', ivory: '#FBF7EF', white: '#FFFFFF', line: '#D9D8D2', peach: '#FCE5D7', mint: '#DFEEE5', blue: '#DDEAF5', lilac: '#E9E2F2', orange: '#EE7545' };

function clean(value: unknown, fallback = ''): string {
  if (value == null) return fallback;
  const raw = Array.isArray(value) ? value.join(', ') : String(value);
  return raw.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[\u2010-\u2015]/g, '-').replace(/[\u2018\u2019]/g, "'").replace(/[\u201C\u201D]/g, '"').replace(/[^\x20-\x7E]/g, ' ').replace(/\s+/g, ' ').trim() || fallback;
}
const rec = (v: unknown): J => v && typeof v === 'object' && !Array.isArray(v) ? v as J : {};
const arr = (v: unknown): unknown[] => Array.isArray(v) ? v : [];
const strs = (v: unknown) => arr(v).map(x => clean(x)).filter(Boolean);
function val(row: J, keys: string[], fallback = 'Not persisted') {
  for (const key of keys) { const result = clean(row[key]); if (result && result !== 'Unknown') return result; }
  return fallback;
}
function spreadString(value: unknown) {
  const row = rec(value), keys = Object.keys(row).filter(k => /^\d+$/.test(k)).map(Number).sort((a,b)=>a-b);
  if (!keys.length || keys.some((key,index)=>key!==index)) return '';
  const chars = keys.map(key=>row[String(key)]);
  return chars.every(char=>typeof char==='string' && char.length===1) ? clean(chars.join('')) : '';
}
function rgb(color: string) { const n=parseInt(color.slice(1),16); return [n>>16&255,n>>8&255,n&255].map(x=>(x/255).toFixed(3)).join(' '); }
const esc = (v: unknown) => clean(v).replace(/[()\\]/g, m=>`\\${m}`);
function wrap(v: unknown, width: number, size: number) {
  const max=Math.max(8,Math.floor(width/(size*.52))), out:string[]=[]; let line='';
  for (const raw of clean(v,'Not persisted').split(/\s+/)) for (const word of raw.match(new RegExp(`.{1,${max}}`,'g'))||[raw]) {
    const next=`${line} ${word}`.trim(); if(next.length>max&&line){out.push(line);line=word}else line=next;
  }
  if(line)out.push(line); return out;
}

class Page {
  commands:string[]=[];
  readonly section:string;
  readonly cover:boolean;
  constructor(section:string,cover=false){
    this.section=section;this.cover=cover;
    this.rect(0,0,W,H,C.ivory);
    if(!cover){this.text('SCOUTER',42,29,9,true,C.navy);this.text(section.toUpperCase(),118,29,7.5,true,C.muted);this.line(42,43,W-42,43,C.line)}
  }
  rect(x:number,top:number,w:number,h:number,fill:string,stroke?:string){const y=H-top-h;this.commands.push(`${rgb(fill)} rg ${stroke?`${rgb(stroke)} RG .7 w`:''} ${x} ${y} ${w} ${h} re ${stroke?'B':'f'}`)}
  line(x1:number,t1:number,x2:number,t2:number,color=C.line,width=.8){this.commands.push(`${rgb(color)} RG ${width} w ${x1} ${H-t1} m ${x2} ${H-t2} l S`)}
  text(v:unknown,x:number,top:number,size=10,bold=false,color=C.ink){this.commands.push(`BT /${bold?'F2':'F1'} ${size} Tf ${rgb(color)} rg 1 0 0 1 ${x} ${H-top-size} Tm (${esc(v)}) Tj ET`)}
  para(v:unknown,x:number,top:number,w:number,o:{size?:number;lh?:number;bold?:boolean;color?:string;max?:number}={}){const size=o.size||9.3,lh=o.lh||size*1.35,lines=wrap(v,w,size).slice(0,o.max||99);lines.forEach((line,i)=>this.text(line,x,top+i*lh,size,o.bold,o.color||C.ink));return top+lines.length*lh}
  title(v:unknown,sub?:unknown){this.text(v,42,65,22,true,C.navy);if(clean(sub))this.para(sub,42,97,500,{size:9.5,color:C.muted,max:2})}
  card(x:number,top:number,w:number,h:number,label:unknown,value:unknown,accent=C.blue,max=5){this.rect(x,top,w,h,C.white,C.line);this.rect(x,top,5,h,accent);this.text(label,x+15,top+13,7.3,true,C.muted);this.para(value,x+15,top+31,w-28,{size:9,lh:12,max})}
}
class Report { pages:Page[]=[]; page(s:string,cover=false){const p=new Page(s,cover);this.pages.push(p);return p} }

function sourceMap(analysis: FundedCompanyReportInput['analysis']) {
  const pack=rec(rec(analysis.reference_company_json).evidence_pack), sources=arr(pack.sources).map(rec).filter(s=>clean(s.url));
  const index=new Map<string,number>();sources.forEach((s,i)=>index.set(clean(s.url),i+1));return{pack,sources,index};
}
function refs(urls:unknown,s:{index:Map<string,number>}){const nums=strs(urls).map(u=>s.index.get(u)).filter((n):n is number=>!!n);return nums.length?` [${Array.from(new Set(nums)).join(', ')}]`:''}
function fact(pack:J,group:string,name:string,s:{index:Map<string,number>}){const row=arr(pack[group]).map(rec).find(x=>clean(x.field).toLowerCase()===name.toLowerCase());return row?`${val(row,['value'])}${refs(row.source_urls,s)}`:'Not persisted'}
function detail(page:Page,label:string,value:unknown,top:number){page.text(label.toUpperCase(),56,top,7.2,true,C.muted);page.para(value,172,top-1,360,{size:9,lh:11.5,max:3});page.line(56,top+34,539,top+34,'#E8E5DE',.5)}
function flow(page:Page,items:Array<[string,unknown,string]>,start=135){const h=Math.min(100,(650-start)/items.length);items.forEach((item,i)=>{const top=start+i*(h+15);page.rect(70,top,455,h,item[2],C.line);page.text(item[0].toUpperCase(),88,top+14,7.4,true,C.muted);page.para(item[1],88,top+33,415,{size:9.7,lh:12.6,max:4});if(i<items.length-1){page.line(W/2,top+h,W/2,top+h+15,C.orange,1.5);page.text('v',W/2-2,top+h+2,8,true,C.orange)}})}
function ext(candidate:FundedCompanyReportInput['candidates'][number],keys:string[]){const r=rec(candidate.external_identity);for(const k of keys){const v=clean(r[k]);if(v)return v}return'Not available in persisted analysis'}

function candidateCard(p:Page,c:FundedCompanyReportInput['candidates'][number],top:number){
  p.rect(42,top,511,310,C.white,C.line);p.rect(42,top,7,310,c.rank<=5?C.orange:C.blue);p.text(`#${c.rank}`,60,top+16,8,true,C.orange);p.text(c.founder_name,91,top+13,14,true,C.navy);p.text(clean(c.company_name,'Pre-company / undisclosed'),91,top+34,9,false,C.muted);
  p.card(402,top+13,63,51,'SCOUTER',clean(c.scouter_score,'-'),C.mint,2);p.card(472,top+13,67,51,'PATTERN',c.pattern_match_score,C.peach,2);
  const y=top+78;p.text('STATUS / ROLE',63,y,7,true,C.muted);p.para(`${c.founder_state} | ${clean(c.current_role,'Role not persisted')} | ${clean(c.visibility).replace('_',' ')}`,63,y+14,459,{size:8.3,max:1});
  p.text('STARTED / TEAM / FUNDING',63,y+34,7,true,C.muted);p.para(ext(c,['started','founded','employees','funding']),202,y+33,320,{size:8,max:1});
  p.text('PATTERN BRANCH',63,y+61,7,true,C.muted);p.para(clean(c.pattern_branch,'Not classified'),63,y+75,210,{size:8.2,max:1});p.text('HISTORICAL COMPARABLE',302,y+61,7,true,C.muted);p.para(clean(c.historical_comparable,'Not persisted'),302,y+75,220,{size:8.2,max:1});
  p.text('WHY NOW',63,y+101,7,true,C.muted);p.para(c.why_now,63,y+115,459,{size:8.5,lh:10.7,max:3});p.text('EARLY / CUSTOMER SIGNALS',63,y+157,7,true,C.muted);const evidence=arr(c.evidence).map(rec);p.para(evidence.length?evidence.slice(0,2).map(e=>val(e,['excerpt','title'])).join(' | '):'No candidate-level evidence text was persisted.',63,y+171,459,{size:7.9,lh:9.8,color:C.muted,max:2});
  p.text('STRATEGIC COMPLEMENTARITY / PLATFORM TYPES',63,y+205,7,true,C.muted);p.para(`Branch: ${clean(c.pattern_branch,'Not persisted')} | Potential platform types: not persisted`,63,y+219,459,{size:7.9,color:C.muted,max:2});p.text('RED FLAGS',63,y+255,7,true,C.muted);p.para(c.red_flags?.length?c.red_flags.join(' | '):'None persisted',125,y+254,397,{size:7.9,color:c.red_flags?.length?C.orange:C.muted,max:2});
}

export function createReportPdf(input:FundedCompanyReportInput){
  const {company,analysis,candidates}=input, report=new Report(), sm=sourceMap(analysis), pack=sm.pack;
  const reference=rec(analysis.reference_company_json),identity=rec(pack.company_identity),wedge=rec(analysis.original_wedge_json),dna=rec(analysis.founder_dna_json),investor=rec(analysis.investor_pattern_json),customer=rec(analysis.customer_pattern_json),evolution=rec(analysis.category_evolution_json),insight=rec(analysis.final_insight_json);
  const validators=arr(analysis.historical_validators_json).map(rec),missing=arr(analysis.missing_layers_json).map(rec),branches=arr(rec(analysis.value_chain_json).branches).map(rec),founders=arr(pack.founders).map(rec),maturity=arr(rec(analysis.maturity_map_json).stages).map(x=>typeof x==='string'?clean(x):spreadString(x)||val(rec(x),['stage'],'')).filter(Boolean);let p:Page;

  p=report.page('Cover',true);p.rect(0,0,W,16,C.orange);p.text('SCOUTER',48,58,13,true,C.navy);p.text('REFERENCE COMPANY INTELLIGENCE',48,82,8,true,C.muted);p.text(company.name.toUpperCase(),48,235,38,true,C.navy);p.text('PATTERN INTELLIGENCE',48,281,19,true,C.orange);p.para(val(evolution,['category_evolution','current_opportunity_layer'],company.description||'Investor-grade reference pattern analysis'),48,326,470,{size:12,lh:17,color:C.muted,max:4});p.rect(48,615,499,112,C.white,C.line);[['INVESTOR',clean(company.investorName,'Not persisted'),67],['STAGE',clean(company.stage,fact(pack,'funding','Stage',sm)),280],['RESEARCH DATE',clean(analysis.completed_at||analysis.created_at).slice(0,10)||'Not persisted',425]].forEach(x=>{p.text(x[0],Number(x[2]),636,7.5,true,C.muted);p.text(x[1],Number(x[2]),654,10,true,C.ink)});p.text('Scouter Reference Company Intelligence',67,697,8.5,false,C.muted);

  p=report.page('Executive Summary');p.title('Executive Summary','The investment case, compressed into the decisions that matter.');const top=candidates[0],callouts:[string,string,string][]=[['CORE INVESTMENT INSIGHT',val(reference,['executive_summary']),C.peach],['ORIGINAL WEDGE',val(wedge,['wedge']),C.blue],['FOUNDER ARCHETYPE',val(dna,['notable_backgrounds','composition']),C.mint],['CATEGORY EVOLUTION',val(evolution,['category_evolution']),C.lilac],['HISTORICAL VALIDATOR',validators.length?val(validators[0],['event','name']):'Not persisted',C.peach],['MISSING LAYER',missing.length?val(missing[0],['valuable_missing_layer','layer']):val(insight,['missing_layer']),C.blue],['TOP EMERGING FOUNDER',top?`${top.founder_name} / ${clean(top.company_name,'Undisclosed')} - Pattern ${top.pattern_match_score}`:'No candidate passed',C.mint],['KEY UNCERTAINTY',arr(pack.conflicts).map(x=>val(rec(x),['field'])).join(', ')||'No material persisted conflict',C.lilac]];callouts.forEach((x,i)=>p.card(42+i%2*257,130+Math.floor(i/2)*142,244,124,x[0],x[1],x[2],6));

  p=report.page('Verified Reference Company');p.title(`Verified Reference Company - ${company.name}`,'Only persisted facts; brackets refer to the source appendix.');const founderNames=founders.map(f=>val(f,['name'])).filter(x=>x!=='Not persisted');const rows:[string,string][]=[['Company',`${val(rec(identity.exact_name),['value'],company.name)}${refs(rec(identity.exact_name).source_urls,sm)}`],['Founded',`${val(rec(identity.founded_date),['value'])}${refs(rec(identity.founded_date).source_urls,sm)}`],['HQ',`${val(rec(identity.hq),['value'],company.geography||'Not persisted')}${refs(rec(identity.hq).source_urls,sm)}`],['Founders',founderNames.join(', ')||clean(company.founders,'Not persisted')],['Product',fact(pack,'product','Core Product',sm)],['Stage',fact(pack,'funding','Stage',sm)],['Funding',fact(pack,'funding','Amount',sm)],['Investors',fact(pack,'funding','Investors',sm)],['Customers',fact(pack,'customer','Target Archetype',sm)],['Traction',`${fact(pack,'traction','Usage',sm)}; ${fact(pack,'traction','Growth',sm)}`],['Current status',`${val(rec(identity.current_status),['value'])}${refs(rec(identity.current_status).source_urls,sm)}`]];rows.forEach((x,i)=>detail(p,x[0],x[1],135+i*49));const conflicts=arr(pack.conflicts).map(rec);if(conflicts.length)p.card(42,700,511,72,'PERSISTED UNCERTAINTIES',conflicts.map(x=>`${val(x,['field'])}: ${strs(x.accounts).join(' vs ')}`).join(' | '),C.peach,3);

  p=report.page('Original Wedge');p.title('Original Wedge','The smallest useful product and the operational logic behind adoption.');flow(p,[['Before','Manual phone handling and missed customer calls',C.white],['Operational pain',val(wedge,['problem']),C.peach],['Reference company wedge',val(wedge,['wedge']),C.blue],['Customer value',val(wedge,['why_it_worked']),C.mint]],135);p.card(70,670,455,74,'WHO FELT IT',val(wedge,['buyer']),C.lilac,3);

  p=report.page('Founder DNA');p.title('Founder DNA',val(dna,['composition']));founders.slice(0,5).forEach((f,i)=>{const x=42+i%2*257,y=135+Math.floor(i/2)*130;const details=[val(f,['background']),`Domain: ${strs(f.domain_experience).filter(x=>x!=='Unknown').join(', ')||'Not persisted'}`,`Prior company: ${strs(f.prior_employers).filter(x=>x!=='Unknown').join(', ')||'Not persisted'}`].join(' | ');p.card(x,y,244,112,val(f,['name']),`${details}${refs(f.source_urls,sm)}`,i%2?C.blue:C.mint,6)});p.card(42,548,511,129,'REUSABLE FOUNDER ARCHETYPE',strs(dna.archetypes)[0]||val(dna,['notable_backgrounds']),C.peach,6);p.text('DOMAIN DEPTH  +  TECHNICAL OWNERSHIP  +  EXPERIENCED GTM',73,702,10,true,C.navy);p.text('v',294,725,9,true,C.orange);p.text('VERTICAL VOICE-AI COMPANY BUILDER',171,748,12,true,C.orange);

  p=report.page('Investor & Customer Pattern');p.title('Investor & Customer Pattern','Capital logic and adoption logic, kept distinct.');p.rect(42,133,244,585,C.white,C.line);p.rect(309,133,244,585,C.white,C.line);p.text('INVESTOR PATTERN',62,157,12,true,C.navy);[['PROFILE / SYNDICATE',val(investor,['profile']),190,100,C.blue],['REPEATABLE INVESTMENT LOGIC',val(investor,['thesis']),308,141,C.lilac],['STAGE',fact(pack,'funding','Stage',sm),467,105,C.mint],['INVESTORS',fact(pack,'funding','Investors',sm),590,95,C.peach]].forEach(x=>p.card(62,Number(x[2]),204,Number(x[3]),x[0],x[1],x[4] as string,6));p.text('CUSTOMER PATTERN',329,157,12,true,C.navy);[['INITIAL CUSTOMER TYPES',val(customer,['target']),190,114,C.mint],['PROBLEM SEVERITY',val(wedge,['problem']),322,114,C.peach],['ADOPTION TRIGGER',val(wedge,['why_it_worked']),454,105,C.blue],['TRACTION SIGNAL',`${fact(pack,'traction','Usage',sm)}; ${fact(pack,'traction','Growth',sm)}`,577,108,C.lilac]].forEach(x=>p.card(329,Number(x[2]),204,Number(x[3]),x[0],x[1],x[4] as string,6));

  p=report.page('Category Evolution');p.title('Category Evolution','From legacy interaction systems to the next investable market layer.');const scale=validators.filter(v=>val(v,['pattern'],'').toLowerCase().includes('scale')).map(v=>val(v,['name'])).join(' | ');flow(p,[['Early market',val(evolution,['early_market']),C.white],['Reference company wedge',val(evolution,['reference_company_wedge','reference_wedge']),C.blue],['Category evolution',val(evolution,['category_evolution']),C.lilac],['Current scale-stage validators',scale||'No scale-stage validator persisted',C.mint],['Next opportunity layer',val(evolution,['current_opportunity_layer','next_opportunity_layer']),C.peach]],126);

  p=report.page('Value-Chain Tree');p.title('Value-Chain Tree','Business-model and market-layer branches; maturity is intentionally separate.');p.rect(215,126,165,48,C.navy);p.text(`${company.name.toUpperCase()} MARKET`,239,143,10,true,C.white);branches.forEach((b,i)=>{const t=215+i*163;p.line(297,i?t-41:174,297,t,C.orange,1.2);p.rect(62,t,471,131,C.white,C.line);p.text(val(b,['branch','layer']),82,t+17,11,true,C.navy);p.para(`Market layer: ${val(b,['market_layer','status'])}`,82,t+42,429,{size:9,max:2});const more=[val(b,['historical_benchmark'],''),val(b,['scale_stage_validator'],''),val(b,['emerging_company'],'')].filter(Boolean).join(' | ');p.para(more||'No additional structured branch detail persisted.',82,t+76,429,{size:8.5,color:C.muted,max:3})});

  p=report.page('Maturity Tree');p.title('Maturity Tree','Company maturity is shown independently from value-chain position.');const stages=['Pre-announcement / Stealth','Alpha / Pre-launch','Very Early','Pre-seed','Seed','Series A','Growth','M&A / Consolidator'];stages.forEach((stage,i)=>{const t=130+i*75,needle=stage==='Very Early'?'early-stage':stage.toLowerCase(),match=maturity.find(x=>x.toLowerCase().startsWith(needle));p.rect(58+i*7,t,470-i*14,52,match?C.blue:C.white,C.line);p.text(stage.toUpperCase(),76+i*7,t+12,7.5,true,match?C.navy:C.muted);p.para(match?match.replace(/^[^:]+:\s*/,''):'No persisted company mapping',210,t+10,300-i*14,{size:8.5,color:match?C.ink:C.muted,max:2})});

  const validatorChunks=[] as J[][];for(let i=0;i<validators.length;i+=3)validatorChunks.push(validators.slice(i,i+3));(validatorChunks.length?validatorChunks:[[]]).forEach((chunk,pageNo)=>{p=report.page('Historical Pattern Validation');p.title(`Historical Pattern Validation${validatorChunks.length>1?` ${pageNo+1}/${validatorChunks.length}`:''}`,'External companies and events that validate the category pattern.');chunk.forEach((v,i)=>{const t=132+i*177;p.rect(42,t,511,154,C.white,C.line);p.text(val(v,['similarity']),469,t+16,8,true,val(v,['similarity'])==='Strong'?C.orange:C.muted);p.para(val(v,['event','name']),62,t+15,385,{size:10.5,bold:true,max:3});p.text(val(v,['pattern']).toUpperCase(),62,t+64,7.2,true,C.muted);p.para(val(v,['what_it_proves']),62,t+83,466,{size:8.5,lh:10.8,max:4});p.text(`SOURCE${refs(v.source_urls,sm)}`,62,t+134,7,true,C.orange)})});

  p=report.page('Strategic Outcome / Consolidation');p.title('Strategic Outcome / Consolidation','Category-level complementarity; no acquisition outcome is asserted for the reference company.');const comp=rec(investor.strategic_complementarity);flow(p,[['Incumbent owns',val(comp,['incumbent_owned']),C.blue],['Target / new layer owns',val(comp,['target_owned']),C.peach],['Combined structure',val(comp,['combined_structure']),C.mint]],165);const cons=validators.find(v=>val(v,['pattern'],'').toLowerCase().includes('consolidation'));p.card(70,590,455,125,'CATEGORY CONSOLIDATION EVIDENCE',cons?`${val(cons,['event'])}${refs(cons.source_urls,sm)}`:'No qualifying consolidation evidence persisted.',C.lilac,6);

  p=report.page('Missing-Layer Map');p.title('Missing-Layer Map','Only supported persisted fields are shown; empty placeholder columns are omitted.');missing.forEach((m,i)=>{const t=145+i*215;p.rect(55,t,485,181,C.white,C.line);p.text(`OPEN LAYER ${i+1}`,75,t+18,8,true,C.orange);p.para(val(m,['valuable_missing_layer','layer']),75,t+43,445,{size:13,lh:17,bold:true,max:4});const supporting=[['INCUMBENT / PLATFORM',val(m,['incumbent'],'')],['ALREADY OWNS',strs(m.owns).join(', ')],['DOES NOT OWN',val(m,['does_not_own'],'')],['STARTUP ARCHETYPE',val(m,['startup_archetype'],'')]].filter((x):x is [string,string]=>Boolean(x[1]));supporting.forEach((x,j)=>{p.text(x[0],75,t+116+j*20,6.8,true,C.muted);p.text(x[1],205,t+115+j*20,8)})});p.card(55,596,485,116,'INVESTOR IMPLICATION',val(insight,['missing_layer']),C.peach,5);

  p=report.page('Founder Archetypes');p.title('Founder Archetypes','Reusable hunting profiles derived only from persisted founder evidence.');founders.slice(0,5).forEach((f,i)=>{const t=126+i*127,background=val(f,['background']),cap=strs(f.domain_experience).filter(x=>x!=='Unknown').join(' + ')||background,signal=/founder/i.test(background)?'Repeat company-building experience':'Deep operating experience';p.rect(42,t,511,108,i%2?C.white:'#FFFDF8',C.line);p.text(val(f,['name']),60,t+14,10.5,true,C.navy);p.para(`BACKGROUND: ${background}`,60,t+36,468,{size:8.2,max:2});p.para(`CAPABILITY: ${cap}  +  FORMATION SIGNAL: ${signal}`,60,t+65,468,{size:8.2,color:C.muted,max:2});p.text(`v  ${cap.toUpperCase()} FOUNDER`,60,t+88,7.5,true,C.orange)});

  const chunks=[] as typeof candidates[];for(let i=0;i<candidates.length;i+=13)chunks.push(candidates.slice(i,i+13));chunks.forEach((chunk,pageNo)=>{p=report.page('Emerging Founder Ranking');p.title(`Emerging Founder Ranking ${pageNo+1}/${chunks.length}`,'Scouter Score and Pattern Match remain separate. Verification confidence is not displayed.');p.rect(42,126,511,30,C.navy);[['#',52],['FOUNDER / COMPANY',78],['STATE',242],['SC',348],['MATCH',380],['BRANCH / WHY NOW',430]].forEach(x=>p.text(x[0],Number(x[1]),137,6.6,true,C.white));chunk.forEach((c,i)=>{const t=158+i*47;if(i%2)p.rect(42,t,511,47,'#FFFDF8');p.text(c.rank,53,t+10,8,true,C.orange);p.text(c.founder_name,78,t+7,8.2,true);p.text(clean(c.company_name,'Undisclosed'),78,t+23,7.4,false,C.muted);p.para(c.founder_state,242,t+8,95,{size:7.2,max:2});p.text(clean(c.scouter_score,'-'),351,t+10,8.2,true);p.text(c.pattern_match_score,388,t+10,9,true,C.orange);p.para(`${clean(c.pattern_branch,'Unclassified')} - ${c.why_now}`,430,t+6,112,{size:6.5,lh:8.2,max:4})})});

  for(let i=0;i<candidates.length;i+=2){p=report.page('Candidate Detail');p.title(`Candidate Detail - ${Math.floor(i/2)+1}/${Math.ceil(candidates.length/2)}`,'Two compact profiles per page where persisted candidate content is short.');candidateCard(p,candidates[i],126);if(candidates[i+1])candidateCard(p,candidates[i+1],456)}

  p=report.page('Excluded Candidates');p.title('Excluded Candidates','Disciplined filtering: candidates without a valid assessment are not promoted.');arr(analysis.excluded_candidates_json).map(rec).forEach((x,i)=>{const t=138+i*106;p.rect(42,t,511,87,C.white,C.line);p.text(val(x,['name']),60,t+14,10,true,C.navy);p.text(val(x,['company']),60,t+35,8.5,false,C.muted);p.text('REASON',248,t+14,7,true,C.muted);p.para(strs(x.reasons).join(' | ')||'No reason persisted',248,t+31,278,{size:8.2,max:3});p.text(`PATTERN SCORE: ${val(x,['pattern_score'],'Not scored')}`,60,t+61,7.5,true,C.orange)});

  p=report.page('Final Scouter Insight');p.title('Final Scouter Insight','The four closing questions for an investment decision.');const questions:[string,string][]=[['What historical pattern is repeating?',val(insight,['repeating_historical_pattern','repeating_pattern'])],['Which market layer is becoming interesting now?',val(insight,['market_layer_becoming_interesting_now'])],['Which founder is the strongest pre-announcement signal?',val(insight,['strongest_pre_announcement_founder_signal'])],['Why should an investor contact them now rather than six months later?',val(insight,['why_contact_now'])]];questions.forEach((x,i)=>p.card(42,130+i*137,511,118,x[0],x[1],[C.peach,C.blue,C.mint,C.lilac][i],6));p.rect(42,705,511,59,C.navy);p.text('SCOUTER THESIS',61,721,7,true,'#BFD0E3');p.para(val(insight,['summary']),61,738,470,{size:9.2,bold:true,color:C.white,max:2});

  const sourceChunks=[] as J[][];for(let i=0;i<sm.sources.length;i+=12)sourceChunks.push(sm.sources.slice(i,i+12));sourceChunks.forEach((chunk,pageNo)=>{p=report.page('Source Appendix');p.title(`Source Appendix ${pageNo+1}/${sourceChunks.length}`,'Compact source index for traceability; URLs are preserved in full.');chunk.forEach((s,i)=>{const n=sm.index.get(clean(s.url))||0,t=126+i*53;p.text(`[${n}]`,44,t+7,7.5,true,C.orange);p.para(val(s,['title'],val(s,['source_type'])),75,t+3,460,{size:7.5,bold:true,max:2});p.para(val(s,['url']),75,t+25,460,{size:6.1,color:C.muted,max:2})})});
  return serialize(report.pages);
}

function serialize(pages:Page[]){const objects:string[]=[];const add=(v:string)=>{objects.push(v);return objects.length};const f1=add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>'),f2=add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>'),pageIds:number[]=[],contentIds:number[]=[];pages.forEach((p,i)=>{if(!p.cover){p.line(42,802,W-42,802,C.line,.6);p.text('Scouter Reference Company Intelligence',42,812,7,false,C.muted);p.text(`${i+1} / ${pages.length}`,W-77,812,7,true,C.muted)}const stream=p.commands.join('\n');contentIds.push(add(`<< /Length ${Buffer.byteLength(stream,'binary')} >>\nstream\n${stream}\nendstream`));pageIds.push(add(''))});const pagesId=add(`<< /Type /Pages /Kids [${pageIds.map(id=>`${id} 0 R`).join(' ')}] /Count ${pageIds.length} >>`);pageIds.forEach((id,i)=>objects[id-1]=`<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 ${W} ${H}] /Resources << /Font << /F1 ${f1} 0 R /F2 ${f2} 0 R >> >> /Contents ${contentIds[i]} 0 R >>`);const catalog=add(`<< /Type /Catalog /Pages ${pagesId} 0 R >>`);let out='%PDF-1.4\n%Scouter\n';const offsets=[0];objects.forEach((o,i)=>{offsets.push(Buffer.byteLength(out,'binary'));out+=`${i+1} 0 obj\n${o}\nendobj\n`});const xref=Buffer.byteLength(out,'binary');out+=`xref\n0 ${objects.length+1}\n0000000000 65535 f \n${offsets.slice(1).map(x=>`${String(x).padStart(10,'0')} 00000 n `).join('\n')}\ntrailer\n<< /Size ${objects.length+1} /Root ${catalog} 0 R >>\nstartxref\n${xref}\n%%EOF`;return new Uint8Array(Buffer.from(out,'binary'))}
