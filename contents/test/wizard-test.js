/* ═══════════════════════════════════════════════════
   wizard-test.js
   "눈 떠보니 마법사" 전용 스크립트
═══════════════════════════════════════════════════ */

/* ───────────────────────────────────────
   1. 별빛 파티클 캔버스
─────────────────────────────────────── */
(function initStars() {
  const canvas = document.getElementById('stars-canvas');
  const ctx    = canvas.getContext('2d');
  let stars    = [];

  function resize() {
    canvas.width  = window.innerWidth;
    canvas.height = window.innerHeight;
  }

  function createStars(n) {
    stars = Array.from({ length: n }, () => ({
      x:     Math.random() * canvas.width,
      y:     Math.random() * canvas.height,
      r:     Math.random() * 1.5 + 0.3,
      a:     Math.random(),
      speed: Math.random() * 0.005 + 0.002,
      phase: Math.random() * Math.PI * 2,
    }));
  }

  function draw(t) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    stars.forEach(s => {
      s.a = 0.3 + 0.7 * Math.abs(Math.sin(t * s.speed + s.phase));
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(220,210,255,${s.a})`;
      ctx.fill();
    });
    requestAnimationFrame(draw);
  }

  resize();
  createStars(160);
  window.addEventListener('resize', () => { resize(); createStars(160); });
  requestAnimationFrame(draw);
})();


/* ───────────────────────────────────────
   2. 오디오 시스템
   — Web Audio API 기반 레트로 RPG 사운드 —
   — soundEnabled = false 시 완전 무음 —
─────────────────────────────────────── */
let soundEnabled = true;
let audioCtx     = null;
let bgmPlaying   = false;
let bgmNodes     = [];   // 중지 시 정리용

function getAudioCtx() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  return audioCtx;
}

/* 효과음 — 단순 톤 */
function playTone(freq, type, duration, vol = 0.12) {
  if (!soundEnabled) return;
  try {
    const ctx  = getAudioCtx();
    const osc  = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type            = type;
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(vol, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
    osc.start();
    osc.stop(ctx.currentTime + duration);
  } catch (e) {}
}

function playChoice() { playTone(440, 'square',   0.12, 0.08); }
function playNext()   { playTone(523, 'square',   0.15, 0.09); }
function playResult() {
  if (!soundEnabled) return;
  // 판정 팡파르 — 4화음 아르페지오
  [261, 330, 392, 523, 659].forEach((f, i) =>
    setTimeout(() => playTone(f, 'square', 0.5, 0.1), i * 120)
  );
}

/* BGM — 레트로 RPG 앰비언트 루프
   판타지 분위기의 단순 화음 시퀀스를 반복합니다.
   음정: Cm 스케일 기반 (C3~G4) */
const BGM_NOTES = [
  // [freq, duration_ms]
  [130, 600], [155, 400], [174, 400], [196, 600],
  [220, 400], [196, 400], [174, 600], [155, 400],
  [130, 400], [130, 800], [174, 400], [220, 600],
  [261, 400], [220, 400], [196, 600], [174, 400],
  [155, 400], [130, 400], [110, 800],
];

let bgmTimeout  = null;
let bgmNoteIdx  = 0;

function startBGM() {
  if (!soundEnabled || bgmPlaying) return;
  bgmPlaying = true;
  bgmNoteIdx = 0;
  playBGMNote();
}

function playBGMNote() {
  if (!soundEnabled || !bgmPlaying) return;
  const [freq, dur] = BGM_NOTES[bgmNoteIdx % BGM_NOTES.length];

  try {
    const ctx  = getAudioCtx();
    const osc  = ctx.createOscillator();
    const gain = ctx.createGain();
    // 부드러운 사각파 + 저역 필터로 레트로 오르간 질감
    const filter = ctx.createBiquadFilter();
    filter.type            = 'lowpass';
    filter.frequency.value = 800;

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);

    osc.type            = 'square';
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.04, ctx.currentTime + 0.05);
    gain.gain.linearRampToValueAtTime(0.04, ctx.currentTime + dur / 1000 - 0.08);
    gain.gain.linearRampToValueAtTime(0,    ctx.currentTime + dur / 1000);
    osc.start();
    osc.stop(ctx.currentTime + dur / 1000);
  } catch (e) {}

  bgmNoteIdx++;
  bgmTimeout = setTimeout(playBGMNote, dur);
}

function stopBGM() {
  bgmPlaying = false;
  if (bgmTimeout) { clearTimeout(bgmTimeout); bgmTimeout = null; }
}

/* 음소거 토글 버튼 */
const muteBtn = document.getElementById('mute-toggle');
muteBtn.addEventListener('click', () => {
  soundEnabled = !soundEnabled;
  muteBtn.textContent = soundEnabled ? '🔊' : '🔇';
  if (!soundEnabled) {
    stopBGM();
  } else {
    startBGM();
  }
});

function selectSound(on) {
  soundEnabled = on;
  document.getElementById('btn-sound-on').classList.toggle('selected',  on);
  document.getElementById('btn-sound-off').classList.toggle('selected', !on);
}


/* ───────────────────────────────────────
   3. 점수 변수
   eScore / iScore  : 외향(E) vs 내향(I)
   sScore / nScore  : 감각(S) vs 직관(N)
   tScore / fScore  : 사고(T) vs 감정(F)
   jScore / pScore  : 판단(J) vs 인식(P)
   aScore           : 자기확신형(-A)
   tInstScore       : 신중형(-T) [기존 T_inst 통일]
   hidden*          : 히든 클래스 가산점
─────────────────────────────────────── */
let eScore = 0, iScore = 0,
    sScore = 0, nScore = 0,
    tScore = 0, fScore = 0,
    jScore = 0, pScore = 0,
    aScore = 0, tInstScore = 0;

let hiddenArchmage = 0,
    hiddenPhysical = 0,
    hiddenNecro    = 0,
    hiddenChrono   = 0;

let nickname  = '';
let currentQ  = 0;

function resetScores() {
  eScore = iScore = sScore = nScore =
  tScore = fScore = jScore = pScore =
  aScore = tInstScore = 0;
  hiddenArchmage = hiddenPhysical = hiddenNecro = hiddenChrono = 0;
  currentQ = 0;
}


/* ───────────────────────────────────────
   4. 구간 레이블
─────────────────────────────────────── */
const STAGES = [
  { label: '1구간: 중세 적응기',   range: [1,  5]  },
  { label: '2구간: 재능의 발견',   range: [6,  10] },
  { label: '3구간: 마법학교 생활', range: [11, 15] },
  { label: '4구간: 마탑 실전기',   range: [16, 20] },
];

function getStageLabel(idx) {
  for (const s of STAGES) {
    if (idx + 1 >= s.range[0] && idx + 1 <= s.range[1]) return s.label;
  }
  return '';
}


/* ───────────────────────────────────────
   5. 문항 데이터 (20문항 × 5지선다)
─────────────────────────────────────── */
const QUESTIONS = [
  /* Q1 */
  { text: '{nick}, 눈을 떠보니 낯선 나무 침대 위고, 창밖에는 마차가 지나간다. 당신의 첫 행동은?',
    choices: [
      { text: '일단 문을 박차고 나가 마당에 있는 사람들에게 다가가 말을 건다.',                             s: {e:2, p:1} },
      { text: '이불을 꼭 쥐고 가만히 누워, 방 안의 구조와 창밖에서 들리는 소리를 가만히 살핀다.',           s: {i:2, s:1} },
      { text: '지독한 가위나 꿈이라 확신하고, 뺨을 세게 때린 뒤 다시 잠을 청해본다.',                       s: {p:2, s:1} },
      { text: '"누가 날 납치했나? 아니면 내가 미친 건가?" 머리를 감싸 쥐고 상황을 의심하기 시작한다.',      s: {n:2, i:1, chrono:1} },
      { text: '베개 밑이나 서랍장을 뒤져 당장 쓸 수 있는 동전이나 무기가 될 만한 게 있는지 확인한다.',      s: {s:2, j:1, physical:1} },
    ]
  },
  /* Q2 */
  { text: '살기 위해 시작한 주점 알바. 축제처럼 손님이 꽉 차서 귀가 먹먹할 정도로 시끄러울 때 {nick}은?',
    choices: [
      { text: '테이블 사이를 누비며 손님들의 건배 제의에 능숙하게 맞장구치고 팁을 뜯어낸다.',               s: {e:2, f:1} },
      { text: '밀려드는 맥주 주문 순서를 머릿속으로 슥 정리한 뒤, 귀신같은 동선으로 서빙만 해치운다.',       s: {i:1, t:2, j:1} },
      { text: '"여긴 너무 기 빨려..." 사장님 눈을 피해 조용한 창고에 들어가 식재료 정리나 하러 숨어버린다.', s: {i:2, p:1, necro:1} },
      { text: '술 취한 용병들이 떠드는 숲속 괴물 이야기나 왕국의 정세 같은 흥미진진한 소문에 귀를 기울인다.', s: {n:2, e:1} },
      { text: '주문이 밀리든 말든, 사장님 눈치만 슥 보면서 내 페이스대로 느긋하게 쟁반을 나른다.',           s: {p:2, s:1} },
    ]
  },
  /* Q3 */
  { text: '매일 보던 단골손님이 {nick}의 어두운 안색을 보더니 "무슨 걱정거리라도 있어?"라며 어깨를 툭 친다.',
    choices: [
      { text: '기다렸다는 듯 마주 앉아 "요즘 밤마다 이상한 가위에 눌리는데..."라며 내 속마음을 전부 털어놓는다.', s: {e:2, f:1} },
      { text: '"아닙니다, 괜찮아요." 어색하게 웃으며 화제를 돌리고 얼른 빈 그릇을 치우러 간다.',              s: {i:2, t:1} },
      { text: '손님의 과도한 관심이 부담스러워 대답도 하는 둥 마는 둥 하고 슬그머니 자리를 피한다.',          s: {i:2, p:1, necro:1} },
      { text: '나를 진심으로 걱정해 주는 손님의 따뜻한 눈빛에 감동해 울컥하는 마음이 든다.',                  s: {f:2, i:1} },
      { text: '"얼굴이 좀 부어서 그런 것 같습니다. 주방 불빛이 너무 노랗기도 하고요."라며 담담하게 사실을 말한다.', s: {t:2, s:1} },
    ]
  },
  /* Q4 */
  { text: '마을 광장에서 성대한 수확 축제가 열려 온 동네 사람들이 춤을 추고 있다. 이때 {nick}은?',
    choices: [
      { text: '처음 보는 마을 청년들의 손을 잡고 강강술래하듯 축제 한복판으로 뛰어든다.',                     s: {e:2, p:1} },
      { text: '가장 어두운 나무 그늘 아래 벤치에 앉아, 모닥불과 사람들을 구경하며 혼자 맥주나 마신다.',       s: {i:2, s:1} },
      { text: '남들 놀 때 축제 매대의 대박 동선을 분석하거나, 오늘 밤 주점 마감 계획을 철저히 시뮬레이션한다.', s: {j:2, t:1} },
      { text: '이 사람들은 왜 이 축제를 열까? 중세의 문화와 신앙, 이 축제의 깊은 역사적 유래를 홀로 궁금해한다.', s: {n:2, i:1} },
      { text: '축제고 나발이고 공짜로 나눠주는 통돼지 바비큐와 꿀맛 나는 과일주를 배 터지게 먹는 데 집중한다.', s: {s:2, p:1} },
    ]
  },
  /* Q5 */
  { text: '주점 사장님이 영수증과 동전 무더기를 앞에 두고 밤새도록 계산이 안 맞는다며 머리를 쥐어뜯고 있다.',
    choices: [
      { text: '장부를 뺏어 들고 덧셈, 뺄셈을 슥 보더니 "사장님, 밀가루 포대 가격을 두 번 더하셨네요"라며 단번에 찾아낸다.', s: {t:2, j:1} },
      { text: '"에고, 얼마나 머리가 아프실꼬..." 사장님 어깨를 주물러주며 따뜻한 꿀물 한 잔을 타다 준다.',    s: {f:2, e:1} },
      { text: '"동전 한두 개 비는 건데 대충 맞다고 쳐요!" 머리 아픈 일은 대충 덮고 퇴근하자고 꼬신다.',       s: {p:2, f:1} },
      { text: '"전 머리 쓰는 건 체질에 안 맞아서요." 사장님을 두고 마당에 나가 무거운 물을 긷거나 장작이나 패러 간다.', s: {s:2, p:1, physical:1} },
      { text: '이 수많은 동전과 영수증 조각들이 모여 이 작은 마을을 굴리는 거대한 유통의 흐름을 혼자 멍하니 상상한다.', s: {n:2, i:1, archmage:1} },
    ]
  },
  /* Q6 */
  { text: '마을 근처 숲에서 붉은 눈을 한 거대 멧돼지가 나타나 울타리를 부수고 돌진해 온다. {nick}의 생각은?',
    choices: [
      { text: '"일단 주변에 단단한 몽둥이가 있나? 저놈이 들이받기 전에 먼저 뚝배기를 깨야겠다."',             s: {s:2, p:1, physical:1} },
      { text: '"평범한 짐승이 아니야. 숲의 결계에 이변이 생겼거나 불길한 기운이 마을을 덮치고 있는 게 분명해."', s: {n:2, i:1, chrono:1} },
      { text: '"큰일 났다, 사람들 대피시켜야 해!" 목청 터져라 비명을 지르며 마을 경비조를 부르러 달린다.',    s: {f:1, e:1, j:1} },
      { text: '일이 커질 것 같으니, 남들이 우왕좌왕할 때 재빨리 튼튼한 주점 지하실로 기어 들어가 문을 잠근다.', s: {i:2, j:1, necro:1} },
      { text: '멧돼지와 눈이 마주친 순간, 두려움 대신 내 온몸의 피가 차갑게 식으면서 묘한 해방감이 느껴진다.', s: {n:1, t:1, archmage:1} },
    ]
  },
  /* Q7 */
  { text: '막다른 길에 몰려 손을 뻗은 순간, 알 수 없는 빛무리가 뿜어져 나와 멧돼지를 잠재웠다. {nick}의 반응은?',
    choices: [
      { text: '"내 손끝에서 마법이 방출됐어. 방금 느꼈던 감각과 손의 각도를 기억해 둬야 해." 현실을 빠르게 접수한다.', s: {s:2, t:1} },
      { text: '"말도 안 돼... 내 안에 마법사의 피가 흐르고 있었던 건가? 전설 속 주인공처럼?" 엄청난 전율을 느낀다.', s: {n:2, f:1} },
      { text: '"야! 너희들 방금 내 손에서 마법 나간 거 봤어?!" 흥분해서 동네 사람들을 붙잡고 당장 자랑하러 간다.', s: {e:2, p:1} },
      { text: '"이게 소문나면 국가 기관에 끌려가서 실험당하는 거 아냐?" 무서워서 입을 꾹 닫고 모른 척 연기한다.', s: {i:2, tInst:1} },
      { text: '내가 뿜어낸 에너지가 주변 대기 속 기운들과 완벽하게 맞물려 조화를 이루었음을 직감적으로 깨닫는다.',  s: {n:1, i:1, archmage:1} },
    ]
  },
  /* Q8 */
  { text: '소문을 듣고 온 마법 학자가 마력을 측정하는 푸른 수정구를 건넸다. {nick}이 구슬을 받아 든 순간?',
    choices: [
      { text: '수정구의 묵직한 무게감, 매끄러운 표면, 그리고 손바닥으로 전해지는 서늘한 감촉을 느껴본다.',     s: {s:2, j:1} },
      { text: '구슬 중심부에서 은하수처럼 요동치는 오로라를 보며, 우주의 깊은 나락이나 우주의 끝을 상상한다.',  s: {n:2, i:1} },
      { text: '혹시 잘못 만졌다가 구슬이 깨지거나 폭발해서 변상해야 할까 봐, 학자가 시키는 대로 잔뜩 쫄아서 다룬다.', s: {tInst:2, i:1} },
      { text: '"에라, 모르겠다!" 하는 배짱으로 내 안의 기운을 수정구에 거침없이 팍 밀어 넣는다.',              s: {a:2, p:1} },
      { text: '도구의 수치 따윈 상관없다. 내 심장 소리와 수정구의 진동 주파수가 완벽히 일치하는 상태를 느껴본다.', s: {n:1, f:1, archmage:1} },
    ]
  },
  /* Q9 */
  { text: '학자가 {nick}을 데려가려 하자 주점 사장님이 눈물을 흘리며 아쉬워한다. 건넨 작별 인사는?',
    choices: [
      { text: '"그동안 감사했습니다. 마법사가 되면 엄청 성공해서 성공 보수 두둑이 챙겨서 올게요."',             s: {t:1, e:1, j:1} },
      { text: '"마침 주점 일도 지루해지던 참이었는데 잘 됐네요. 건강히 계세요." 담담하고 쿨하게 짐을 싼다.',    s: {i:2, p:1, necro:1} },
      { text: '사장님을 껴안고 같이 엉엉 울면서 "사장님 밑에서 일했던 시간 절대 잊지 못할 거예요"라고 슬퍼한다.', s: {f:2, e:1} },
      { text: '"떠나는 건 슬프지만, 제 인생이 새롭게 시작되는 운명적인 순간이겠죠." 애써 감정을 추스른다.',       s: {n:2, j:1, chrono:1} },
      { text: '"가다가 몬스터 만나면 몽둥이 찜질해 줄 테니 걱정 마세요."라며 씩씩하게 주먹을 쥐어 보인다.',      s: {s:1, a:1, physical:1} },
    ]
  },
  /* Q10 */
  { text: '마법학교로 향하는 마차 안. 덜컹거리는 의자에 앉은 {nick}이 한 생각은?',
    choices: [
      { text: '"도착하면 기숙사 배정받고, 수업 시간표 확인하고, 교재부터 사야겠지?" 앞으로의 일정을 순서대로 계획한다.', s: {j:2, s:1} },
      { text: '"마법학교는 어떻게 생겼을까? 밤마다 유령이 돌아다니거나 비밀의 방이 숨겨져 있진 않을까?" 상상의 나래를 편다.', s: {n:2, p:1} },
      { text: '옆자리에 앉은 다른 입학생에게 슬그머니 말을 걸며 "너는 어디서 왔어? 무슨 마법 쓰고 싶어?"라며 친해진다.', s: {e:2, f:1} },
      { text: '마차 창밖으로 멀어지는 풍경을 보며, 낯선 환경에 홀로 던져질 미래에 대한 걱정과 긴장감에 사로잡힌다.',     s: {i:2, tInst:1} },
      { text: '가만히 앉아 가방을 뒤적이더니, 마법이 손에 안 익을 때를 대비해 주먹 쥐는 악력 운동이나 마저 한다.',       s: {s:1, p:1, physical:1} },
    ]
  },
  /* Q11 */
  { text: '마법식 해독 조별 과제 시간, 한 조원이 "미안, 나 몸이 너무 아파서 이번 과제 못 참여할 것 같아"라며 연락 두절됐다.',
    choices: [
      { text: '아프든 말든 조 전체 점수가 깎이니, 일단 교수님 방으로 찾아가 그 조원의 사정을 고하고 조에서 제명시킨다.',   s: {t:2, j:1} },
      { text: '"많이 아픈가 보네..." 걱정스러운 마음에 보건실로 찾아가 죽이라도 전해주거나 약을 챙겨준다.',                s: {f:2, i:1} },
      { text: '팀원들과 싸우거나 설득하는 과정 자체가 스트레스라, 그냥 내가 밤새우고 독박 써서 과제를 끝내버린다.',        s: {i:2, tInst:1} },
      { text: '"아싸 프리덤! 그럼 나도 배째라 하고 안 할래!" 과제고 뭐고 동기들과 술 마시거나 자러 간다.',                s: {p:2, s:1, physical:1} },
      { text: '이 조원이 빠지게 된 돌발 변수마저 완벽한 과제 결과물을 내기 위한 시련의 한 조각이라 생각하고 묵묵히 받아들인다.', s: {n:1, j:1, archmage:1} },
    ]
  },
  /* Q12 */
  { text: '마법 승급 시험을 5분 앞두고, 절친한 동기가 사시나무 떨듯 떨며 미칠 것 같다고 울먹인다.',
    choices: [
      { text: '"야, 긴장할 시간에 네가 외운 마법 주문 스펠링이나 세 줄 더 읽어. 그게 살길이야."',                s: {t:2, s:1} },
      { text: '"너 지난달에 나랑 밤새 연습했잖아! 넌 무조건 붙어. 내가 보장해!" 손을 꼭 잡아주며 기운을 불어넣는다.', s: {f:2, e:1} },
      { text: '동기의 눈물과 극도의 불안감이 나에게 그대로 전염되어, 내 손끝까지 같이 달달 떨리기 시작한다.',          s: {tInst:2, f:1} },
      { text: '"까짓거 떨어지면 내년에 다시 보지 뭐! 마법사 안 되면 나랑 주점이나 차리자."라며 대수롭지 않게 웃어넘긴다.', s: {p:2, a:1} },
      { text: '극도의 긴장 상태에서 발생하는 마력의 과부하 현상에 대해 이론을 장황하게 설명해 준다.',                  s: {t:2, n:1} },
    ]
  },
  /* Q13 */
  { text: '실습 교수님이 "학부생 수준에선 절대 풀 수 없는 고대 마법진"을 칠판에 적어놓고 풀어오는 자에게 가산점을 주겠다고 한다.',
    choices: [
      { text: '도서관의 퀴퀴한 고서적을 모조리 탑처럼 쌓아두고, 밤새도록 법칙과 공식을 대조해가며 정석대로 풀어낸다.',   s: {t:2, j:1} },
      { text: '규칙에 얽매이지 않고, 마법진의 구도와 기하학적 문양을 보며 출제한 교수의 숨겨진 의도와 본질을 꿰뚫어 보려 한다.', s: {n:2, i:1, chrono:1} },
      { text: '학교에서 대가리 좀 굴린다는 천재 동기들을 싹 모아서 "우리 집단지성으로 상금 반띵하자!"라며 스터디를 결성한다.', s: {e:2, p:1} },
      { text: '칠판 앞으로 당당히 걸어 나가 "교수님, 이 공식은 여기 시공간 축이 뒤틀려 있어서 애초에 모순입니다"라며 도발적인 질문을 던진다.', s: {a:2, t:1} },
      { text: '칠판의 복잡한 기호를 보자마자 멀미가 나서, 책상을 밀치고 훈련장에 나가 샌드백이나 터지도록 때린다.',       s: {s:2, p:1, physical:1} },
    ]
  },
  /* Q14 */
  { text: '친한 친구가 학칙을 어기고 밤중에 금서 구역에 잠입하려다 경비 골렘에게 걸릴 위기다. 도움을 요청한다면?',
    choices: [
      { text: '"미쳤어? 걸리면 정학이야!" 친구를 거칠게 제지하고 당장 기숙사로 끌고 돌아온다.',                  s: {t:2, j:2} },
      { text: '"위험해!" 골렘의 시선을 돌리기 위해 반대편 복도에 화염 마법을 터트려 소란을 피우며 친구를 필사적으로 구한다.', s: {f:2, p:1} },
      { text: '골렘의 순찰 경로, 시간표, 사각지대를 완벽하게 계산해서 친구가 안 걸리고 들어갈 수 있는 침투 루트를 설계해 준다.', s: {j:2, n:1} },
      { text: '"와, 개꿀잼 스릴러네? 나도 껴줘!" 스릴을 즐기며 친구의 소매를 잡고 같이 금서 구역으로 슬쩍 잠입한다.', s: {p:2, e:1} },
      { text: '"난 모르는 일이다." 엮이기 싫어서 들은 척도 안 하고 조용히 내 침대에 누워 이불을 머리 끝까지 덮는다.', s: {i:2, j:1, necro:1} },
    ]
  },
  /* Q15 */
  { text: '강당에서 동기의 마법 폭주로 화염 폭발이 일어나 사방이 아수라장이 됐다. 다친 사람은 없다. {nick}의 생각은?',
    choices: [
      { text: '"불꽃의 색을 보니 불순물이 섞였군. 마력 농도 조절을 실패해서 일어난 전형적인 연쇄 폭발이야." 원인을 짚는다.', s: {t:2, s:1} },
      { text: '가슴을 쓸어내리며 울고 있는 사고 친 동기에게 다가가 파르르 떠는 손을 잡아주며 다독인다.',              s: {f:2, e:1} },
      { text: '"폭발하는 순간 불꽃 파편들이 마치 밤하늘에 흩어지는 유성우 같았어..." 묘한 예술적 감상에 젖는다.',      s: {n:2, p:1} },
      { text: '아수라장이 되든 말든, 연기 속에서 묵묵히 걸어 나와 내 가방과 교과서가 무사한지부터 챙긴다.',           s: {i:2, t:1, necro:1} },
      { text: '불길이 치솟고 비명이 난무하는 지옥도 속에서도 내 심장은 호수처럼 완벽한 평정심을 유지한다.',            s: {i:1, j:1, archmage:1} },
    ]
  },
  /* Q16 */
  { text: '마탑에 입성하자마자 왕국 변경의 결계가 무너져 강력한 마수들이 국경을 넘어오고 있다는 비보가 들렸다. 탑주가 출전 명령을 내렸을 때 {nick}은?',
    choices: [
      { text: '"결계 보수팀, 선봉 전투팀, 보급팀의 인원 배치부터 확인하죠." 전장의 타임라인과 작전 계획부터 요구한다.', s: {j:2, t:1} },
      { text: '"계획을 짤 시간이 어딨어! 지금 당장 말 타고 달려서 대가리부터 깨부숩시다!" 본능이 이끄는 대로 무기를 챙긴다.', s: {p:2, s:1, physical:1} },
      { text: '마탑의 고참 마법사들에게 먼저 달려가 "선배님들, 과거 이런 국경 전투에서 가장 효과적이었던 전술이 뭡니까?"라며 조언을 구한다.', s: {e:2, s:1} },
      { text: '무시무시한 마수들과 맞서 싸우다 내가 끔찍하게 죽거나 불구가 되는 비참한 미래가 상상되어 온몸에 소름이 돋는다.', s: {tInst:2, n:1} },
      { text: '"내가 나설 때가 됐군." 내 강력한 마법으로 국경을 초토화하고 영웅이 되어 돌아올 내 모습을 확신하며 미소 짓는다.', s: {a:2, n:1} },
    ]
  },
  /* Q17 */
  { text: '마수들이 점령한 고대 유적지 지하 깊은 곳에 침투했다. 사방이 미로 같은 통로인데, 어디선가 기이한 유령들의 울음소리가 들려온다.',
    choices: [
      { text: '지도를 꺼내 우리가 걸어온 거리와 꺾은 방향을 철저히 기록하며, 함정을 피할 안전한 동선으로만 전진한다.',   s: {j:2, s:1} },
      { text: '지도 따윈 던져버리고, 벽면에 새겨진 고대 문자들의 마력 잔해를 직관적으로 느끼며 발길 닿는 대로 간다.',     s: {p:2, n:1} },
      { text: '유령들의 슬픈 곡소리를 가만히 듣다가, 이들이 억울하게 죽어 유적에 묶인 원혼들임을 깨닫고 가슴 아파한다.',  s: {f:2, n:1} },
      { text: '"드디어 쓸만한 시체와 영혼들이 널려있군." 남들은 공포에 질릴 때, 유령들을 내 소환수로 부릴 생각에 눈을 빛낸다.', s: {i:2, t:1, necro:1} },
      { text: '미로의 벽을 만지는 순간, 이 공간의 시간이 과거 유적이 번성했던 시절로 뒤틀리며 공간의 본질이 뇌리에 스쳐 지나간다.', s: {n:2, i:1, chrono:1} },
    ]
  },
  /* Q18 */
  { text: '유적의 중심부에서 대선배 마법사가 왕국을 배신하고 마수들과 결탁해 봉인을 풀고 있는 현장을 목격했다. 그가 {nick}에게 "나와 손을 잡으면 무한한 마력을 주겠다"고 유혹한다면?',
    choices: [
      { text: '"배신자의 말은 통계적으로 신뢰도가 제로다." 그의 말을 칼같이 씹고 주문을 완성하기 전에 마법 미사일을 날려 선빵을 친다.', s: {t:2, a:1} },
      { text: '"선배님이 어떻게 왕국을 배신할 수가 있어요?!" 엄청난 충격과 배신감에 휩싸여 소리치며 분노한다.',          s: {f:2, e:1} },
      { text: '"손을 잡는 척하면서 뒤통수를 칠까? 아니면 경비대를 기다릴까?" 리스크와 보상을 끊임없이 저울질하며 섣불리 움직이지 못한다.', s: {tInst:2, j:1} },
      { text: '"딜 걸어줘서 고맙네." 내 마법 능력이면 배신자고 마수고 혼자서 다 쌈 싸 먹을 수 있다는 자신감으로 정면 돌파한다.', s: {a:2, p:1} },
      { text: '"이 배신 또한 거대한 운명의 흐름 중 하나인가." 깊은 탄식과 함께, 그의 폭주를 막고 인과율을 바로잡기 위해 묵묵히 지팡이를 다잡으며 전투를 준비한다.', s: {n:1, i:1, archmage:1} },
    ]
  },
  /* Q19 */
  { text: '격렬한 전투 끝에 배신자를 제압했지만, 유적이 무너지며 시공간의 균열이 발생해 주변의 모든 사물이 왜곡되기 시작한다. 절체절명의 순간 {nick}은?',
    choices: [
      { text: '내 남은 마력의 수치와 탈출구까지의 거리를 냉정하게 계산한 뒤, 가장 생존 확률이 높은 루트로 앞장서서 달린다.', s: {t:2, j:1} },
      { text: '"다들 내 뒤로 숨어!" 무너지는 돌덩이들을 온몸으로 받아치거나 맨몸으로 동기들을 밀쳐내며 육탄전으로 길을 개척한다.', s: {s:2, f:1, physical:1} },
      { text: '"이 균열의 주파수를 맞추면 시공간을 고정할 수 있어!" 무너지는 와중에 균열의 우주적 역학 구조를 해독하려 든다.', s: {n:2, i:1, chrono:1} },
      { text: '탈출구가 무너져 갇힐지 모른다는 극도의 공포감에 사로잡혀 머릿속이 하얘지고 다리가 풀려버린다.',             s: {tInst:2, p:1} },
      { text: '"내가 죽을 리가 없지." 균열이 나를 삼키기 직전, 승리의 미소를 지으며 내 안의 잠재력을 폭발시켜 균열 자체를 찢어버릴 준비를 한다.', s: {a:2, p:1} },
    ]
  },
  /* Q20 */
  { text: '위기를 해결하고 영웅의 칭호를 받으며 마탑의 최상층 창밖으로 왕국의 평화를 바라본다. 거울에 비친 {nick}의 모습을 보며 드는 마지막 생각은?',
    choices: [
      { text: '"완벽했어. 내 치밀한 계획과 강력한 마법이 왕국을 구했군. 이제 다음 목표를 세워볼까?"',                 s: {j:2, a:1} },
      { text: '"앞으로 또 어떤 강력한 마수와 다이내믹한 모험이 날 기다리고 있을까? 벌써 심장이 뛰네!"',               s: {p:2, e:1} },
      { text: '"내가 영웅이 되다니 믿기지 않아... 주점 알바부터 여기까지 나를 도와준 모든 인연에게 감사하자." 눈시울이 붉어진다.', s: {f:2, i:1} },
      { text: '"영웅 대접은 귀찮아 죽겠네." 훈장과 자리를 다 내팽개치고, 조용히 탑 지하 방구석으로 돌아가 아무도 안 만날 생각에 신이 난다.', s: {i:2, p:1, necro:1} },
      { text: '주점에서 눈을 뜬 첫날부터 마탑의 정점에 서기까지, 이 모든 모험이 거대한 운명의 실타래대로 완벽히 흘러왔음을 깨닫고 미소 짓는다.', s: {n:2, j:1, chrono:1} },
    ]
  },
];


/* ───────────────────────────────────────
   6. 마법사 클래스 데이터 (32종 속성 개편 + 히든 4종)
─────────────────────────────────────── */
const WIZARD_DATA = {
  /* ── 32 일반 클래스 (속성 중심 개편) ── */
  ISTJ: {
    full: '만년설을 통제하는 절대 영도 빙결 마법사',
    color: '#a8d8ea',
    desc: '흔들리지 않는 원칙과 냉철한 판단력이 당신의 마법을 완성합니다. <em>당신의 빙결 마법진은 적의 발걸음을 허용하지 않으며</em>, 어떤 혼돈 속에서도 질서를 되찾는 마법사입니다.',
  },
  ISFJ: {
    full: '상처를 씻어내는 성스러운 정화 수마법사',
    color: '#74b9ff',
    desc: '흘러내리는 물처럼 조용하지만, 닿는 모든 상처를 씻어냅니다. <em>당신의 정화 마법은 몸뿐 아니라 영혼의 흉터까지 지웁니다.</em> 전장에서 가장 필요한 마법사.',
  },
  INFJ: {
    full: '새벽빛으로 미래를 비추는 새벽 별자리 마법사',
    color: '#a29bfe',
    desc: '아직 오지 않은 새벽을 먼저 보는 자. <em>별자리 속에 숨겨진 운명의 실을 읽어내며</em>, 당신의 예언은 늘 시대보다 반보 앞서 있습니다.',
  },
  INTJ: {
    full: '공간을 붕괴시키는 중력 붕괴 마법사',
    color: '#6c5ce7',
    desc: '감정이 끼어들 틈 없이, 전장을 중력 방정식으로 치환하는 냉철한 설계자. <em>당신의 중력 마법 앞에서 적의 모든 전술은 무의미해집니다.</em>',
  },
  ISTP: {
    full: '무기에 번개를 감아 쓰는 뇌전 마도 검사',
    color: '#fdcb6e',
    desc: '이론보다 손끝의 감각이 먼저. 날이 선 검에 번개를 흘려 넣는 순간 <em>당신은 마법사인지 검사인지 경계가 사라집니다.</em> 그 날카로움이 당신만의 무기.',
  },
  ISFP: {
    full: '대지의 숨결을 유영하는 바람 친화 마법사',
    color: '#55efc4',
    desc: '숲의 바람이 당신의 이름을 먼저 부릅니다. 언어 없이도 자연과 교감하며 <em>당신의 바람 마법은 어떤 강제력도 없이, 그저 자연스럽게 세계를 감쌉니다.</em>',
  },
  INFP: {
    full: '꿈과 기억을 엮는 은하수 환영 마법사',
    color: '#fd79a8',
    desc: '꿈과 현실의 경계를 지우는 마법사. 당신이 펼치는 환영은 너무나 아름다워 <em>적조차 무기를 내려놓게 만듭니다.</em> 그 따뜻한 이상주의가 세계를 조용히 바꿉니다.',
  },
  INTP: {
    full: '심연을 해독하는 암흑 균열 마법사',
    color: '#636e72',
    desc: '마법의 근원을 해체하고 재조립하는 이론의 거인. <em>어둠 속 균열 너머에 무엇이 있는지 당신만이 압니다.</em> 한번 이해한 마법은 세상에서 가장 완벽하게 구현됩니다.',
  },
  ESTP: {
    full: '전장을 가르는 청뢰 폭격 마법사',
    color: '#0984e3',
    desc: '계획보다 본능이 먼저. 전장의 카오스 속에서 오히려 가장 빛나는 마법사. <em>청색 번개가 하늘을 가르는 순간, 당신은 이미 세 걸음 앞에 있습니다.</em>',
  },
  ESFP: {
    full: '폭죽처럼 사방을 물들이는 오색 불꽃 마법사',
    color: '#e17055',
    desc: '빛과 음악과 불꽃을 하나로 엮어 세상을 무대로 만드는 마법사. <em>당신이 마법을 펼치면 전쟁터도 축제가 됩니다.</em> 그 화려함이 당신의 진짜 힘.',
  },
  ENFP: {
    full: '태풍을 몰고 다니는 폭풍 소환 마법사',
    color: '#00b894',
    desc: '정령들은 계약서보다 당신의 눈빛을 믿습니다. <em>당신이 두 팔을 벌리면 태풍이 따라옵니다.</em> 무한한 가능성을 꿈꾸는 당신 곁에 언제나 새로운 바람이 불어옵니다.',
  },
  ENTP: {
    full: '상식을 태워버리는 흑염독 폭발 마법사',
    color: '#6d214f',
    desc: '마법학교 교수들이 가장 골치 아파하는 학생. <em>기존의 마법 법칙을 비틀고 역이용하는 당신의 흑염독 마법</em>은 아무도 예측할 수 없는 파괴력을 지닙니다.',
  },
  ESTJ: {
    full: '철벽을 세우는 강철 대지 마법사',
    color: '#b2bec3',
    desc: '마탑의 위계 질서는 당신이 세웠습니다. <em>대지를 밀어 올려 만든 당신의 철벽 결계</em>는 어떤 공격도 허용하지 않으며, 수백 명의 마법사를 하나의 의지로 움직입니다.',
  },
  ESFJ: {
    full: '마력을 나눠주는 치유의 햇살 마법사',
    color: '#ffeaa7',
    desc: '파티가 무너지지 않는 이유는 당신이 있기 때문입니다. 햇살처럼 따뜻한 마력을 팀원들에게 나눠주며 <em>적절한 순간에 완벽한 지원 마법을 펼칩니다.</em>',
  },
  ENFJ: {
    full: '군중의 심장을 불태우는 서광 염화 마법사',
    color: '#ff7675',
    desc: '당신의 말 한마디가 수천 명의 마력을 동시에 각성시킵니다. <em>새벽 서광과 붉은 화염을 동시에 다루는 당신</em>은 타인의 잠재력을 끌어올리는 것이 가장 강력한 무기입니다.',
  },
  ENTJ: {
    full: '세계를 불로 지배하는 원소 대파멸 폭열 마법사',
    color: '#e84393',
    desc: '불, 물, 바람, 대지 — 모든 원소가 당신의 명령에 복종합니다. <em>마탑의 정점을 향한 당신의 야망은 세계의 지형도까지 바꿀 것입니다.</em> 가장 강력한 원소 지배자.',
  },

  /* ── 히든 클래스 4종 ── */
  ARCHMAGE: {
    full: '전설 속 유일무이한 대마법사',
    color: '#f4c85a',
    isHidden: true,
    desc: '<em>모든 마법의 근원에 닿은 자.</em> 어떤 속성에도 치우치지 않고, 세계의 균형 그 자체가 된 마법사. 이 클래스를 받는 자는 수천 명 중 단 하나. 당신은 마법사가 아니라 마법 그 자체입니다.',
  },
  PHYSICAL: {
    full: '주문보다 주먹이 빠른 물리 마법사',
    color: '#ef5350',
    isHidden: true,
    desc: '<em>마법? 그냥 직접 때리는 게 더 빨라.</em> 마법서보다 악력이 강하고, 주문보다 몸이 먼저 나가는 전설의 클래스. 모든 마법을 물리적 힘으로 치환하는 당신, 마탑 교수들도 포기했습니다.',
  },
  NECROMANCER: {
    full: '망자와 대화하는 은둔형 사령술사',
    color: '#9575cd',
    isHidden: true,
    desc: '<em>산 자보다 죽은 자가 더 편한 자.</em> 어둠 속 혼자가 가장 강한 마법사. 당신의 소환진에서 깨어나는 망자들은 당신만을 주인으로 섬깁니다. 세상이 당신을 외면해도 — 상관없습니다.',
  },
  CHRONOMANCER: {
    full: '시공간을 지배하는 크로노맨서',
    color: '#26c6da',
    isHidden: true,
    desc: '<em>당신에게 시간은 직선이 아닙니다.</em> 과거와 미래가 동시에 보이는 자, 운명의 실타래를 손수 엮는 자. 이 클래스에 도달한 자는 역사 속에 단 몇 명뿐입니다.',
  },
};


/* ───────────────────────────────────────
   7. 결과 판정 로직
─────────────────────────────────────── */
function calcResult() {
  const totalEI = (eScore + iScore) || 1;
  const totalSN = (sScore + nScore) || 1;
  const totalTF = (tScore + fScore) || 1;
  const totalJP = (jScore + pScore) || 1;

  const ePct = eScore / totalEI;
  const iPct = iScore / totalEI;
  const sPct = sScore / totalSN;
  const nPct = nScore / totalSN;
  const tPct = tScore / totalTF;
  const jPct = jScore / totalJP;
  const pPct = pScore / totalJP;

  const balanced = v => v >= 0.45 && v <= 0.55;

  /* 히든 클래스 — 우선순위 순 체크 */
  // 대마법사: 가산점 5점 이상 AND 4개 축 모두 45~55% 균형
  if (hiddenArchmage >= 5 &&
      balanced(ePct) && balanced(sPct) && balanced(tPct) && balanced(jPct)) {
    return { key: 'ARCHMAGE', prefix: '' };
  }
  // 물리 마법사: 가산점 4점 이상 AND S 비율 75% 이상
  if (hiddenPhysical >= 4 && sPct >= 0.75) {
    return { key: 'PHYSICAL', prefix: '' };
  }
  // 은둔형 사령술사: 가산점 4점 이상 AND Extreme I(75%) AND Extreme P(75%)
  if (hiddenNecro >= 4 && iPct >= 0.75 && pPct >= 0.75) {
    return { key: 'NECROMANCER', prefix: '' };
  }
  // 크로노맨서: 가산점 4점 이상 AND N 비율 75% 이상
  if (hiddenChrono >= 4 && nPct >= 0.75) {
    return { key: 'CHRONOMANCER', prefix: '' };
  }

  /* 일반 클래스 */
  const E = ePct >= 0.5 ? 'E' : 'I';
  const S = sPct >= 0.5 ? 'S' : 'N';
  const T = tPct >= 0.5 ? 'T' : 'F';
  const J = jPct >= 0.5 ? 'J' : 'P';
  const key = E + S + T + J;

  /* -A / -T 접두사 */
  const prefix = aScore >= tInstScore ? '각성형' : '심연형';

  return { key, prefix };
}

/* 결과 캐싱 (저장/공유 시 재계산 방지) */
let cachedResult = null;


/* ───────────────────────────────────────
   8. 화면 전환
─────────────────────────────────────── */
function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  const el = document.getElementById(id);
  el.classList.add('active', 'fade-in');
  setTimeout(() => el.classList.remove('fade-in'), 600);
  window.scrollTo(0, 0);
}


/* ───────────────────────────────────────
   9. 테스트 시작
─────────────────────────────────────── */
function startTest() {
  const raw = document.getElementById('nickname-input').value.trim();
  nickname = raw || '견습 마법사';
  resetScores();
  cachedResult = null;
  document.getElementById('mute-toggle').classList.add('visible');
  startBGM();
  showScreen('screen-test');
  renderQuestion(0);
}


/* ───────────────────────────────────────
   10. 문항 렌더링 & 선택 처리
─────────────────────────────────────── */
function renderQuestion(idx) {
  const q    = QUESTIONS[idx];
  const card = document.getElementById('question-card');

  card.style.opacity   = '0';
  card.style.transform = 'translateY(10px)';
  setTimeout(() => {
    card.style.transition = 'opacity 0.4s, transform 0.4s';
    card.style.opacity    = '1';
    card.style.transform  = 'translateY(0)';
  }, 50);

  document.getElementById('question-num').textContent =
    `Q ${String(idx + 1).padStart(2, '0')}`;
  document.getElementById('question-text').innerHTML =
    q.text.replace('{nick}', `<span class="question-nick">${nickname}</span>`);

  const pct = (idx / QUESTIONS.length) * 100;
  document.getElementById('progress-bar').style.width   = `${pct}%`;
  document.getElementById('progress-count').textContent = `${idx + 1} / ${QUESTIONS.length}`;
  document.getElementById('progress-stage').textContent = getStageLabel(idx);

  const wrap   = document.getElementById('choices');
  wrap.innerHTML = '';
  const labels = ['①', '②', '③', '④', '⑤'];

  q.choices.forEach((c, ci) => {
    const btn = document.createElement('button');
    btn.className = 'choice-btn';
    btn.innerHTML =
      `<span class="choice-num">${labels[ci]}</span><span>${c.text}</span>`;
    btn.addEventListener('click', () => onChoiceClick(idx, ci, btn));
    wrap.appendChild(btn);
  });
}

function onChoiceClick(qIdx, cIdx, btn) {
  document.querySelectorAll('.choice-btn')
    .forEach(b => b.style.pointerEvents = 'none');
  btn.classList.add('selected');
  playChoice();

  const sc = QUESTIONS[qIdx].choices[cIdx].s;
  if (sc.e)        eScore        += sc.e;
  if (sc.i)        iScore        += sc.i;
  if (sc.s)        sScore        += sc.s;
  if (sc.n)        nScore        += sc.n;
  if (sc.t)        tScore        += sc.t;
  if (sc.f)        fScore        += sc.f;
  if (sc.j)        jScore        += sc.j;
  if (sc.p)        pScore        += sc.p;
  if (sc.a)        aScore        += sc.a;
  if (sc.tInst)    tInstScore    += sc.tInst;
  if (sc.archmage) hiddenArchmage += sc.archmage;
  if (sc.physical) hiddenPhysical += sc.physical;
  if (sc.necro)    hiddenNecro   += sc.necro;
  if (sc.chrono)   hiddenChrono  += sc.chrono;

  setTimeout(() => {
    currentQ = qIdx + 1;
    if (currentQ < QUESTIONS.length) {
      playNext();
      renderQuestion(currentQ);
    } else {
      showLoading();
    }
  }, 380);
}


/* ───────────────────────────────────────
   11. 로딩 → 결과
─────────────────────────────────────── */
function showLoading() {
  stopBGM();
  showScreen('screen-loading');
  setTimeout(showResult, 3000);
}

function showResult() {
  cachedResult = calcResult();
  const { key, prefix } = cachedResult;
  const data = WIZARD_DATA[key];
  playResult();

  const isHidden = !!data.isHidden;

  /* 태그 */
  const tagEl = document.getElementById('result-tag');
  tagEl.textContent   = isHidden ? '✦ 전설 히든 클래스 각성 ✦' : '⚔ 각성 클래스 판정 완료';
  tagEl.style.color        = isHidden ? data.color : '';
  tagEl.style.borderColor  = isHidden ? data.color : '';

  /* 접두사 */
  const prefixEl = document.getElementById('result-prefix');
  prefixEl.textContent = isHidden ? '【 Hidden Class 】' : `【 ${prefix} 】`;
  prefixEl.style.color = isHidden ? data.color
    : (prefix === '각성형' ? '#f4c85a' : '#9575cd');

  /* 클래스명 */
  document.getElementById('result-class-name').innerHTML =
    `<span style="color:${data.color}">${data.full}</span>`;

  /* 닉네임 */
  document.getElementById('result-nick-line').innerHTML =
    `<strong>${nickname}</strong> 님의 마력이 각성했습니다`;

  /* 설명 */
  document.getElementById('result-desc').innerHTML = data.desc;

  /* 스탯 바 */
  renderStatBars();

  /* 일러스트 */
  renderResultIllust(data.color, isHidden);

  showScreen('screen-result');
}


/* ───────────────────────────────────────
   12. 일러스트 렌더 (캔버스 마법진)
   실제 이미지 교체 방법은 wizard-test.css 주석 참고
─────────────────────────────────────── */
function renderResultIllust(color, isHidden) {
  const canvas = document.getElementById('result-illust-canvas');
  const ctx    = canvas.getContext('2d');
  const cx = 90, cy = 90, r = 80;
  ctx.clearRect(0, 0, 180, 180);

  /* 배경 원 */
  const grad = ctx.createRadialGradient(cx, cy, 10, cx, cy, r);
  grad.addColorStop(0, color + '33');
  grad.addColorStop(1, '#050810');
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fillStyle = grad;
  ctx.fill();

  /* 외곽 링 */
  ctx.beginPath();
  ctx.arc(cx, cy, r - 2, 0, Math.PI * 2);
  ctx.strokeStyle = color + '88';
  ctx.lineWidth   = 1.5;
  ctx.stroke();

  /* 마법진 별 (히든: 8각, 일반: 6각) */
  const pts = isHidden ? 8 : 6;
  ctx.save();
  ctx.translate(cx, cy);
  for (let i = 0; i < pts; i++) {
    ctx.rotate((Math.PI * 2) / pts);
    ctx.beginPath();
    ctx.moveTo(0,       -r * 0.7);
    ctx.lineTo(r * 0.15, -r * 0.25);
    ctx.lineTo(0,       -r * 0.1);
    ctx.lineTo(-r * 0.15, -r * 0.25);
    ctx.closePath();
    ctx.fillStyle   = color + '66';
    ctx.fill();
    ctx.strokeStyle = color;
    ctx.lineWidth   = 0.8;
    ctx.stroke();
  }
  ctx.restore();

  /* 내부 동심원 */
  [0.35, 0.55].forEach((ratio, i) => {
    ctx.beginPath();
    ctx.arc(cx, cy, r * ratio, 0, Math.PI * 2);
    ctx.strokeStyle = color + (i === 0 ? 'aa' : '44');
    ctx.lineWidth   = i === 0 ? 1 : 0.5;
    ctx.stroke();
  });

  /* 중심 점광 */
  const cg = ctx.createRadialGradient(cx, cy, 0, cx, cy, r * 0.2);
  cg.addColorStop(0, color);
  cg.addColorStop(1, 'transparent');
  ctx.beginPath();
  ctx.arc(cx, cy, r * 0.2, 0, Math.PI * 2);
  ctx.fillStyle = cg;
  ctx.fill();
}


/* ───────────────────────────────────────
   13. 성향 스탯 바
─────────────────────────────────────── */
function renderStatBars() {
  const totalEI = (eScore + iScore) || 1;
  const totalSN = (sScore + nScore) || 1;
  const totalTF = (tScore + fScore) || 1;
  const totalJP = (jScore + pScore) || 1;

  const axes = [
    { l: 'E', r: 'I', lv: eScore / totalEI },
    { l: 'S', r: 'N', lv: sScore / totalSN },
    { l: 'T', r: 'F', lv: tScore / totalTF },
    { l: 'J', r: 'P', lv: jScore / totalJP },
  ];

  const wrap = document.getElementById('stat-bars');
  wrap.innerHTML = '';

  axes.forEach(ax => {
    const goRight   = ax.lv >= 0.5;
    const fillPct   = Math.abs(ax.lv - 0.5) * 100;
    const dirClass  = goRight ? '' : 'left';

    wrap.innerHTML += `
      <div class="stat-row">
        <span class="stat-label-l">${ax.l}</span>
        <div class="stat-bar-bg">
          <div class="stat-bar-fill ${dirClass}" data-target="${fillPct}"></div>
        </div>
        <span class="stat-label-r">${ax.r}</span>
      </div>`;
  });

  /* 진입 애니메이션 */
  setTimeout(() => {
    wrap.querySelectorAll('.stat-bar-fill').forEach(el => {
      el.style.width = el.dataset.target + '%';
    });
  }, 300);
}


/* ───────────────────────────────────────
   14. 결과 버튼 기능
─────────────────────────────────────── */
function restartTest() {
  stopBGM();
  resetScores();
  cachedResult = null;
  document.getElementById('mute-toggle').classList.remove('visible');
  showScreen('screen-start');
}

function saveResult() {
  const card = document.getElementById('result-card');
  domtoimage.toPng(card, { quality: 1, bgcolor: '#0e1528' })
    .then(dataUrl => {
      const a      = document.createElement('a');
      a.download   = `마법사_${nickname}.png`;
      a.href       = dataUrl;
      a.click();
    })
    .catch(() => alert('저장에 실패했습니다. 스크린샷을 이용해 주세요.'));
}

function shareResult() {
  if (!cachedResult) cachedResult = calcResult();
  const data = WIZARD_DATA[cachedResult.key];
  const url  = `${location.href.split('?')[0]}?utm_source=share`;
  const text = `나는 "${data.full}"로 각성했다! 당신의 마법사 클래스는? 👉 ${url}`;

  if (navigator.share) {
    navigator.share({ title: '눈 떠보니 마법사', text, url }).catch(() => fallbackShare(text));
  } else {
    fallbackShare(text);
  }
}

function fallbackShare(text) {
  navigator.clipboard.writeText(text)
    .then(() => alert('링크가 클립보드에 복사됐습니다!'))
    .catch(() => alert('공유 텍스트:\n\n' + text));
}

function goToList() {
  location.href = '../../test.html';
}
