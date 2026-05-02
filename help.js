// ── 도움말 콘텐츠 ────────────────────────────────────────────────
const HELP = {
  overview: {
    title: "개요 화면 설명",
    sections: [
      {
        icon: "📏",
        title: "MAPE가 뭔가요?",
        body: `예측한 가격이 실제 가격과 얼마나 다른지 나타내는 숫자예요.\n\n예시: 실제 가격 $10,000인데 $9,500으로 예측했다면\n→ 틀린 정도 = 5% → MAPE = 5%\n\n✅ 5% 이내 = 잘 맞힘\n❌ 5% 초과 = 아직 부족`
      },
      {
        icon: "📅",
        title: "D+1, D+5... 가 뭔가요?",
        body: `오늘부터 며칠 뒤 가격을 예측하냐예요.\n\nD+1 = 내일\nD+5 = 1주일 후\nD+21 = 한 달 후\nD+42 = 두 달 후\nD+63 = 석 달 후\n\n멀수록 예측이 어려워서 MAPE가 커지는 게 정상이에요.`
      },
      {
        icon: "⚠️",
        title: "현실적인 MAPE 기준",
        body: `실제 LME 니켈 예측 연구 기준:\n\nD+1:  1.5~2.5% (달성 가능)\nD+5:  3~5%\nD+21: 5~8%\nD+63: 8~15%\n\n이 앱의 수치는 시뮬레이션 기반이라\n실제와 다를 수 있어요.`
      },
      {
        icon: "🎮",
        title: "게임이론 기여도",
        body: `예측이 두 단계로 작동해요:\n\n1단계: 컴퓨터 앙상블 예측\n2단계: 게임이론으로 보정\n\n빨간 숫자 → 초록 숫자로 줄어든 게\n게임이론이 예측을 개선한 양이에요.`
      }
    ]
  },
  whatif: {
    title: "What-If 시나리오 설명",
    sections: [
      {
        icon: "🎲",
        title: "What-If이 뭔가요?",
        body: `"만약 이런 일이 생기면 가격이 어떻게 될까?" 테스트예요.\n\n슬라이더를 움직이면 시나리오 강도를 조절할 수 있어요.`
      },
      {
        icon: "🇮🇩",
        title: "인니 수출 금지",
        body: `인도네시아 = 세계 니켈 공급 1위국\n\n수출을 막으면 → 공급 감소 → 가격 상승\n\n슬라이더 오른쪽 = 충격이 클수록\n실제 2014년엔 15%, 2019년 발표 때 30% 급등`
      },
      {
        icon: "🇨🇳",
        title: "중국 PMI",
        body: `PMI = 중국 공장 가동률 지수\n\n50 이상 = 공장 바쁨 = 니켈 수요↑ = 가격↑\n50 이하 = 공장 한산 = 니켈 수요↓ = 가격↓\n40 이하 = 심각한 수요 붕괴\n\n슬라이더 왼쪽 = PMI 낮을수록 = 가격 하락`
      },
      {
        icon: "📊",
        title: "결과 수치 해석",
        body: `예측가: 그 상황의 예상 니켈 가격\n변화율: 지금보다 얼마나 오르내리는지\nGT α: 게임이론 보정 강도\n  +면 상승 조정, -면 하락 조정\n경보 L0~L3:\n  L0 = 평상시\n  L1 = 주의\n  L2 = 경보 발령\n  L3 = 위기 (숏스퀴즈 수준)`
      }
    ]
  },
  mape: {
    title: "MAPE 분석 화면 설명",
    sections: [
      {
        icon: "📊",
        title: "바 차트 읽는 법",
        body: `빨간 막대 = 앙상블 모델만 썼을 때 MAPE\n초록 막대 = 게임이론까지 적용했을 때 MAPE\n\n초록이 빨간보다 낮으면 = 게임이론이 도움이 된 것\n노란 점선 = 5% 목표선`
      },
      {
        icon: "🗺️",
        title: "히트맵 읽는 법",
        body: `초록색 = MAPE 3% 이하 (아주 잘함)\n노란색 = MAPE 3~5% (보통)\n빨간색 = MAPE 5% 초과 (부족)\n\n저변동 레짐에서 더 잘 맞히고\n위기 레짐에서 오차가 커지는 게 정상이에요.`
      },
      {
        icon: "📈",
        title: "실제 LME 니켈 예측 난이도",
        body: `니켈은 주요 금속 중 변동성이 가장 높아요.\n2022년엔 하루에 250% 오른 적도 있어요.\n\n그래서 장기(D+63) MAPE 8~15%는\n학술 연구에서도 흔한 수준이에요.\n\n5% 이내가 목표이지만\nD+63에서는 달성이 매우 어렵습니다.`
      }
    ]
  },
  regime: {
    title: "레짐 화면 설명",
    sections: [
      {
        icon: "🌤️",
        title: "레짐이 뭔가요?",
        body: `지금 시장이 어떤 상태냐예요.\n\n저변동 🟢 = 가격이 잔잔 (맑은 날)\n고변동 🟡 = 가격이 출렁 (흐린 날)\n위기 🔴 = 가격 폭등/폭락 (태풍)\n\n레짐마다 모델을 따로 학습해서\n각 상황에 최적화했어요.`
      },
      {
        icon: "🌊",
        title: "왜 레짐마다 MAPE가 달라요?",
        body: `태풍 때 내일 날씨 예측이 더 어렵듯\n위기 레짐에서 MAPE가 높은 건 당연해요.\n\n2022년 숏스퀴즈 때처럼\n하루에 250% 오르는 건 어떤 모델도 못 맞혀요.\n\n이 때 블랙스완 클램프가 작동해서\n최악의 예측값이 나오는 걸 막아줘요.`
      },
      {
        icon: "🚨",
        title: "블랙스완 클램프",
        body: `모델이 말도 안 되는 가격을 예측하면\n자동으로 범위를 제한해요.\n\nL0: 제한 없음\nL1: ±10% 소프트 제한\nL2: ±22% 제한 + 경보\nL3: ±42% 제한 + 위기 경보\n\n2022년 숏스퀴즈 때 L3 발동 → α=+0.48`
      }
    ]
  },
  gt: {
    title: "게임이론 화면 설명",
    sections: [
      {
        icon: "♟️",
        title: "게임이론이 뭔가요?",
        body: `니켈 시장의 큰 플레이어들이\n서로 눈치 보며 행동하는 걸 수학으로 모델링한 거예요.\n\n체스에서 상대방 수를 예측하는 것과 같아요.\n\n플레이어:\n• 생산자 (인니 광산, 러시아 Norilsk)\n• 트레이더 (Glencore, Trafigura)\n• 투기 펀드`
      },
      {
        icon: "α",
        title: "α (알파)가 뭔가요?",
        body: `게임이론이 예측값을 얼마나 조정할지 결정하는 숫자예요.\n\n+0.10 = 예측가를 10% 올림 (상승 압력)\n-0.10 = 예측가를 10% 내림 (하락 압력)\n\n위기 레짐에서 최대 ±0.50까지 커져요.\n이 앱에서 기존 ±0.30에서 강화했어요.`
      },
      {
        icon: "📋",
        title: "COT 분위가 뭔가요?",
        body: `COT = 미국이 매주 공개하는\n"누가 얼마나 사고팔았냐" 데이터\n\n분위 = 역대 기록 대비 순위 (1~100%)\n\n3%ile = 역대 최고 수준 숏 포지션\n→ 숏 스퀴즈 위험 🚨\n\n95%ile = 역대 최고 수준 롱 포지션\n→ 반전 주의`
      },
      {
        icon: "⚖️",
        title: "3개 프레임워크",
        body: `Stackelberg: 생산자 원가 vs 현재 가격\n  원가 $13,500보다 너무 높으면 하락 압력\n\nNash-COT: 투기 포지션 집중도\n  극단적 숏이면 스퀴즈 신호\n\nRL 근사: RSI·Z-score·변동성 조합\n  기술적 과매수/과매도 감지`
      }
    ]
  },
  strategy: {
    title: "전략 화면 설명",
    sections: [
      {
        icon: "💹",
        title: "방향성 전략이 뭔가요?",
        body: `모델이 "오를 것 같다" → 사기 (롱)\n모델이 "내릴 것 같다" → 팔기 (숏)\n\n이걸 매일 반복했을 때\n돈이 얼마나 벌리는지 보는 거예요.`
      },
      {
        icon: "🏆",
        title: "수치 해석",
        body: `승률 58.3%: 10번 중 6번 방향 맞힘\n\n전략 수익: 이 방식의 누적 수익률\nBuy&Hold: 그냥 사서 들고 있었을 때\n\nSharpe:\n  1.0 이상 = 훌륭\n  0.5 이상 = 양호\n  0.5 미만 = 아직 부족`
      },
      {
        icon: "⚠️",
        title: "주의사항",
        body: `이 전략 수익률은 시뮬레이션이에요.\n실제 거래에서는:\n\n• 거래 비용 추가 차감\n• 슬리피지 발생\n• 유동성 문제\n\n실제 투자에 직접 활용하지 마시고\n참고용으로만 사용하세요.`
      }
    ]
  }
};

