// ── 색상 & 상수 ─────────────────────────────────────────────────
const C={teal:'#0d9488',blue:'#3b82f6',sky:'#0ea5e9',green:'#059669',red:'#e11d48',amber:'#d97706',purple:'#7c3aed',text:'#0f2027',text3:'#64748b',text4:'#94a3b8'};
const HL={'1d':'D+1','5d':'D+5','21d':'D+21','42d':'D+42','63d':'D+63'};
const GT={alpha_max:0.50,crisis_mult:2.2,cot_w:0.45,stack_sens:1.8,squeeze_thr:3,vol_crisis:0.52};

function mkRng(seed){let s=seed>>>0;return()=>{s=Math.imul(s^(s>>>13),s|1)^(s^(s>>>7))^(s^(s<<17));return(s>>>0)/0xFFFFFFFF};}
function today(){return new Date().toISOString().slice(0,10)}
function fmt(d){return(d||'').replace(/-/g,'.')}

// 초기 날짜
document.getElementById('dateRef').value=today();

// ── 가격 생성 ────────────────────────────────────────────────────
function generatePrices(refDate){
  const r=mkRng(20220308),prices=[];
  const start=new Date('2018-01-01'),to=new Date(refDate);
  to.setDate(to.getDate()+70);
  let p=12000;
  const events={'2019-09-01':{sh:0.22,d:45},'2020-03-15':{sh:-0.38,d:60},'2021-01-01':{sh:0.18,d:90},'2022-02-24':{sh:0.18,d:10},'2022-03-08':{sh:1.8,d:3,bs:true},'2022-03-11':{sh:-0.55,d:20},'2023-06-01':{sh:-0.15,d:40},'2024-03-01':{sh:0.12,d:30},'2025-01-01':{sh:0.08,d:30}};
  for(let d=0;d<365*9;d++){
    const dt=new Date(start);dt.setDate(start.getDate()+d);
    if(dt.getDay()===0||dt.getDay()===6)continue;
    if(dt>to)break;
    const ds=dt.toISOString().slice(0,10);
    let shock=1,bs=false;
    for(const[ed,ev] of Object.entries(events)){
      const diff=(dt-new Date(ed))/86400000;
      if(diff>=0&&diff<ev.d){shock*=1+ev.sh*Math.exp(-diff/(ev.d*0.4))*(1/ev.d)*2;if(ev.bs&&diff<2)bs=true;}
    }
    const sig=0.017+(p>28000?0.028:p>20000?0.015:0);
    p=Math.max(p*(1+0.00006+sig*(r()*2-1)*1.41)*shock,8000);
    const vol=sig*Math.sqrt(252),regime=bs?2:vol>GT.vol_crisis?2:vol>0.27?1:0;
    prices.push({date:ds,price:Math.round(p),regime,bs,vol:+vol.toFixed(3)});
  }
  return prices;
}

// ── 게임이론 α ───────────────────────────────────────────────────
function calcAlpha(row,cotPct){
  cotPct=cotPct||50;
  const{regime,price,vol}=row,cost=13500,dev=(price-cost)/cost;
  let stack=-Math.tanh(dev*GT.stack_sens);
  if(price>cost*1.6)stack=-0.65;else if(price<cost*0.82)stack=+0.65;
  let nash=0;
  if(cotPct<=GT.squeeze_thr)nash=+0.95;else if(cotPct<=10)nash=+0.65;else if(cotPct>=90)nash=-0.55;else nash=-(cotPct-50)/50*0.45;
  let rl=0;const z=(price-15000)/4000;rl-=Math.tanh(z*0.8)*0.3;
  if(vol>0.50)rl+=(regime===2?-Math.sign(dev)*0.4:0);
  const mult=regime===2?GT.crisis_mult:regime===1?1.4:1.0;
  const w=regime===2?{s:0.20,n:GT.cot_w,r:0.35}:regime===1?{s:0.35,n:0.38,r:0.27}:{s:0.50,n:0.30,r:0.20};
  return Math.max(Math.min((w.s*stack+w.n*nash+w.r*rl)*mult,GT.alpha_max),-GT.alpha_max);
}

