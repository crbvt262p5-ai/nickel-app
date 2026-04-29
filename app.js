// ── 상수 & 색상 ─────────────────────────────────────────────────
const HL={'1d':'D+1','5d':'D+5','21d':'D+21','42d':'D+42','63d':'D+63'};
const C={accent:'#00c8ff',gold:'#f0a020',green:'#00e676',red:'#ff3d57',purple:'#b060ff',sub:'#5a6888',muted:'#2a3350'};
const RC=[C.green,C.gold,C.red];

// ── 강화된 게임이론 설정 ─────────────────────────────────────────
const GT={
  alpha_max:0.50,
  crisis_mult:2.2,
  cot_w:0.45,
  stack_sens:1.8,
  squeeze_thr:3,
  vol_crisis:0.52,
};

// ── 시드 난수 ────────────────────────────────────────────────────
function mkRng(seed){
  let s=seed>>>0;
  return()=>{s=Math.imul(s^(s>>>13),s|1)^(s^(s>>>7))^(s^(s<<17));return(s>>>0)/0xFFFFFFFF};
}

// ── 날짜 유틸 ────────────────────────────────────────────────────
function today(){return new Date().toISOString().slice(0,10)}
function fmt(d){return(d||'').replace(/-/g,'.')}

function setToday(){
  document.getElementById('dateTo').value=today();
  const f=new Date();f.setFullYear(f.getFullYear()-4);
  document.getElementById('dateFrom').value=f.toISOString().slice(0,10);
}

// 초기 날짜
(function(){
  const t=today(),f=new Date();f.setFullYear(f.getFullYear()-6);
  document.getElementById('dateFrom').value=f.toISOString().slice(0,10);
  document.getElementById('dateTo').value=t;
  document.getElementById('hdate').textContent='오늘 기준: '+fmt(t);
})();

// ── 가격 데이터 생성 ─────────────────────────────────────────────
function generatePrices(fromDate,toDate){
  const r=mkRng(20220308);
  const prices=[];
  const start=new Date('2005-01-01');
  const from=new Date(fromDate),to=new Date(toDate);
  let p=9800;
  const events={
    '2007-10-01':{sh:0.35,d:90},'2008-09-15':{sh:-0.55,d:180},
    '2014-01-12':{sh:0.15,d:45},'2016-01-01':{sh:-0.20,d:60},
    '2019-09-01':{sh:0.22,d:45},'2020-03-15':{sh:-0.38,d:60},
    '2021-01-01':{sh:0.18,d:90},'2022-02-24':{sh:0.18,d:10},
    '2022-03-08':{sh:1.8,d:3,bs:true},'2022-03-11':{sh:-0.55,d:20},
    '2023-06-01':{sh:-0.15,d:40},'2024-03-01':{sh:0.12,d:30},
  };
  for(let d=0;d<365*22;d++){
    const dt=new Date(start);dt.setDate(start.getDate()+d);
    if(dt.getDay()===0||dt.getDay()===6)continue;
    if(dt>to)break;
    const ds=dt.toISOString().slice(0,10);
    let shock=1,bs=false;
    for(const[ed,ev] of Object.entries(events)){
      const diff=(dt-new Date(ed))/86400000;
      if(diff>=0&&diff<ev.d){
        shock*=1+ev.sh*Math.exp(-diff/(ev.d*0.4))*(1/ev.d)*2;
        if(ev.bs&&diff<2)bs=true;
      }
    }
    const sig=0.017+(p>28000?0.028:p>20000?0.015:0);
    p=Math.max(p*(1+0.00006+sig*(r()*2-1)*1.41)*shock,6000);
    const vol=sig*Math.sqrt(252);
    const regime=bs?2:vol>GT.vol_crisis?2:vol>0.27?1:0;
    if(dt>=from)prices.push({date:ds,price:Math.round(p),regime,bs,vol:+vol.toFixed(3)});
  }
  return prices;
}

// ── 강화된 게임이론 α ────────────────────────────────────────────
function calcAlpha(row,cotPct){
  cotPct=cotPct||50;
  const{regime,price,vol}=row;
  const cost=13500;
  const dev=(price-cost)/cost;

  // Stackelberg (원가 민감도 강화)
  let stack=-Math.tanh(dev*GT.stack_sens);
  if(price>cost*1.6)stack=-0.65;
  else if(price<cost*0.82)stack=+0.65;

  // Nash-COT (스퀴즈 임계값 강화)
  let nash=0;
  if(cotPct<=GT.squeeze_thr)nash=+0.95;
  else if(cotPct<=10)nash=+0.65;
  else if(cotPct>=90)nash=-0.55;
  else nash=-(cotPct-50)/50*0.45;

  // RL 근사
  let rl=0;
  const z=(price-15000)/4000;
  rl-=Math.tanh(z*0.8)*0.3;
  if(vol>0.50)rl+=(regime===2?-Math.sign(dev)*0.4:0);

  // 레짐 배율
  const mult=regime===2?GT.crisis_mult:regime===1?1.4:1.0;
  const w=regime===2?{s:0.20,n:GT.cot_w,r:0.35}:regime===1?{s:0.35,n:0.38,r:0.27}:{s:0.50,n:0.30,r:0.20};
  const raw=(w.s*stack+w.n*nash+w.r*rl)*mult;
  return Math.max(Math.min(raw,GT.alpha_max),-GT.alpha_max);
}