// ── 팝업 렌더링 ──────────────────────────────────────────────────
function showHelp(tabName) {
  const h = HELP[tabName];
  if (!h) return;

  const overlay = document.createElement('div');
  overlay.id = 'help-overlay';
  overlay.style.cssText = `
    position:fixed;inset:0;background:rgba(0,0,0,.85);z-index:1000;
    display:flex;flex-direction:column;overflow:hidden;
    padding:env(safe-area-inset-top,0) 0 env(safe-area-inset-bottom,0);
  `;

  let sectionsHtml = '';
  h.sections.forEach(s => {
    sectionsHtml += `
      <div style="background:#111520;border:1px solid #1c2238;border-radius:12px;padding:14px;margin-bottom:10px">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">
          <span style="font-size:20px">${s.icon}</span>
          <span style="font-size:13px;font-weight:700;color:#dde4f4">${s.title}</span>
        </div>
        <div style="font-size:12px;color:#8899bb;line-height:1.8;white-space:pre-line">${s.body}</div>
      </div>`;
  });

  overlay.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:space-between;
      padding:16px;background:#0c0f1a;border-bottom:1px solid #1c2238;flex-shrink:0">
      <div style="font-family:'DM Mono',monospace;font-size:12px;font-weight:700;color:#00c8ff">
        ❓ ${h.title}
      </div>
      <button onclick="closeHelp()" style="background:#2a3350;border:none;border-radius:8px;
        width:32px;height:32px;font-size:18px;cursor:pointer;color:#dde4f4;display:flex;
        align-items:center;justify-content:center">✕</button>
    </div>
    <div style="flex:1;overflow-y:auto;padding:14px;-webkit-overflow-scrolling:touch">
      ${sectionsHtml}
      <div style="font-size:10px;color:#3a4560;text-align:center;padding:8px">
        탭 밖을 눌러도 닫혀요
      </div>
    </div>`;

  overlay.addEventListener('click', e => {
    if (e.target === overlay) closeHelp();
  });

  document.body.appendChild(overlay);
  // 스크롤 막기
  document.getElementById('app').style.overflow = 'hidden';
}

function closeHelp() {
  const el = document.getElementById('help-overlay');
  if (el) el.remove();
  document.getElementById('app').style.overflow = '';
}