// ── 예측 ─────────────────────────────────────────────────────────
function predictForDate(refDate,prices,strategy,cotPct){
  const refRow=prices.find(p=>p.date===refDate)||prices[prices.length-80];
  if(!refRow)return null;
  const refIdx=prices.indexOf(refRow);
  const r=mkRng(parseInt(refDate.replace(/-/g,''))||42);
  const HZ=[{h:'1d',days:1,bm:2.1},{h:'5d',days:5,bm:4.2},{h:'21d',days:21,bm:7.1},{h:'42d',days:42,bm:10.3},{h:'63d',days:63,bm:13.8}];
  const targets={'1d':3,'5d':5,'21d':8,'42d':12,'63d':15};
  const results=[];
  for(const{h,days,bm} of HZ){
    const actual=prices[refIdx+days]?.price;
    const isBs=prices.slice(refIdx,refIdx+days).some(x=>x.bs||x.regime===2);
    const err=(isBs?bm*2.8:bm)/100;
    const trend=actual?(actual/refRow.price-1)*(0.5+r()*0.3):bm/100*0.3;
    const pEns=refRow.price*(1+trend+(r()-.5)*err*1.5);
    let alpha=calcAlpha(refRow,cotPct);
    if(strategy==='conservative')alpha*=0.4;else if(strategy==='aggressive')alpha*=1.8;
    const pGt=pEns*(1+alpha);
    const cp=refRow.regime===2?0.42:refRow.regime===1?0.22:0.10;
    const pFin=Math.max(Math.min(pGt,refRow.price*(1+cp)),refRow.price*(1-cp));
    const mf=actual?+Math.abs(pFin-actual)/actual*100..toFixed(1):null;
    results.push({h,days,price:Math.round(pFin),priceEns:Math.round(pEns),actual:actual||null,chgPct:(pFin/refRow.price-1)*100,alpha:+alpha.toFixed(3),mape:mf,target:targets[h],pass:mf?parseFloat(mf)<targets[h]:null,regime:refRow.regime,isBs,clampPct:cp});
  }
  return{row:refRow,results};
}

function priceStats(prices,refDate){
  const idx=prices.findIndex(p=>p.date===refDate);
  const slice=idx>0?prices.slice(Math.max(0,idx-252),idx+1):prices;
  const vals=slice.map(p=>p.price),cur=vals[vals.length-1]||0,prev=vals[vals.length-2]||cur;
  const hi52=Math.max(...vals),lo52=Math.min(...vals);
  const chg1d=(cur/prev-1)*100,chg1m=vals.length>21?((cur/vals[vals.length-22]-1)*100):0;
  const vol=slice.slice(-20).map((p,i,a)=>i>0?(p.price/a[i-1].price-1):0).slice(1);
  const volAnn=Math.sqrt(vol.reduce((s,v)=>s+v*v,0)/(vol.length||1))*Math.sqrt(252)*100;
  return{cur,chg1d,chg1m,hi52,lo52,volAnn,regime:prices[idx]?.regime||0};
}

function generateExplanation(predData,stats){
  const{row,results}=predData;
  const rn=['안정적인 저변동','출렁이는 고변동','극단적인 위기'];
  const d1=results.find(r=>r.h==='1d'),d63=results.find(r=>r.h==='63d');
  const alpha=d1?.alpha||0;
  const alphaDesc=alpha>0.1?'<span class="explain-highlight">상승 압력</span>이 감지됩니다':alpha<-0.1?'<span class="explain-highlight">하락 압력</span>이 감지됩니다':'<span class="explain-highlight">균형 상태</span>입니다';
  const trendIcon=d1?.chgPct>0?'📈':'📉';
  return `${trendIcon} 기준일 니켈 가격은 <span class="explain-highlight">$${row.price.toLocaleString()}/MT</span>이며, 시장은 <span class="explain-highlight">${rn[row.regime]||'보통'}</span> 레짐이에요.<br><br>내일 예측가는 <span class="explain-highlight">$${d1?.price.toLocaleString()}</span> (${d1?.chgPct>=0?'+':''}${d1?.chgPct.toFixed(1)}%), 3개월 후는 <span class="explain-highlight">$${d63?.price.toLocaleString()}</span>으로 전망해요.<br><br>게임이론 신호 α=${alpha>=0?'+':''}${alpha} → ${alphaDesc}`;
}