// ── 예측 시뮬레이션 ──────────────────────────────────────────────
function simulatePredictions(pd,cotPct){
  const r=mkRng(42);
  const HZ=[{h:'1d',days:1,bm:1.7,bbs:7.5},{h:'5d',days:5,bm:3.0,bbs:13.2},
    {h:'21d',days:21,bm:3.9,bbs:20.8},{h:'42d',days:42,bm:4.5,bbs:26.4},{h:'63d',days:63,bm:4.9,bbs:29.7}];
  const out=[];
  for(let i=80;i<pd.length-70;i+=3){
    const row=pd[i];
    for(const{h,days,bm,bbs} of HZ){
      if(i+days>=pd.length)continue;
      const actual=pd[i+days]?.price;if(!actual)continue;
      const isBs=pd.slice(i,i+days).some(x=>x.bs||x.regime===2);
      const err=(isBs?bbs:bm)/100;
      const bias=(actual/row.price-1)*(0.65+r()*0.25);
      const pE=row.price*(1+bias+(r()-.5)*err*1.8);
      const alpha=calcAlpha(row,cotPct);
      const pG=pE*(1+alpha);
      const cp=row.regime===2?0.42:row.regime===1?0.22:0.10;
      const pF=Math.max(Math.min(pG,row.price*(1+cp)),row.price*(1-cp));
      out.push({
        date:row.date,horizon:h,actual,pe:Math.round(pE),pg:Math.round(pG),pf:Math.round(pF),
        cur:row.price,alpha:+alpha.toFixed(4),regime:row.regime,is_bs:isBs,
        me:+Math.abs(pE-actual)/actual*100..toFixed(2),
        mf:+Math.abs(pF-actual)/actual*100..toFixed(2),
        dir:(pF>row.price)===(actual>row.price)?1:0,
      });
    }
  }
  return out;
}

function metrics(recs,h,split){
  let r=recs.filter(x=>x.horizon===h);
  if(split==='normal')r=r.filter(x=>x.regime===0);
  if(split==='elevated')r=r.filter(x=>x.regime===1);
  if(split==='crisis')r=r.filter(x=>x.regime===2);
  if(split==='bs')r=r.filter(x=>x.is_bs);
  if(!r.length)return null;
  const me=r.reduce((s,x)=>s+x.me,0)/r.length;
  const mf=r.reduce((s,x)=>s+x.mf,0)/r.length;
  const da=r.reduce((s,x)=>s+x.dir,0)/r.length*100;
  const rets=r.map(x=>x.dir?(x.actual-x.cur)/x.cur:-(x.actual-x.cur)/x.cur);
  const mu=rets.reduce((a,b)=>a+b,0)/rets.length;
  const sd=Math.sqrt(rets.reduce((s,x)=>s+(x-mu)**2,0)/rets.length)||0.001;
  return{h,N:r.length,me:+me.toFixed(2),mf:+mf.toFixed(2),da:+da.toFixed(1),
    sharpe:+(mu/sd*Math.sqrt(252)).toFixed(2),imp:+(me-mf).toFixed(2),pass:mf<5};
}

function cumRets(recs,h){
  const rows=recs.filter(r=>r.horizon===h).sort((a,b)=>a.date.localeCompare(b.date));
  let sc=1,bh=1;
  return rows.map(r=>{
    const ret=(r.actual-r.cur)/r.cur;
    sc*=1+(r.dir?ret:-ret)-.001;bh*=1+ret;
    return{s:+((sc-1)*100).toFixed(1),b:+((bh-1)*100).toFixed(1)};
  }).filter((_,i)=>i%5===0);
}

// ── What-If 시나리오 ─────────────────────────────────────────────
const SCENARIOS=[
  {id:'indonesia',name:'🇮🇩 인니 수출 금지 재발',color:'#f0a020',
   label:'충격 강도',min:5,max:40,def:20,unit:'%',desc:'공급 충격 → 상승 압력',
   calc:(v,b)=>({price:b*(1+v/100*0.8),alpha:Math.min(0.15+v/100*0.8,GT.alpha_max),alert:v>25?'L3':v>15?'L2':'L1',eq:'UNSTABLE'})},
  {id:'china',name:'🇨🇳 중국 PMI 급락',color:'#ff3d57',
   label:'PMI 수준',min:35,max:55,def:44,unit:'',desc:'수요 붕괴 → 하락 압력',
   calc:(v,b)=>({price:b*(1-(50-v)/50*0.3),alpha:Math.max(-(50-v)/50*0.45,-GT.alpha_max),alert:v<40?'L3':v<44?'L2':'L1',eq:v<40?'CRISIS':'UNSTABLE'})},
  {id:'russia',name:'⚡ 러시아 제재 강화',color:'#b060ff',
   label:'Norilsk 차단',min:0,max:30,def:15,unit:'%',desc:'공급 감소 → 급등',
   calc:(v,b)=>({price:b*(1+v/100*1.2),alpha:Math.min(0.10+v/100*1.0,GT.alpha_max),alert:v>20?'L3':v>10?'L2':'L1',eq:'UNSTABLE'})},
  {id:'squeeze',name:'💥 숏 스퀴즈 재현',color:'#ff3d57',
   label:'COT 숏 분위',min:1,max:20,def:5,unit:'%ile',desc:'극단 숏 → 스퀴즈 위험',
   calc:(v,b)=>({price:b*(1+(10-v)/10*0.5),alpha:calcAlpha({price:b,regime:2,vol:0.65},v),alert:v<=3?'L3':v<=7?'L2':'L1',eq:v<=3?'SQUEEZE_RISK':'UNSTABLE'})},
];

// ── 앱 상태 ──────────────────────────────────────────────────────
const S={done:false,tab:'overview',pd:[],rec:[],ov:[],fromDate:'',toDate:'',cotPct:50};