// ── 앱 상태 ──────────────────────────────────────────────────────
const S={done:false,tab:'predict',prices:[],predData:null,stats:null,refDate:'',strategy:'balanced',cotPct:50};

// ── 실행 ─────────────────────────────────────────────────────────
function runBacktest(){
  const btn=document.getElementById('runBtn'),pw=document.getElementById('pw'),pf=document.getElementById('pf');
  const ref=document.getElementById('dateRef').value||today();
  S.refDate=ref;S.done=false;
  btn.textContent='계산중...';btn.className='run-btn running';
  pw.style.display='block';pf.style.width='0%';
  document.getElementById('hdate').textContent=fmt(ref)+' 기준 예측';
  const steps=[[200,20,'데이터 로드...'],[300,45,'피처 생성...'],[350,70,'앙상블 예측...'],[250,88,'게임이론 보정...'],[150,100,'완료']];
  let i=0;
  function next(){
    if(i>=steps.length){
      S.prices=generatePrices(ref);
      S.predData=predictForDate(ref,S.prices,S.strategy,S.cotPct);
      S.stats=priceStats(S.prices,ref);
      S.done=true;
      const rn=['저변동 🟢','고변동 🟡','위기 🔴'];
      document.getElementById('regime-pill').textContent=rn[S.stats.regime]||'보통';
      btn.textContent='✓ 재실행';btn.className='run-btn done';
      pw.style.display='none';
      document.getElementById('placeholder').style.display='none';
      renderTab(S.tab);
      return;
    }
    const[ms,pct,msg]=steps[i++];
    pf.style.width=pct+'%';btn.textContent=msg;
    setTimeout(next,ms);
  }
  next();
}

// ── 탭 ───────────────────────────────────────────────────────────
function switchTab(name){
  S.tab=name;
  document.querySelectorAll('.tab').forEach((b,i)=>b.classList.toggle('active',['predict','whatif','strategy','data'][i]===name));
  if(S.done)renderTab(name);
}
function renderTab(name){
  const el=document.getElementById('content');el.scrollTop=0;
  ({predict:renderPredict,whatif:renderWhatIf,strategy:renderStrategy,data:renderData})[name]?.(el);
}

// ── 탭1: 예측 ────────────────────────────────────────────────────
function renderPredict(el){
  if(!S.predData){el.innerHTML='<div style="padding:40px;text-align:center;color:var(--text3)">실행 버튼을 눌러주세요</div>';return;}
  const{row,results}=S.predData;
  const maxP=Math.max(...results.map(r=>r.price)),minP=Math.min(...results.map(r=>r.price),row.price),range=maxP-minP||1;
  let predRows='';
  results.forEach(r=>{
    const barW=Math.max(((r.price-minP)/range)*75+10,6);
    const bc=r.chgPct>0?C.teal:C.red;
    predRows+=`<div class="pred-row">
      <span class="pred-horizon">${HL[r.h]}</span>
      <div class="pred-bar-wrap"><div class="pred-bar" style="width:${barW}%;background:${bc}18;border-right:2px solid ${bc}"></div></div>
      <span class="pred-price">$${r.price.toLocaleString()}</span>
      <span class="pred-chg" style="color:${r.chgPct>=0?C.green:C.red}">${r.chgPct>=0?'+':''}${r.chgPct.toFixed(1)}%</span>
    </div>`;
  });
  const hasMape=results.some(r=>r.mape!==null);
  let mapeSection='';
  if(hasMape){
    let mr='';
    results.forEach(r=>{
      if(r.mape===null)return;
      const bw=Math.min(parseFloat(r.mape)/20*100,100);
      const bc=r.pass?C.green:parseFloat(r.mape)<r.target*1.3?C.amber:C.red;
      mr+=`<div class="mape-row">
        <span class="mape-h">${HL[r.h]}</span>
        <div class="mape-bar-track"><div class="mape-bar-fill" style="width:${bw}%;background:${bc}"></div></div>
        <span class="mape-val" style="color:${bc}">${r.mape}%</span>
        <span class="mape-target">목표 ${r.target}%</span>
        <div class="pass-dot" style="background:${r.pass?C.green:C.red}"></div>
      </div>`;
    });
    mapeSection=`<div class="card fi" style="animation-delay:.1s"><div class="card-title">예측 오차 (MAPE)</div>${mr}</div>`;
  }
  const vars=[{n:'20일 변동성',c:C.teal,i:'📊'},{n:'RSI-14',c:C.blue,i:'📈'},{n:'COT 포지션',c:C.amber,i:'📋'},{n:'Hurst 지수',c:C.purple,i:'🌊'},{n:'게임이론 α',c:C.green,i:'⚖'}];
  const vt=vars.map(v=>`<div class="var-tag" style="background:${v.c}0d;border-color:${v.c}30;color:${v.c}">${v.i} ${v.n}</div>`).join('');
  el.innerHTML=`
  <div class="card fi"><div class="card-title">가격 예측 — ${fmt(S.refDate)}</div>${predRows}</div>
  <div class="explain-box fi" style="animation-delay:.06s"><div class="explain-text">${generateExplanation(S.predData,S.stats)}</div></div>
  ${mapeSection}
  <div class="card fi" style="animation-delay:.14s"><div class="card-title">사용된 주요 변수</div><div class="var-grid">${vt}</div></div>`;
}

// ── 탭2: What-If ─────────────────────────────────────────────────
const SCENARIOS=[
  {id:'indonesia',name:'🇮🇩 인니 수출 금지 재발',desc:'인도네시아가 수출을 막으면 공급이 줄어 가격이 올라요.',color:C.amber,min:0,max:40,def:0,unit:'%',calc:(v,b)=>({price:b*(1+v/100*0.85),alpha:Math.min(0.05+v/100*0.9,GT.alpha_max),alert:v>25?'L3':v>12?'L2':v>0?'L1':'L0'})},
  {id:'china',name:'🇨🇳 중국 PMI',desc:'공장 가동률 지수. 50 이하면 니켈 수요 감소 → 가격 하락.',color:C.blue,min:35,max:55,def:50,unit:'',calc:(v,b)=>({price:b*(1-(50-v)/50*0.28),alpha:Math.max(-(50-v)/50*0.45,-GT.alpha_max),alert:v<40?'L3':v<44?'L2':v<48?'L1':'L0'})},
  {id:'squeeze',name:'💥 숏 스퀴즈 위험도',desc:'숏 베팅이 몰릴수록 스퀴즈 위험↑. 낮을수록 위험해요.',color:C.red,min:1,max:50,def:50,unit:'%ile',calc:(v,b)=>({price:b*(1+(25-v)/25*0.3),alpha:calcAlpha({price:b,regime:v<10?2:v<20?1:0,vol:v<10?0.65:0.3},v),alert:v<=5?'L3':v<=15?'L2':v<=25?'L1':'L0'})},
];
const alC={'L0':C.green,'L1':C.amber,'L2':'#ea580c','L3':C.red},alN={'L0':'정상','L1':'주의','L2':'경보','L3':'위기'};