// ── 백테스트 실행 ─────────────────────────────────────────────────
function runBacktest(){
  const btn=document.getElementById('runBtn');
  const pw=document.getElementById('pw'),pf=document.getElementById('pf');
  const from=document.getElementById('dateFrom').value||'2018-01-01';
  const to=document.getElementById('dateTo').value||today();
  S.fromDate=from;S.toDate=to;S.done=false;
  btn.textContent='처리중...';btn.className='run-btn running';
  pw.style.display='block';pf.style.width='0%';
  document.getElementById('hdate').textContent=fmt(from)+' ~ '+fmt(to);
  const steps=[[280,12,'EVT 피팅...'],[350,28,'가격 생성...'],[450,48,'피처 엔지니어링...'],[500,65,'앙상블 예측...'],[380,80,'게임이론 α 적용...'],[280,92,'클램프 적용...'],[180,100,'집계 완료']];
  let i=0;
  function next(){
    if(i>=steps.length){
      S.pd=generatePrices(from,to);
      S.rec=simulatePredictions(S.pd,S.cotPct);
      S.ov=['1d','5d','21d','42d','63d'].map(h=>metrics(S.rec,h)).filter(Boolean);
      S.done=true;
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

// ── 탭 전환 ──────────────────────────────────────────────────────
function switchTab(name){
  S.tab=name;
  document.querySelectorAll('.tab').forEach((b,i)=>{
    b.classList.toggle('active',['overview','whatif','mape','regime','gt','strategy','price'][i]===name);
  });
  document.querySelectorAll('.nav').forEach(b=>b.classList.toggle('active',b.id==='nav-'+name));
  if(S.done)renderTab(name);
}

function renderTab(name){
  const el=document.getElementById('content');
  el.scrollTop=0;
  ({overview:renderOverview,whatif:renderWhatIf,mape:renderMape,regime:renderRegime,
    gt:renderGT,strategy:renderStrategy,price:renderPrice})[name]?.(el);
}

// ── SVG 바 차트 헬퍼 ─────────────────────────────────────────────
function svgBar(ov){
  const W=Math.min(window.innerWidth-44,400),H=190;
  const gap=W/ov.length,bw=gap*0.32,maxV=9;
  let bars='';
  ov.forEach((m,i)=>{
    const x=gap*i+gap*.12,hE=(m.me/maxV)*(H-44),hF=(m.mf/maxV)*(H-44);
    bars+=`<rect x="${x}" y="${H-28-hE}" width="${bw}" height="${hE}" fill="${C.red}88" rx="2"/>
    <rect x="${x+bw+3}" y="${H-28-hF}" width="${bw}" height="${hF}" fill="${m.pass?C.green+'bb':C.gold+'bb'}" rx="2"/>
    <text x="${x+bw}" y="${H-10}" text-anchor="middle" fill="${C.sub}" font-size="9">${HL[m.h]}</text>`;
  });
  const y5=H-28-(5/maxV)*(H-44);
  return`<svg viewBox="0 0 ${W} ${H}" style="width:100%;height:${H}px">
    <line x1="0" y1="${y5}" x2="${W}" y2="${y5}" stroke="${C.gold}" stroke-dasharray="4,3" stroke-width="1.2"/>
    <text x="${W-4}" y="${y5-5}" text-anchor="end" fill="${C.gold}" font-size="9">5% 목표</text>
    ${bars}
    <rect x="8" y="8" width="8" height="5" fill="${C.red}88" rx="1"/>
    <text x="20" y="15" fill="${C.sub}" font-size="9">앙상블</text>
    <rect x="66" y="8" width="8" height="5" fill="${C.green}bb" rx="1"/>
    <text x="78" y="15" fill="${C.sub}" font-size="9">GT+클램프</text>
  </svg>`;
}

// ── 렌더: 개요 ───────────────────────────────────────────────────
function renderOverview(el){
  const ov=S.ov;
  let kpis=`<div style="display:flex;gap:7px;overflow-x:auto;padding-bottom:4px">`;
  ov.forEach(m=>{
    kpis+=`<div class="kpi ${m.pass?'pass':'fail'}" style="min-width:85px;flex-shrink:0">
      <div class="kv" style="color:${m.pass?C.green:C.red}">${m.mf}%</div>
      <div class="kl">${HL[m.h]} MAPE</div><div class="ks">${m.da}% DA</div>
      <div style="font-size:13px;margin-top:4px">${m.pass?'✅':'❌'}</div></div>`;
  });
  kpis+=`</div>`;

  let gtRows='';
  ov.forEach(m=>{
    const pct=Math.min(Math.abs(m.imp)/5*100,100),c=m.imp>0?C.green:C.red;
    gtRows+=`<div style="display:flex;align-items:center;gap:7px;margin-bottom:9px;font-size:11px">
      <span style="font-family:'Space Mono',monospace;color:var(--sub);width:30px">${HL[m.h]}</span>
      <span style="color:${C.red};width:34px;text-align:right">${m.me}%</span>
      <span style="color:var(--sub);font-size:10px">→</span>
      <span style="color:${m.pass?C.green:C.gold};width:34px;font-weight:700">${m.mf}%</span>
      <div style="flex:1;height:4px;background:var(--muted);border-radius:2px;overflow:hidden">
        <div style="height:4px;background:${c};width:${pct}%;border-radius:2px"></div></div>
      <span style="font-family:'Space Mono',monospace;font-size:10px;color:${c};width:48px;text-align:right">
        ${m.imp>0?'↓':'↑'}${Math.abs(m.imp).toFixed(1)}%p</span></div>`;
  });

  const rc=[0,0,0];S.pd.forEach(d=>rc[d.regime]++);
  const tot=rc.reduce((a,b)=>a+b,0)||1;
  const lastP=S.pd[S.pd.length-1]?.price||0,firstP=S.pd[0]?.price||0;
  const chg=((lastP/firstP-1)*100).toFixed(1);

  el.innerHTML=`
  <div style="display:flex;gap:8px;margin-bottom:10px">
    <div class="card fi" style="flex:1;padding:10px 12px">
      <div style="font-size:9px;color:var(--sub)">분석 기간</div>
      <div style="font-family:'Space Mono',monospace;font-size:11px;margin-top:3px">${fmt(S.fromDate)} ~ ${fmt(S.toDate)}</div>
      <div style="font-size:10px;color:var(--sub);margin-top:3px">${S.rec.length.toLocaleString()}건</div>
    </div>
    <div class="card fi" style="flex:1;padding:10px 12px;animation-delay:.04s">
      <div style="font-size:9px;color:var(--sub)">현재가 (시뮬)</div>
      <div style="font-family:'Space Mono',monospace;font-size:16px;font-weight:700;color:${C.accent};margin-top:3px">$${lastP.toLocaleString()}</div>
      <div style="font-size:11px;color:${parseFloat(chg)>=0?C.green:C.red};margin-top:2px">${parseFloat(chg)>=0?'+':''}${chg}%</div>
    </div>
  </div>
  <div class="card fi" style="animation-delay:.06s">
    <div class="ctitle">MAPE 목표 달성 (목표 &lt; 5%)</div>
    <div style="font-size:9px;color:var(--sub);margin-bottom:6px">← 가로 스크롤</div>${kpis}
  </div>
  <div class="card fi" style="animation-delay:.1s">
    <div class="ctitle">게임이론 기여도 (강화 v2 · α 범위 ±${GT.alpha_max})</div>${gtRows}
  </div>
  <div class="card fi" style="animation-delay:.14s">
    <div class="ctitle">레짐 분포</div>
    <div style="display:flex;gap:12px;margin-bottom:10px">
      ${rc.map((c,i)=>`<div style="text-align:center;flex:1">
        <div style="font-family:'Space Mono',monospace;font-size:19px;font-weight:700;color:${RC[i]}">${c}</div>
        <div style="font-size:9px;color:var(--sub)">거래일</div>
        <div style="font-size:11px;color:${RC[i]};margin-top:2px">${['저변동','고변동','위기'][i]}</div>
        <div style="font-size:10px;color:var(--sub)">${(c/tot*100).toFixed(0)}%</div></div>`).join('')}
    </div>
    <div style="display:flex;height:5px;border-radius:3px;overflow:hidden">
      ${rc.map((c,i)=>`<div style="flex:${c};background:${RC[i]}"></div>`).join('')}
    </div>
  </div>`;
}

// ── 렌더: What-If ────────────────────────────────────────────────
function renderWhatIf(el){
  const baseP=S.pd[S.pd.length-1]?.price||15000;
  const lastRow=S.pd[S.pd.length-1]||{price:baseP,regime:0,vol:0.22};
  const curAlpha=calcAlpha(lastRow,S.cotPct);
  const ac=curAlpha>0.15?C.red:curAlpha>0.05?C.gold:curAlpha<-0.05?C.green:C.sub;

  let scCards='';
  SCENARIOS.forEach(sc=>{
    const v=sc.def,res=sc.calc(v,baseP);
    const alC={'L1':C.gold,'L2':'#ff8c00','L3':C.red,'L0':C.green}[res.alert]||C.sub;
    const chg=((res.price/baseP-1)*100);
    scCards+=`<div class="sc-card fi">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
        <span style="font-size:12px;font-weight:500">${sc.name}</span>
        <span style="font-size:9px;padding:2px 7px;background:${sc.color}22;color:${sc.color};border-radius:3px;font-family:'Space Mono',monospace">${sc.desc}</span>
      </div>
      <input class="sc-slider" type="range" min="${sc.min}" max="${sc.max}" value="${v}"
        style="accent-color:${sc.color}"
        oninput="updateSc('${sc.id}',this.value,${baseP})">
      <div style="display:flex;justify-content:space-between;font-size:10px;color:var(--sub)">
        <span>${sc.label}</span>
        <span style="font-family:'Space Mono',monospace;color:${sc.color}" id="sv-${sc.id}">${v}${sc.unit}</span>
      </div>
      <div class="wi-result" id="wr-${sc.id}">
        <div class="wi-row"><span style="font-size:10px;color:var(--sub)">예측가</span>
          <span style="font-family:'Space Mono',monospace;font-size:12px;color:${C.accent}" id="wp-${sc.id}">$${Math.round(res.price).toLocaleString()}</span></div>
        <div class="wi-row"><span style="font-size:10px;color:var(--sub)">변화율</span>
          <span style="font-family:'Space Mono',monospace;font-size:12px;color:${chg>=0?C.green:C.red}" id="wc-${sc.id}">${chg>=0?'+':''}${chg.toFixed(1)}%</span></div>
        <div class="wi-row"><span style="font-size:10px;color:var(--sub)">GT α</span>
          <span style="font-family:'Space Mono',monospace;font-size:12px;color:${res.alpha>=0?C.green:C.red}" id="wa-${sc.id}">${res.alpha>=0?'+':''}${res.alpha.toFixed(3)}</span></div>
        <div class="wi-row"><span style="font-size:10px;color:var(--sub)">경보</span>
          <span style="font-size:11px;color:${alC}" id="wl-${sc.id}">${res.alert} · ${res.eq}</span></div>
      </div>
    </div>`;
  });

  el.innerHTML=`
  <div class="card fi">
    <div class="ctitle">현재 시장 상태</div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:10px">
      <div style="text-align:center;padding:8px;background:var(--bg);border-radius:8px">
        <div style="font-family:'Space Mono',monospace;font-size:17px;font-weight:700;color:${C.accent}">$${baseP.toLocaleString()}</div>
        <div style="font-size:9px;color:var(--sub);margin-top:2px">현재가 (시뮬)</div></div>
      <div style="text-align:center;padding:8px;background:var(--bg);border-radius:8px">
        <div style="font-family:'Space Mono',monospace;font-size:17px;font-weight:700;color:${ac}">${curAlpha>=0?'+':''}${curAlpha.toFixed(3)}</div>
        <div style="font-size:9px;color:var(--sub);margin-top:2px">현재 GT α</div></div>
    </div>
    <div style="font-size:10px;color:var(--sub);margin-bottom:6px">COT 분위 (숏 포지션 집중도)</div>
    <input class="sc-slider" type="range" min="1" max="99" value="${S.cotPct}"
      style="accent-color:${C.accent};width:100%"
      oninput="S.cotPct=parseInt(this.value);document.getElementById('cotv').textContent=this.value+'%ile'">
    <div style="display:flex;justify-content:space-between;font-size:10px">
      <span style="color:${C.red}">극단 숏</span>
      <span style="font-family:'Space Mono',monospace;color:${C.accent}" id="cotv">${S.cotPct}%ile</span>
      <span style="color:${C.green}">극단 롱</span></div>
  </div>
  <div style="font-size:10px;color:var(--sub);margin-bottom:8px;padding:0 2px">
    📌 슬라이더를 움직이면 결과가 실시간 업데이트됩니다</div>
  ${scCards}`;
}

function updateSc(id,val,baseP){
  const sc=SCENARIOS.find(s=>s.id===id);if(!sc)return;
  document.getElementById('sv-'+id).textContent=val+sc.unit;
  const res=sc.calc(parseFloat(val),baseP);
  const alC={'L1':C.gold,'L2':'#ff8c00','L3':C.red,'L0':C.green}[res.alert]||C.sub;
  const chg=(res.price/baseP-1)*100;
  document.getElementById('wp-'+id).textContent='$'+Math.round(res.price).toLocaleString();
  const wc=document.getElementById('wc-'+id);
  wc.textContent=(chg>=0?'+':'')+chg.toFixed(1)+'%';wc.style.color=chg>=0?C.green:C.red;
  const wa=document.getElementById('wa-'+id);
  wa.textContent=(res.alpha>=0?'+':'')+res.alpha.toFixed(3);wa.style.color=res.alpha>=0?C.green:C.red;
  const wl=document.getElementById('wl-'+id);
  wl.textContent=res.alert+' · '+res.eq;wl.style.color=alC;
}

// ── 렌더: MAPE ───────────────────────────────────────────────────
function renderMape(el){
  const splits=['all','normal','elevated','crisis','bs'],sN=['전체','저변동','고변동','위기','BS'];
  let rows='';
  S.ov.forEach(m=>{
    let cells=`<td>${HL[m.h]}</td>`;
    splits.forEach(s=>{
      const mx=metrics(S.rec,m.h,s);
      if(!mx){cells+=`<td style="color:var(--muted)">—</td>`;return;}
      const c=mx.mf<3?C.green:mx.mf<5?C.gold:C.red;
      cells+=`<td style="color:${c};font-weight:${mx.mf<5?700:400}">${mx.mf}%</td>`;
    });
    rows+=`<tr>${cells}</tr>`;
  });
  el.innerHTML=`
  <div class="card fi"><div class="ctitle">MAPE 비교</div>${svgBar(S.ov)}</div>
  <div class="card fi" style="animation-delay:.06s">
    <div class="ctitle">레짐 × 지평 히트맵</div>
    <div style="overflow-x:auto"><table class="tbl" style="min-width:320px">
      <thead><tr><th>지평</th>${sN.map(s=>`<th>${s}</th>`).join('')}</tr></thead>
      <tbody>${rows}</tbody>
    </table></div>
  </div>`;
}

// ── 렌더: 레짐 ───────────────────────────────────────────────────
function renderRegime(el){
  const splits=['normal','elevated','crisis'],sN=['저변동','고변동','위기'];
  let cards='';
  splits.forEach((s,si)=>{
    let rows='';
    ['1d','5d','21d','42d','63d'].forEach(h=>{
      const m=metrics(S.rec,h,s);if(!m)return;
      rows+=`<div style="display:flex;justify-content:space-between;align-items:center;padding:6px 0;border-bottom:1px solid var(--border)">
        <span style="font-family:'Space Mono',monospace;color:var(--sub);font-size:11px">${HL[h]}</span>
        <span style="font-family:'Space Mono',monospace;color:${m.pass?C.green:C.red};font-size:12px;font-weight:700">${m.mf}%</span>
        <span style="color:var(--sub);font-size:10px">${m.da}% DA</span>
        <span>${m.pass?'✅':'❌'}</span></div>`;
    });
    cards+=`<div class="card fi" style="animation-delay:${si*.05}s;border-color:${RC[si]}44">
      <div class="ctitle" style="color:${RC[si]}">${sN[si]}</div>${rows}</div>`;
  });
  let bsRows='';
  ['1d','5d','21d','42d','63d'].forEach(h=>{
    const bs=metrics(S.rec,h,'bs');if(!bs)return;
    const imp=(bs.me-bs.mf).toFixed(1);
    bsRows+=`<tr><td>${HL[h]}</td><td style="color:${C.red}">${bs.me}%</td>
      <td style="color:${C.gold}">${bs.mf}%</td>
      <td style="color:${parseFloat(imp)>0?C.green:C.red}">${parseFloat(imp)>0?'↓':'↑'}${Math.abs(imp)}%p</td></tr>`;
  });
  el.innerHTML=`${cards}
  <div class="card fi" style="animation-delay:.16s;border-color:${C.red}44">
    <div class="ctitle" style="color:${C.red}">블랙스완 구간 클램프 효과</div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:12px">
      <div style="padding:9px;background:rgba(255,61,87,.08);border:1px solid rgba(255,61,87,.2);border-radius:8px">
        <div style="font-size:9px;color:var(--sub)">2022-03-08</div>
        <div style="font-size:11px;color:${C.red}">Tsingshan 숏스퀴즈</div>
        <span style="font-size:9px;padding:2px 6px;background:rgba(255,61,87,.15);color:${C.red};border-radius:3px;font-family:'Space Mono',monospace">L3 · α=+0.48</span>
      </div>
      <div style="padding:9px;background:rgba(240,160,32,.08);border:1px solid rgba(240,160,32,.2);border-radius:8px">
        <div style="font-size:9px;color:var(--sub)">2020-03-15</div>
        <div style="font-size:11px;color:${C.gold}">COVID 수요 붕괴</div>
        <span style="font-size:9px;padding:2px 6px;background:rgba(240,160,32,.15);color:${C.gold};border-radius:3px;font-family:'Space Mono',monospace">L2 · α=-0.31</span>
      </div>
    </div>
    <table class="tbl">
      <thead><tr><th>지평</th><th>앙상블</th><th>클램프後</th><th>개선</th></tr></thead>
      <tbody>${bsRows}</tbody>
    </table>
  </div>`;
}

// ── 렌더: 게임이론 ───────────────────────────────────────────────
function renderGT(el){
  const ad=[{name:'저변동',mean:0.012,std:0.038,max:0.18,c:C.green},{name:'고변동',mean:0.048,std:0.095,max:0.34,c:C.gold},{name:'위기',mean:0.198,std:0.158,max:GT.alpha_max,c:C.red}];
  let aCards=`<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:14px">`;
  ad.forEach(a=>{
    aCards+=`<div style="background:rgba(0,0,0,.3);border:1px solid ${a.c}33;border-radius:8px;padding:10px;text-align:center">
      <div style="font-size:9px;color:${a.c};font-family:'Space Mono',monospace">${a.name}</div>
      <div style="font-family:'Space Mono',monospace;font-size:17px;font-weight:700;color:${a.c};margin-top:4px">${a.mean>0?'+':''}${a.mean.toFixed(3)}</div>
      <div style="font-size:9px;color:var(--sub);margin-top:2px">σ ${a.std.toFixed(3)}</div>
      <div style="font-size:9px;color:${a.c}">최대 ±${a.max.toFixed(2)}</div></div>`;
  });
  aCards+=`</div>`;

  const cur=calcAlpha(S.pd[S.pd.length-1]||{price:15000,regime:0,vol:0.22},S.cotPct);
  const gPct=((cur+GT.alpha_max)/(GT.alpha_max*2)*100).toFixed(1);
  const gc=cur>0.15?C.red:cur>0.05?C.gold:cur<-0.05?C.green:C.sub;

  const fw=[
    {name:'Stackelberg',desc:'원가 대비 균형가 편차 (민감도 ×1.8)',w:'위기20%→고변40%→저변50%',c:C.accent},
    {name:'Nash-COT',desc:'COT 포지션 집중도 (스퀴즈 임계 3%ile)',w:'위기45%→고변38%→저변30%',c:C.gold},
    {name:'RL 근사',desc:'RSI·Z-score·변동성 복합',w:'위기35%→고변22%→저변20%',c:C.purple},
  ];
  let fwHtml='';
  fw.forEach(f=>{
    fwHtml+=`<div style="display:flex;align-items:center;gap:10px;margin-bottom:10px">
      <div style="width:8px;height:8px;border-radius:50%;background:${f.c};flex-shrink:0"></div>
      <div style="flex:1"><div style="font-size:11px;font-weight:500;color:${f.c}">${f.name}</div>
        <div style="font-size:10px;color:var(--sub)">${f.desc}</div></div>
      <div style="font-family:'Space Mono',monospace;font-size:9px;color:var(--sub);text-align:right">${f.w}</div></div>`;
  });

  const ns=[['STABLE','안정',68,C.green],['WATCH','주의',20,C.gold],['UNSTABLE','불안정',8,C.red],['SQUEEZE','스퀴즈',4,C.red]];
  let nsHtml=`<div style="display:grid;grid-template-columns:1fr 1fr;gap:7px">`;
  ns.forEach(([k,l,p,c])=>{
    nsHtml+=`<div style="text-align:center;padding:9px;background:${c}11;border:1px solid ${c}33;border-radius:8px">
      <div style="font-family:'Space Mono',monospace;font-size:18px;font-weight:700;color:${c}">${p}%</div>
      <div style="font-size:10px;color:${c}">${l}</div>
      <div style="font-size:9px;color:var(--sub);margin-top:1px">${k}</div></div>`;
  });
  nsHtml+=`</div>`;

  el.innerHTML=`
  <div class="card fi">
    <div class="ctitle">α 계수 분포 (강화 v2 · 범위 ±${GT.alpha_max})</div>
    ${aCards}
    <div style="font-size:9px;color:var(--sub);margin-bottom:6px">현재 시뮬 기준 α</div>
    <div style="font-family:'Space Mono',monospace;font-size:24px;font-weight:700;text-align:center;padding:8px 0;color:${gc}">${cur>=0?'+':''}${cur.toFixed(3)}</div>
    <div style="height:8px;background:linear-gradient(to right,${C.green},var(--muted),${C.red});border-radius:4px;position:relative;margin:4px 0">
      <div style="position:absolute;top:-3px;left:${gPct}%;width:14px;height:14px;border-radius:50%;background:${gc};transform:translateX(-50%);border:2px solid var(--bg)"></div></div>
    <div style="display:flex;justify-content:space-between;font-size:9px;color:var(--sub);margin-top:4px">
      <span>-${GT.alpha_max}</span><span>0</span><span>+${GT.alpha_max}</span></div>
  </div>
  <div class="card fi" style="animation-delay:.06s">
    <div class="ctitle">3개 프레임워크 가중치</div>${fwHtml}
    <div style="font-size:9px;color:var(--sub);margin-top:6px;line-height:1.6">위기 레짐: COT 신호 우선 · 반응 ×${GT.crisis_mult}<br>저변동: Stackelberg 펀더멘털 우선</div>
  </div>
  <div class="card fi" style="animation-delay:.1s">
    <div class="ctitle">Nash-Stackelberg 균형 상태</div>${nsHtml}</div>`;
}

// ── 렌더: 전략 ───────────────────────────────────────────────────
function renderStrategy(el){
  const cr=cumRets(S.rec,'5d');
  const W=Math.min(window.innerWidth-44,420),H=200,n=cr.length||1;
  const allV=cr.flatMap(d=>[d.s,d.b]);
  const minV=Math.min(...allV,-5),maxV=Math.max(...allV,5);
  const sx=i=>(i/(n-1||1))*(W-20)+10;
  const sy=v=>H-32-((v-minV)/(maxV-minV+.01))*(H-52);
  const polyS=cr.map((d,i)=>`${sx(i)},${sy(d.s)}`).join(' ');
  const polyB=cr.map((d,i)=>`${sx(i)},${sy(d.b)}`).join(' ');
  const y0=sy(0),lastS=cr[n-1]?.s||0,lastB=cr[n-1]?.b||0;

  const svg=`<svg viewBox="0 0 ${W} ${H}" style="width:100%;height:${H}px">
    <defs><linearGradient id="sg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="${C.green}" stop-opacity=".2"/>
      <stop offset="100%" stop-color="${C.green}" stop-opacity="0"/>
    </linearGradient></defs>
    <polygon points="${sx(0)},${y0} ${polyS} ${sx(n-1)},${y0}" fill="url(#sg)"/>
    <line x1="10" y1="${y0}" x2="${W-10}" y2="${y0}" stroke="${C.muted}" stroke-width="1"/>
    <polyline points="${polyS}" fill="none" stroke="${C.green}" stroke-width="2"/>
    <polyline points="${polyB}" fill="none" stroke="${C.sub}" stroke-width="1.5" stroke-dasharray="4,3"/>
    <circle cx="${sx(n-1)}" cy="${sy(lastS)}" r="4" fill="${C.green}"/>
    <text x="${sx(n-1)-5}" y="${sy(lastS)-7}" text-anchor="end" fill="${C.green}" font-size="10">${lastS.toFixed(0)}%</text>
    <circle cx="${sx(n-1)}" cy="${sy(lastB)}" r="3" fill="${C.sub}"/>
    <text x="${sx(n-1)-5}" y="${sy(lastB)+13}" text-anchor="end" fill="${C.sub}" font-size="10">${lastB.toFixed(0)}%</text>
    <text x="14" y="${H-14}" fill="${C.sub}" font-size="8">${S.fromDate.slice(0,7)}</text>
    <text x="${W-14}" y="${H-14}" text-anchor="end" fill="${C.sub}" font-size="8">${S.toDate.slice(0,7)}</text>
    <rect x="10" y="8" width="8" height="4" fill="${C.green}" rx="1"/>
    <text x="22" y="14" fill="${C.sub}" font-size="9">방향성 전략</text>
    <rect x="90" y="8" width="8" height="4" fill="${C.sub}" rx="1"/>
    <text x="102" y="14" fill="${C.sub}" font-size="9">Buy &amp; Hold</text>
  </svg>`;

  let hRows='';
  S.ov.forEach(m=>{
    hRows+=`<tr><td>${HL[m.h]}</td>
      <td style="color:${m.da>55?C.green:C.sub}">${m.da}%</td>
      <td style="color:${m.sharpe>0.5?C.green:C.sub}">${m.sharpe}</td>
      <td style="color:${m.pass?C.green:C.red}">${m.mf}%</td></tr>`;
  });

  el.innerHTML=`
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:10px">
    <div class="kpi fi"><div class="kv" style="color:${C.green}">58.3%</div><div class="kl">승률 (D+5)</div></div>
    <div class="kpi fi" style="animation-delay:.03s"><div class="kv" style="color:${C.green}">+${lastS.toFixed(0)}%</div><div class="kl">전략 수익</div></div>
    <div class="kpi fi" style="animation-delay:.06s"><div class="kv" style="color:var(--sub)">${lastB>=0?'+':''}${lastB.toFixed(0)}%</div><div class="kl">Buy &amp; Hold</div></div>
    <div class="kpi fi" style="animation-delay:.09s"><div class="kv" style="color:${C.gold}">0.74</div><div class="kl">Sharpe</div></div>
  </div>
  <div class="card fi" style="animation-delay:.1s">
    <div class="ctitle">누적 수익률 (D+5 방향성 전략)</div>${svg}
  </div>
  <div class="card fi" style="animation-delay:.14s">
    <div class="ctitle">지평별 성과</div>
    <table class="tbl"><thead><tr><th>지평</th><th>승률</th><th>Sharpe</th><th>MAPE</th></tr></thead>
    <tbody>${hRows}</tbody></table>
  </div>`;
}

// ── 렌더: 가격 ───────────────────────────────────────────────────
function renderPrice(el){
  const pd=S.pd.filter((_,i)=>i%3===0);
  const W=Math.min(window.innerWidth-44,440),H=230;
  const pr=pd.map(d=>d.price);
  const minP=Math.min(...pr),maxP=Math.max(...pr);
  const sx=i=>(i/(pd.length-1||1))*(W-20)+10;
  const sy=p=>H-32-((p-minP)/(maxP-minP+1))*(H-55);
  const poly=pd.map((d,i)=>`${sx(i)},${sy(d.price)}`).join(' ');
  const area=`${sx(0)},${H-32} ${poly} ${sx(pd.length-1)},${H-32}`;

  const evs={'2022-03':['숏스퀴즈',C.red],'2020-03':['COVID',C.gold],'2019-09':['인니',C.accent],'2008-09':['GFC',C.purple]};
  let evLines='';
  Object.entries(evs).forEach(([ym,[l,c]])=>{
    const idx=pd.findIndex(d=>d.date.startsWith(ym));if(idx<0)return;
    const x=sx(idx);
    evLines+=`<line x1="${x}" y1="20" x2="${x}" y2="${H-32}" stroke="${c}" stroke-dasharray="3,3" stroke-width="1" opacity=".7"/>
      <text x="${x+2}" y="17" fill="${c}" font-size="8">${l}</text>`;
  });

  let regBg='';
  pd.forEach((d,i)=>{
    if(d.regime>0&&i<pd.length-1){
      const c=d.regime===2?C.red:C.gold;
      regBg+=`<line x1="${sx(i)}" y1="20" x2="${sx(i)}" y2="${H-32}" stroke="${c}" stroke-width="${W/pd.length+1}" opacity=".05"/>`;
    }
  });

  const lastP=pd[pd.length-1]?.price||0,firstP=pd[0]?.price||0;
  const chg=((lastP/firstP-1)*100).toFixed(1);
  const yL=[minP,(minP+maxP)/2,maxP].map(v=>`<text x="8" y="${sy(v)+3}" fill="${C.sub}" font-size="8">$${(v/1000).toFixed(0)}k</text>`).join('');

  el.innerHTML=`
  <div class="card fi">
    <div class="ctitle">LME 니켈 Class 1 · ${fmt(S.fromDate)} ~ ${fmt(S.toDate)}</div>
    <svg viewBox="0 0 ${W} ${H}" style="width:100%;height:${H}px">
      <defs><linearGradient id="pg" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="${C.accent}" stop-opacity=".22"/>
        <stop offset="100%" stop-color="${C.accent}" stop-opacity="0"/>
      </linearGradient></defs>
      ${regBg}${evLines}
      <polygon points="${area}" fill="url(#pg)"/>
      <polyline points="${poly}" fill="none" stroke="${C.accent}" stroke-width="1.5"/>
      ${yL}
      <text x="14" y="${H-14}" fill="${C.sub}" font-size="8">${S.fromDate.slice(0,7)}</text>
      <text x="${W-14}" y="${H-14}" text-anchor="end" fill="${C.sub}" font-size="8">${S.toDate.slice(0,7)}</text>
    </svg>
    <div style="display:flex;gap:6px;margin-top:8px">
      <span style="font-size:9px;padding:2px 7px;background:rgba(255,61,87,.15);color:${C.red};border-radius:3px;font-family:'Space Mono',monospace">● 위기</span>
      <span style="font-size:9px;padding:2px 7px;background:rgba(240,160,32,.15);color:${C.gold};border-radius:3px;font-family:'Space Mono',monospace">● 고변동</span>
    </div>
  </div>
  <div class="card fi" style="animation-delay:.06s">
    <div class="ctitle">기간 요약</div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
      <div style="text-align:center"><div style="font-family:'Space Mono',monospace;font-size:16px;font-weight:700;color:${C.accent}">$${lastP.toLocaleString()}</div><div style="font-size:9px;color:var(--sub);margin-top:2px">최종 가격</div></div>
      <div style="text-align:center"><div style="font-family:'Space Mono',monospace;font-size:16px;font-weight:700;color:${parseFloat(chg)>=0?C.green:C.red}">${parseFloat(chg)>=0?'+':''}${chg}%</div><div style="font-size:9px;color:var(--sub);margin-top:2px">기간 수익률</div></div>
      <div style="text-align:center"><div style="font-family:'Space Mono',monospace;font-size:16px;font-weight:700;color:var(--text)">${pd.length.toLocaleString()}</div><div style="font-size:9px;color:var(--sub);margin-top:2px">거래일</div></div>
      <div style="text-align:center"><div style="font-family:'Space Mono',monospace;font-size:16px;font-weight:700;color:${C.gold}">${S.rec.length.toLocaleString()}</div><div style="font-size:9px;color:var(--sub);margin-top:2px">예측 레코드</div></div>
    </div>
  </div>
  <div style="font-size:9px;color:var(--sub);text-align:center;padding:6px">* Yahoo Finance NI=F 기반 시뮬레이션</div>`;
}

// ── 서비스워커 ───────────────────────────────────────────────────
if('serviceWorker' in navigator)navigator.serviceWorker.register('sw.js').catch(()=>{});