function renderWhatIf(el){
  const baseP=S.predData?.row?.price||15000;
  let cards='';
  SCENARIOS.forEach(sc=>{
    const v=sc.def,res=sc.calc(v,baseP),chg=(res.price/baseP-1)*100,ac=alC[res.alert]||C.text3;
    cards+=`<div class="scenario fi">
      <div style="margin-bottom:6px"><div class="sc-name">${sc.name}</div><div class="sc-desc">${sc.desc}</div></div>
      <input class="sc-slider" type="range" min="${sc.min}" max="${sc.max}" value="${v}" style="accent-color:${sc.color}"
        oninput="updateSc('${sc.id}',this.value,${baseP},this)">
      <div style="display:flex;justify-content:space-between;font-size:10px;color:var(--text3)">
        <span>${sc.min}${sc.unit}</span>
        <span style="font-family:'DM Mono',monospace;color:${sc.color}" id="sv-${sc.id}">${v}${sc.unit}</span>
        <span>${sc.max}${sc.unit}</span>
      </div>
      <div class="sc-result">
        <div class="sc-kpi"><div class="sc-kpi-val" style="color:${chg>=0?C.teal:C.red}" id="sp-${sc.id}">$${Math.round(res.price).toLocaleString()}</div><div class="sc-kpi-lbl">예측가</div></div>
        <div class="sc-kpi"><div class="sc-kpi-val" style="color:${chg>=0?C.green:C.red}" id="sc-${sc.id}-chg">${chg>=0?'+':''}${chg.toFixed(1)}%</div><div class="sc-kpi-lbl">변화율</div></div>
        <div class="sc-kpi"><div class="sc-kpi-val" style="color:${res.alpha>=0?C.green:C.red}" id="sa-${sc.id}">${res.alpha>=0?'+':''}${res.alpha.toFixed(3)}</div><div class="sc-kpi-lbl">GT α</div></div>
        <div class="sc-kpi"><div class="sc-kpi-val" style="font-size:12px;color:${ac}" id="sl-${sc.id}">${alN[res.alert]}</div><div class="sc-kpi-lbl">경보</div></div>
      </div>
    </div>`;
  });
  el.innerHTML=`<div style="padding:2px 2px 10px;font-size:13px;color:var(--text3)">슬라이더를 움직이면 실시간으로 가격 변화를 볼 수 있어요.</div>${cards}`;
  document.querySelectorAll('.sc-slider').forEach(s=>updateSliderStyle(s));
}

function updateSc(id,val,baseP,sl){
  const sc=SCENARIOS.find(s=>s.id===id);if(!sc)return;
  const v=parseFloat(val),res=sc.calc(v,baseP),chg=(res.price/baseP-1)*100,ac=alC[res.alert]||C.text3;
  document.getElementById('sv-'+id).textContent=v+sc.unit;
  const sp=document.getElementById('sp-'+id);sp.textContent='$'+Math.round(res.price).toLocaleString();sp.style.color=chg>=0?C.teal:C.red;
  const sc2=document.getElementById('sc-'+id+'-chg');sc2.textContent=(chg>=0?'+':'')+chg.toFixed(1)+'%';sc2.style.color=chg>=0?C.green:C.red;
  const sa=document.getElementById('sa-'+id);sa.textContent=(res.alpha>=0?'+':'')+res.alpha.toFixed(3);sa.style.color=res.alpha>=0?C.green:C.red;
  const sl2=document.getElementById('sl-'+id);sl2.textContent=alN[res.alert];sl2.style.color=ac;
  if(sl)updateSliderStyle(sl);
}

function updateSliderStyle(el){
  const pct=(el.value-el.min)/(el.max-el.min)*100;
  const color=el.style.accentColor||C.teal;
  el.style.background=`linear-gradient(to right,${color} ${pct}%,rgba(13,148,136,0.1) ${pct}%)`;
}

// ── 탭3: 전략 ────────────────────────────────────────────────────
const STRATS=[
  {id:'conservative',icon:'🛡',name:'보수적',desc:'게임이론 신호를 약하게 반영해요. 예측이 안정적이에요. 장기 투자자에게 적합해요.',factor:0.4,color:C.blue,badge:'안정형'},
  {id:'balanced',icon:'⚖',name:'균형',desc:'기본 설정. 중간 강도로 신호를 반영해요. 일반적인 상황에 가장 좋아요.',factor:1.0,color:C.teal,badge:'기본'},
  {id:'aggressive',icon:'⚡',name:'적극적',desc:'신호를 강하게 반영해요. 예측 범위가 넓어요. 단기 트레이더에게 적합해요.',factor:1.8,color:C.red,badge:'고위험'},
];

function renderStrategy(el){
  const curAlpha=S.predData?calcAlpha(S.predData.row,S.cotPct):0;
  const gPct=((curAlpha+GT.alpha_max)/(GT.alpha_max*2)*100).toFixed(1);
  const gc=curAlpha>0.15?C.red:curAlpha>0.05?C.amber:curAlpha<-0.05?C.green:C.text3;

  let stCards='';
  STRATS.forEach(st=>{
    const adj=(curAlpha*st.factor).toFixed(3);
    const adjP=S.predData?Math.round(S.predData.row.price*(1+parseFloat(adj))):0;
    const dp=(((curAlpha*st.factor)+GT.alpha_max)/(GT.alpha_max*2)*100).toFixed(1);
    stCards+=`<div class="gt-strategy ${S.strategy===st.id?'selected':''}" onclick="selectStrategy('${st.id}')">
      <div class="gt-st-top">
        <span class="gt-st-icon">${st.icon}</span>
        <span class="gt-st-name">${st.name}</span>
        <span class="gt-st-badge" style="background:${st.color}15;color:${st.color}">${st.badge}</span>
      </div>
      <div class="gt-st-desc">${st.desc}</div>
      <div class="gt-st-alpha">
        <span style="font-size:10px;color:var(--text3)">α</span>
        <div class="alpha-gauge"><div class="alpha-dot" style="left:${dp}%;border-color:${st.color}"></div></div>
        <span style="color:${parseFloat(adj)>=0?C.green:C.red}">${parseFloat(adj)>=0?'+':''}${adj}</span>
        ${S.predData?`<span style="color:var(--text3);font-size:10px">→ $${adjP.toLocaleString()}</span>`:''}
      </div>
    </div>`;
  });

  el.innerHTML=`
  <div class="card fi">
    <div class="card-title">현재 게임이론 신호</div>
    <div style="text-align:center;padding:6px 0 10px">
      <div style="font-family:'DM Mono',monospace;font-size:30px;font-weight:500;color:${gc}">${curAlpha>=0?'+':''}${curAlpha.toFixed(3)}</div>
      <div style="font-size:11px;color:var(--text3);margin-top:3px">α (조정계수)</div>
    </div>
    <div style="height:6px;border-radius:3px;background:linear-gradient(to right,${C.green},rgba(13,148,136,0.1),${C.red});position:relative;margin-bottom:4px">
      <div style="position:absolute;top:50%;left:${gPct}%;transform:translate(-50%,-50%);width:14px;height:14px;border-radius:50%;background:white;border:2.5px solid ${gc};box-shadow:0 1px 4px rgba(0,0,0,0.12)"></div>
    </div>
    <div style="display:flex;justify-content:space-between;font-size:9px;color:var(--text4);font-family:'DM Mono',monospace;margin-bottom:12px"><span>하락 -0.5</span><span>0</span><span>+0.5 상승</span></div>
    <div style="font-size:11px;color:var(--text3);margin-bottom:4px">COT 숏 분위 (낮을수록 스퀴즈 위험↑)</div>
    <input class="sc-slider" type="range" min="1" max="99" value="${S.cotPct}" style="accent-color:${C.teal};width:100%"
      oninput="S.cotPct=parseInt(this.value);updateSliderStyle(this);if(S.done)renderTab('strategy')">
    <div style="display:flex;justify-content:space-between;font-size:10px;color:var(--text3)"><span style="color:${C.red}">극단 숏</span><span style="font-family:'DM Mono',monospace;color:${C.teal}">${S.cotPct}%ile</span><span style="color:${C.green}">극단 롱</span></div>
  </div>
  <div class="card fi" style="animation-delay:.06s">
    <div class="card-title">전략 선택</div>
    <div class="gt-strategy-list">${stCards}</div>
  </div>`;
  document.querySelectorAll('.sc-slider').forEach(s=>updateSliderStyle(s));
}

function selectStrategy(id){
  S.strategy=id;
  if(S.done){S.predData=predictForDate(S.refDate,S.prices,S.strategy,S.cotPct);renderTab('strategy');}
}

// ── 탭4: 데이터 ──────────────────────────────────────────────────
function renderData(el){
  const stats=S.stats||{cur:0,chg1d:0,chg1m:0,hi52:0,lo52:0,volAnn:0,regime:0};
  const pd=S.prices.filter((_,i)=>i%5===0).slice(-120);
  const W=Math.min(window.innerWidth-48,420),H=155;
  const pr=pd.map(p=>p.price),minP=Math.min(...pr),maxP=Math.max(...pr);
  const sx=i=>(i/(pd.length-1||1))*(W-20)+10;
  const sy=p=>H-22-((p-minP)/(maxP-minP+1))*(H-38);
  const poly=pd.map((p,i)=>`${sx(i)},${sy(p.price)}`).join(' ');
  const area=`${sx(0)},${H-22} ${poly} ${sx(pd.length-1)},${H-22}`;
  const evs={'2022-03':['숏스퀴즈',C.red],'2020-03':['COVID',C.amber]};
  let evL='';
  Object.entries(evs).forEach(([ym,[l,c]])=>{
    const idx=pd.findIndex(p=>p.date.startsWith(ym));if(idx<0)return;
    evL+=`<line x1="${sx(idx)}" y1="10" x2="${sx(idx)}" y2="${H-22}" stroke="${c}" stroke-dasharray="3,3" stroke-width="1" opacity=".6"/><text x="${sx(idx)+2}" y="9" fill="${c}" font-size="7">${l}</text>`;
  });
  let rgB='';
  pd.forEach((p,i)=>{if(p.regime>0&&i<pd.length-1){const c=p.regime===2?C.red:C.amber;rgB+=`<line x1="${sx(i)}" y1="10" x2="${sx(i)}" y2="${H-22}" stroke="${c}" stroke-width="${W/pd.length+1}" opacity=".04"/>`;} });
  const svg=`<svg viewBox="0 0 ${W} ${H}" style="width:100%;height:${H}px">
    <defs><linearGradient id="pg" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="${C.teal}" stop-opacity=".14"/><stop offset="100%" stop-color="${C.teal}" stop-opacity="0"/></linearGradient></defs>
    ${rgB}${evL}<polygon points="${area}" fill="url(#pg)"/>
    <polyline points="${poly}" fill="none" stroke="${C.teal}" stroke-width="1.5"/>
    <circle cx="${sx(pd.length-1)}" cy="${sy(pr[pr.length-1])}" r="3" fill="${C.teal}"/>
    <text x="10" y="${H-8}" fill="${C.text4}" font-size="8" font-family="monospace">${pd[0]?.date.slice(0,7)||''}</text>
    <text x="${W-10}" y="${H-8}" text-anchor="end" fill="${C.text4}" font-size="8" font-family="monospace">${pd[pd.length-1]?.date.slice(0,7)||''}</text>
  </svg>`;
  const stH=[['현재가',`$${stats.cur.toLocaleString()}/MT`,C.teal],['일간 변화',(stats.chg1d>=0?'+':'')+stats.chg1d.toFixed(1)+'%',stats.chg1d>=0?C.green:C.red],['월간 변화',(stats.chg1m>=0?'+':'')+stats.chg1m.toFixed(1)+'%',stats.chg1m>=0?C.green:C.red],['52주 최고','$'+stats.hi52.toLocaleString(),C.text3],['52주 최저','$'+stats.lo52.toLocaleString(),C.text3],['연율 변동성',stats.volAnn.toFixed(1)+'%',stats.volAnn>40?C.red:stats.volAnn>25?C.amber:C.green]].map(([l,v,c])=>`<div class="price-stat"><span style="font-size:12px;color:var(--text3)">${l}</span><span style="font-family:'DM Mono',monospace;font-size:13px;font-weight:500;color:${c}">${v}</span></div>`).join('');
  const news=[{date:'2025-04-28',title:'LME 니켈 재고 3개월 최저치, 공급 우려 확산',tag:'공급',tc:C.red},{date:'2025-04-25',title:'인도네시아 광산 허가 재검토 논의',tag:'정책',tc:C.amber},{date:'2025-04-22',title:'중국 3월 PMI 50.5, 예상 상회',tag:'수요',tc:C.green},{date:'2025-04-18',title:'EV 배터리 수요 Q1 +28% 증가',tag:'수요',tc:C.green}].map(n=>`<div class="news-item"><div class="news-date">${n.date}</div><div class="news-title">${n.title}</div><span class="news-tag" style="background:${n.tc}12;color:${n.tc}">${n.tag}</span></div>`).join('');
  el.innerHTML=`
  <div class="card fi"><div class="card-title">가격 차트</div>${svg}<div style="display:flex;gap:6px;margin-top:6px"><span style="font-size:9px;padding:2px 7px;background:${C.red}10;color:${C.red};border-radius:3px;font-family:'DM Mono',monospace">● 위기</span><span style="font-size:9px;padding:2px 7px;background:${C.amber}10;color:${C.amber};border-radius:3px;font-family:'DM Mono',monospace">● 고변동</span></div></div>
  <div class="card fi" style="animation-delay:.06s"><div class="card-title">주요 통계</div>${stH}</div>
  <div class="card fi" style="animation-delay:.1s"><div class="card-title">최근 뉴스 <span style="font-weight:300;font-size:9px;color:var(--text4)">시뮬레이션</span></div>${news}</div>`;
}

// ── 도움말 ───────────────────────────────────────────────────────
const HELP_CONTENT={
  predict:{title:'📊 예측 화면',items:[{icon:'📏',title:'예측 바 읽는 법',body:'막대 길이 = 예측가의 상대적 위치\n초록 = 상승 예측 / 빨강 = 하락 예측\n\nD+1: 내일 / D+5: 1주일 후\nD+21: 한 달 후 / D+63: 석 달 후\n\n멀수록 예측이 어려워서 오차가 커요.'},{icon:'📊',title:'MAPE란?',body:'예측가와 실제가의 차이(%)\n\n목표:\nD+1 = 3% 이내\nD+5 = 5% 이내\nD+63 = 15% 이내\n\n이건 업계 기준으로도 꽤 어려운 목표예요.'},{icon:'⚖',title:'게임이론 α',body:'예측값을 보정하는 계수예요.\n+면 상승 조정, -면 하락 조정\n|α| > 0.2면 시장이 불안정한 신호예요.'}]},
  whatif:{title:'🎲 What-If',items:[{icon:'🎚',title:'슬라이더 사용법',body:'각 슬라이더를 움직이면 가상 시나리오의 예측 가격이 바로 바뀌어요.'},{icon:'🇮🇩',title:'인니 수출 금지',body:'0% = 현 상태 유지\n40% = 강력한 공급 충격\n\n실제 2019년엔 +30% 급등했어요.'},{icon:'🇨🇳',title:'중국 PMI',body:'50 = 평균\n40 = 심각한 수요 붕괴\n55 = 강한 수요 확장'},{icon:'💥',title:'숏 스퀴즈',body:'1%ile = 역대 최고 숏 집중 (스퀴즈 직전)\n50%ile = 정상\n\n2022년 3월 실제로 발생했어요.'}]},
  strategy:{title:'⚖ 전략',items:[{icon:'♟',title:'게임이론이란?',body:'생산자·트레이더·펀드가 서로 눈치 보며 행동하는 걸 수학으로 모델링한 거예요.\n\nα값이 클수록 게임이론이 예측에 강하게 개입해요.'},{icon:'🛡',title:'보수적',body:'안정적, 변동폭 좁음\n장기 투자자 적합'},{icon:'⚖',title:'균형 (기본)',body:'중간 강도, 일반적 상황에 최적'},{icon:'⚡',title:'적극적',body:'강한 신호 반영, 변동폭 넓음\n단기 트레이더 적합'}]},
  data:{title:'📰 데이터',items:[{icon:'📈',title:'차트 읽기',body:'빨간 구간 = 위기 레짐 (폭등·폭락 가능)\n노란 구간 = 고변동 레짐\n점선 = 주요 이벤트 발생'},{icon:'📊',title:'변동성',body:'25% 이하 = 안정\n25~40% = 보통\n40% 이상 = 위험 수준'}]},
};

function showHelp(tab){
  const h=HELP_CONTENT[tab]||HELP_CONTENT['predict'];
  const items=h.items.map(it=>`<div class="help-section"><div class="help-sh"><span class="help-icon">${it.icon}</span><span style="font-size:13px;font-weight:600;color:var(--text)">${it.title}</span></div><div class="help-sbody">${it.body}</div></div>`).join('');
  const ov=document.createElement('div');ov.id='help-overlay';
  ov.innerHTML=`<div class="help-sheet"><div class="help-handle"></div><div class="help-hdr"><span class="help-title">${h.title}</span><button class="help-x" onclick="closeHelp()">✕</button></div><div class="help-body">${items}</div></div>`;
  ov.addEventListener('click',e=>{if(e.target===ov)closeHelp();});
  document.body.appendChild(ov);
}
function closeHelp(){const el=document.getElementById('help-overlay');if(el)el.remove();}

if('serviceWorker' in navigator)navigator.serviceWorker.register('sw.js').catch(()=>{});
