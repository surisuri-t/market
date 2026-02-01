
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Difficulty, Category, GameState, GameScenario, GameItem } from './types';
import { generateScenario, testApiKeyConnection } from './services/geminiService';

const App: React.FC = () => {
  const [gameState, setGameState] = useState<GameState>(GameState.LOBBY);
  const [difficulty, setDifficulty] = useState<Difficulty>(Difficulty.EASY);
  const [category, setCategory] = useState<Category>(Category.GROCERY);
  const [scenario, setScenario] = useState<GameScenario | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [prefetchedScenario, setPrefetchedScenario] = useState<GameScenario | null>(null);
  const [isPrefetching, setIsPrefetching] = useState<boolean>(false);
  const [timer, setTimer] = useState<number>(0);
  const [userAnswers, setUserAnswers] = useState<(GameItem | null)[]>([]);
  const [availableOptions, setAvailableOptions] = useState<GameItem[]>([]);
  const [score, setScore] = useState<number>(0);
  const [showHint, setShowHint] = useState<boolean>(false);
  const [hintsRemaining, setHintsRemaining] = useState<number>(1);
  
  // 드래그 앤 드롭 관련 상태
  const [draggedItem, setDraggedItem] = useState<GameItem | null>(null);
  const [dragOriginIdx, setDragOriginIdx] = useState<number | null>(null); // null이면 진열대에서 옴
  const [hoveredSlotIdx, setHoveredSlotIdx] = useState<number | null>(null);

  // API 관리 상태
  const [showApiModal, setShowApiModal] = useState<boolean>(false);
  const [apiTestStatus, setApiTestStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');
  const [inputKey, setInputKey] = useState<string>('');
  const [savedKey, setSavedKey] = useState<string>(localStorage.getItem('GEMINI_API_KEY') || '');

  // 효과음 Ref
  const soundSelect = useRef<HTMLAudioElement | null>(null);
  const soundSuccess = useRef<HTMLAudioElement | null>(null);
  const soundFail = useRef<HTMLAudioElement | null>(null);
  const soundStart = useRef<HTMLAudioElement | null>(null);
  const soundPop = useRef<HTMLAudioElement | null>(null);
  const soundCountdown = useRef<HTMLAudioElement | null>(null);
  const soundPraise = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    // 사운드 자산 로드
    soundSelect.current = new Audio('https://assets.mixkit.co/active_storage/sfx/2571/2571-preview.mp3');
    soundSuccess.current = new Audio('https://assets.mixkit.co/active_storage/sfx/1435/1435-preview.mp3');
    soundFail.current = new Audio('https://assets.mixkit.co/active_storage/sfx/2572/2572-preview.mp3');
    soundStart.current = new Audio('https://assets.mixkit.co/active_storage/sfx/2019/2019-preview.mp3');
    soundPop.current = new Audio('https://assets.mixkit.co/active_storage/sfx/2632/2632-preview.mp3');
    // 힌트 효과음 카운트다운용
    soundCountdown.current = new Audio('https://assets.mixkit.co/active_storage/sfx/1110/1110-preview.mp3');
    // 계산대로 가기 칭찬용
    soundPraise.current = new Audio('https://assets.mixkit.co/active_storage/sfx/2018/2018-preview.mp3');
  }, []);

  const playSound = (type: 'select' | 'success' | 'fail' | 'start' | 'pop' | 'countdown' | 'praise') => {
    let audio = null;
    switch (type) {
      case 'select': audio = soundSelect.current; break;
      case 'success': audio = soundSuccess.current; break;
      case 'fail': audio = soundFail.current; break;
      case 'start': audio = soundStart.current; break;
      case 'pop': audio = soundPop.current; break;
      case 'countdown': audio = soundCountdown.current; break;
      case 'praise': audio = soundPraise.current; break;
    }
    
    if (audio) {
      audio.currentTime = 0;
      audio.play().catch(() => {}); 
    }
  };

  const observationTime = 10; 

  const prefetch = useCallback(async (targetDifficulty: Difficulty, targetCategory: Category) => {
    if (!savedKey && !process.env.API_KEY) return;
    setIsPrefetching(true);
    try {
      const nextScenario = await generateScenario(targetDifficulty, targetCategory, savedKey);
      setPrefetchedScenario(nextScenario);
    } catch (error) {
      console.error("Pre-fetch failed", error);
    } finally {
      setIsPrefetching(false);
    }
  }, [savedKey]);

  useEffect(() => {
    if (gameState === GameState.LOBBY) {
      setPrefetchedScenario(null);
      prefetch(difficulty, category);
    }
  }, [difficulty, category, gameState, prefetch]);

  const startGame = async () => {
    if (prefetchedScenario) {
      setScenario(prefetchedScenario);
      initiateGameSession(prefetchedScenario);
      setPrefetchedScenario(null);
      return;
    }

    setLoading(true);
    try {
      const currentScenario = await generateScenario(difficulty, category, savedKey);
      setScenario(currentScenario);
      initiateGameSession(currentScenario);
    } catch (error: any) {
      console.error("Game Start Error:", error);
      const isOverloaded = error?.message?.includes('503') || error?.status === 'UNAVAILABLE';
      if (isOverloaded) {
        alert("현재 인공지능 마트 직원이 너무 바쁩니다. 잠시 후 다시 '쇼핑 시작하기'를 눌러주세요.");
      } else {
        alert("연결에 문제가 발생했습니다. API 키 설정을 확인하거나 인터넷 연결을 확인해 주세요.");
        setShowApiModal(true);
      }
    } finally {
      setLoading(false);
    }
  };

  const initiateGameSession = (currentScenario: GameScenario) => {
    setGameState(GameState.OBSERVATION);
    setTimer(observationTime);
    setUserAnswers(new Array(currentScenario.items.length).fill(null));
    setScore(0);
    setHintsRemaining(difficulty === Difficulty.HARD ? 2 : 1);
    setShowHint(false);
    
    const pool = [...currentScenario.items, ...currentScenario.decoys].sort(() => Math.random() - 0.5);
    setAvailableOptions(pool);
  };

  const handleSaveKey = () => {
    if (!inputKey.trim()) {
      alert("API 키를 입력해 주세요.");
      return;
    }
    localStorage.setItem('GEMINI_API_KEY', inputKey.trim());
    setSavedKey(inputKey.trim());
    setApiTestStatus('idle');
    alert("API 키가 브라우저에 안전하게 저장되었습니다.");
  };

  const handleClearKey = () => {
    if (window.confirm("정말로 저장된 API 키를 삭제하시겠습니까?")) {
      localStorage.removeItem('GEMINI_API_KEY');
      setSavedKey('');
      setInputKey('');
      setApiTestStatus('idle');
      alert("키가 삭제되었습니다.");
    }
  };

  const runConnectionTest = async () => {
    setApiTestStatus('testing');
    const success = await testApiKeyConnection(savedKey);
    setApiTestStatus(success ? 'success' : 'error');
  };

  const goHome = () => {
    setGameState(GameState.LOBBY);
    setScenario(null);
  };

  useEffect(() => {
    let interval: any;
    if (gameState === GameState.OBSERVATION && timer > 0) {
      interval = setInterval(() => {
        setTimer((prev) => prev - 1);
      }, 1000);
    } else if (gameState === GameState.OBSERVATION && timer === 0) {
      setGameState(GameState.FILL_GAPS);
    }
    return () => clearInterval(interval);
  }, [gameState, timer]);

  const handleSelectOption = (item: GameItem) => {
    const isUsed = userAnswers.some(a => a?.id === item.id);
    if (isUsed) return;
    
    const emptyIdx = userAnswers.findIndex(a => a === null);
    if (emptyIdx !== -1) {
      playSound('select');
      const newAnswers = [...userAnswers];
      newAnswers[emptyIdx] = item;
      setUserAnswers(newAnswers);
    }
  };

  const handleDragStart = (item: GameItem, originIdx: number | null = null) => {
    setDraggedItem(item);
    setDragOriginIdx(originIdx);
  };

  const handleDragOver = (e: React.DragEvent, idx: number) => {
    e.preventDefault();
    setHoveredSlotIdx(idx);
  };

  const handleDragLeave = () => {
    setHoveredSlotIdx(null);
  };

  const handleDrop = (targetIdx: number) => {
    if (!draggedItem) return;

    const newAnswers = [...userAnswers];

    if (dragOriginIdx !== null) {
      // 바구니 내부 이동 (슬롯 -> 슬롯)
      if (dragOriginIdx === targetIdx) {
        // 제자리 드랍
      } else {
        playSound('select');
        const targetItem = newAnswers[targetIdx];
        newAnswers[targetIdx] = draggedItem;
        newAnswers[dragOriginIdx] = targetItem; // 교체 또는 null로 이동
      }
    } else {
      // 진열대에서 이동 (진열대 -> 슬롯)
      const alreadyInBasket = newAnswers.some(a => a?.id === draggedItem.id);
      if (!alreadyInBasket) {
        playSound('select');
        newAnswers[targetIdx] = draggedItem;
      }
    }
    
    setUserAnswers(newAnswers);
    setDraggedItem(null);
    setDragOriginIdx(null);
    setHoveredSlotIdx(null);
  };

  const removeAnswer = (idx: number) => {
    playSound('pop');
    const newAnswers = [...userAnswers];
    newAnswers[idx] = null;
    setUserAnswers(newAnswers);
  };

  const getHintDuration = () => {
    if (difficulty === Difficulty.EASY) return 3000;
    return 5000;
  };

  const useHint = () => {
    if (hintsRemaining <= 0 || showHint) return;
    playSound('countdown');
    setShowHint(true);
    setHintsRemaining(prev => prev - 1);
    setTimeout(() => {
      setShowHint(false);
      if (soundCountdown.current) {
        soundCountdown.current.pause();
        soundCountdown.current.currentTime = 0;
      }
    }, getHintDuration());
  };

  const checkResults = () => {
    if (!scenario) return;
    
    playSound('praise'); 

    let correctCount = 0;
    userAnswers.forEach((answer, idx) => {
      if (answer && answer.id === scenario.items[idx].id) {
        correctCount++;
      }
    });
    setScore(correctCount);
    
    setTimeout(() => {
      if (correctCount === scenario.items.length) {
        playSound('success'); 
      } else if (correctCount >= (scenario.items.length / 2)) {
        playSound('success'); 
      } else {
        playSound('fail'); 
      }
      setGameState(GameState.RESULT);
    }, 800);
  };

  const getCategoryIcon = (cat: Category) => {
    switch (cat) {
      case Category.GROCERY: return '🛒';
      case Category.STATIONERY: return '✏️';
      case Category.FRUIT: return '🍎';
      case Category.ELECTRONICS: return '📺';
      case Category.CLOTHING: return '👕';
      case Category.CLEANING: return '🧹';
      case Category.TRAVEL: return '✈️';
      case Category.DINING: return '🍱';
      default: return '🛍️';
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 transition-colors duration-500 bg-slate-950">
      {/* API Key Modal */}
      {showApiModal && (
        <div className="fixed inset-0 bg-black/90 z-[100] flex items-center justify-center p-4 backdrop-blur-md animate-fadeIn">
          <div className="bg-slate-900 rounded-[2.5rem] shadow-2xl max-w-lg w-full p-8 border-4 border-slate-800 relative overflow-hidden text-slate-100">
            <div className="absolute top-0 left-0 w-full h-4 bg-emerald-800"></div>
            <button 
              onClick={() => { setShowApiModal(false); }}
              className="absolute top-4 right-4 text-3xl text-slate-500 hover:text-slate-200 transition-colors"
            >
              ✕
            </button>
            <div className="text-center">
              <div className="text-5xl mb-4">⚙️</div>
              <h2 className="text-3xl font-black text-white mb-4">API 키 설정</h2>
              
              <div className="mb-6 text-left">
                <label className="block text-lg font-bold text-slate-400 mb-2">Gemini API 키 입력</label>
                <div className="flex flex-col gap-3">
                  <input
                    type="password"
                    value={inputKey}
                    onChange={(e) => setInputKey(e.target.value)}
                    placeholder={savedKey ? "••••••••••••••••" : "키를 여기에 붙여넣으세요"}
                    className="w-full px-4 py-3 bg-slate-800 border-2 border-slate-700 rounded-xl text-xl focus:border-emerald-500 outline-none transition-all text-white"
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={() => { handleSaveKey(); }}
                      className="flex-1 py-3 bg-emerald-700 text-white text-xl font-black rounded-xl hover:bg-emerald-800 transition-all shadow-md active:translate-y-1"
                    >
                      저장하기
                    </button>
                    <button
                      onClick={() => { handleClearKey(); }}
                      className="px-6 py-3 bg-red-900/30 text-red-400 text-lg font-black rounded-xl border-2 border-red-900/50 hover:bg-red-900/50 transition-all"
                    >
                      삭제
                    </button>
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t-2 border-slate-800 mb-6">
                <button
                  onClick={() => { runConnectionTest(); }}
                  disabled={apiTestStatus === 'testing' || (!savedKey && !inputKey)}
                  className={`w-full py-4 text-xl font-black rounded-xl border-2 transition-all shadow-sm ${
                    apiTestStatus === 'testing' ? 'bg-slate-800 text-slate-500 border-slate-700' :
                    apiTestStatus === 'success' ? 'bg-emerald-900/50 text-emerald-300 border-emerald-800' :
                    apiTestStatus === 'error' ? 'bg-red-900/50 text-red-300 border-red-800' :
                    'bg-slate-800 text-slate-200 border-slate-700 hover:bg-slate-700'
                  }`}
                >
                  {apiTestStatus === 'testing' ? '연결 확인 중...' : 
                   apiTestStatus === 'success' ? '✅ 연결 성공!' : 
                   apiTestStatus === 'error' ? '❌ 연결 실패' : 
                   '📡 연결 테스트'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Header with Settings Icon at Right and Home Button at the far Left End */}
      <header className="mb-4 w-full max-w-4xl bg-emerald-900 text-white p-6 rounded-t-[1.5rem] shadow-2xl text-center relative overflow-hidden border-b-4 border-emerald-950">
        <div className="absolute top-0 left-0 w-full h-1.5 bg-yellow-600"></div>
        
        {/* Home Button - Far Left End of the Header */}
        {gameState !== GameState.LOBBY && (
          <button 
            onClick={goHome}
            className="absolute left-6 top-1/2 -translate-y-1/2 bg-white/10 hover:bg-white/20 p-3 rounded-full transition-all shadow-sm border border-white/20 z-10"
            title="홈으로"
          >
            <span className="text-3xl">🏠</span>
          </button>
        )}

        <div className="flex items-center justify-center gap-3 mb-1">
          <span className="text-5xl drop-shadow-md">{getCategoryIcon(category)}</span>
          <h1 className="text-4xl font-black tracking-tighter">메모리 마트</h1>
        </div>
        
        <p className="text-xl font-bold opacity-80">어르신들을 위한 장보기 기억력 게임</p>
        
        {/* Settings Icon - Far Right End of Header Area */}
        <button 
          onClick={() => { setShowApiModal(true); }}
          className="absolute top-1/2 -translate-y-1/2 right-6 bg-white/10 hover:bg-white/20 p-3 rounded-full transition-all shadow-sm border border-white/20 group"
          title="설정"
        >
          <span className="text-3xl group-hover:rotate-90 transition-transform block">⚙️</span>
        </button>
      </header>

      {/* Main Game Area */}
      <main className="w-full max-w-4xl bg-slate-900 shadow-[0_20px_40px_-10px_rgba(0,0,0,0.8)] rounded-b-[2.5rem] p-8 mart-border min-h-[550px] flex flex-col relative animate-fadeIn border-x-4 border-slate-800">
        
        {gameState === GameState.LOBBY && (
          <div className="flex-1 flex flex-col items-center justify-around space-y-6">
            <div className="text-center w-full">
              <p className="text-3xl text-emerald-100 mb-6 font-black">오늘의 미션 선택</p>
              <div className="flex flex-wrap gap-3 justify-center">
                {(Object.values(Category) as Category[]).map((cat) => (
                  <button
                    key={cat}
                    onClick={() => { setCategory(cat); }}
                    className={`px-5 py-3 rounded-xl text-lg font-black transition-all shadow-sm flex items-center gap-2 border-2 ${
                      category === cat 
                        ? 'bg-emerald-700 text-white border-emerald-600 scale-105 shadow-md ring-2 ring-emerald-900/50' 
                        : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
                    }`}
                  >
                    <span className="text-2xl">{getCategoryIcon(cat)}</span>
                    {cat}
                  </button>
                ))}
              </div>
            </div>

            <div className="text-center w-full">
              <p className="text-3xl text-emerald-100 mb-6 font-black">난이도 설정</p>
              <div className="flex flex-wrap gap-4 justify-center">
                {(Object.values(Difficulty) as Difficulty[]).map((level) => (
                  <button
                    key={level}
                    onClick={() => { setDifficulty(level); }}
                    className={`px-12 py-6 rounded-2xl text-2xl font-black transition-all shadow-md border-b-8 active:border-b-0 active:translate-y-1 ${
                      difficulty === level 
                        ? 'bg-slate-200 text-slate-900 border-slate-400 scale-110' 
                        : 'bg-slate-800 text-slate-400 border-slate-700 hover:bg-slate-700'
                    }`}
                  >
                    {level}
                  </button>
                ))}
              </div>
            </div>

            <div className="relative pt-4">
              <button
                onClick={startGame}
                disabled={loading}
                className="px-20 py-8 bg-emerald-700 text-white text-4xl font-black rounded-full shadow-[0_10px_0_rgb(6,95,70)] hover:bg-emerald-800 transition-all active:shadow-none active:translate-y-2 disabled:bg-slate-700 disabled:text-slate-500 disabled:shadow-none"
              >
                {loading ? '상품 준비 중...' : '쇼핑 시작하기'}
              </button>
              {isPrefetching && !loading && (
                <div className="absolute -bottom-10 left-1/2 -translate-x-1/2 text-emerald-500 font-bold animate-pulse text-xl whitespace-nowrap">
                  카트 준비 중...
                </div>
              )}
            </div>
          </div>
        )}

        {gameState === GameState.OBSERVATION && scenario && (
          <div className="flex-1 flex flex-col animate-fadeIn mt-2">
            <div className="flex justify-between items-center mb-6 bg-slate-950/50 p-6 rounded-2xl border-2 border-slate-800 shadow-xl">
              <div className="flex items-center gap-4">
                <span className="text-4xl">🏪</span>
                <h2 className="text-3xl font-black text-emerald-300">{scenario.theme}</h2>
              </div>
              <div className="bg-red-900/90 px-8 py-4 rounded-xl shadow-lg border-b-4 border-red-950">
                <span className="text-3xl font-black text-white">시간: {timer}초</span>
              </div>
            </div>
            
            <p className="text-2xl text-slate-200 mb-10 font-black text-center py-6 bg-slate-800/50 rounded-2xl border-2 border-slate-700 animate-pulse">
              아래 상품들의 <span className="text-emerald-400 underline decoration-4">순서</span>를 기억해 주세요!
            </p>

            <div className={`grid gap-5 justify-center ${
              scenario.items.length <= 5 ? 'grid-cols-5' : 
              scenario.items.length <= 7 ? 'grid-cols-7' : 'grid-cols-9'
            }`}>
              {scenario.items.map((item, idx) => (
                <div key={item.id} className="flex flex-col items-center p-5 bg-slate-800 rounded-[2rem] border-4 border-slate-700 shadow-2xl hover:border-emerald-500 transition-colors">
                  <span className="text-xl font-black bg-yellow-600 px-4 py-1.5 rounded-full mb-4 text-slate-900">{idx + 1}번</span>
                  <div className="text-7xl mb-4 drop-shadow-md">{item.icon}</div>
                  <div className="text-xl font-black text-white text-center leading-tight">{item.name}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {gameState === GameState.FILL_GAPS && scenario && (
          <div className="flex-1 flex flex-col animate-fadeIn mt-2">
            {showHint && (
              <div className="absolute inset-0 bg-slate-950/98 z-[60] flex flex-col items-center justify-center p-6 backdrop-blur-lg">
                <div className="bg-slate-900 p-10 rounded-[3rem] shadow-2xl border-8 border-red-900 text-center max-w-5xl w-full">
                  <h3 className="text-4xl font-black text-red-400 mb-10">⚠️ 정답을 다시 보여드릴게요! ({getHintDuration() / 1000}초)</h3>
                  <div className="flex flex-wrap justify-center gap-6">
                    {scenario.items.map((item, idx) => (
                      <div key={`hint-${idx}`} className="flex flex-col items-center p-5 bg-slate-800 rounded-3xl border-2 border-slate-700 w-40">
                        <span className="text-6xl mb-3">{item.icon}</span>
                        <span className="text-xl font-black text-white mb-2">{item.name}</span>
                        <span className="text-lg font-black bg-emerald-800 text-white px-4 py-1 rounded-full">{idx + 1}번</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            <div className="flex justify-between items-center mb-6">
              <div className="flex items-center gap-4">
                <div className="bg-yellow-700 p-4 rounded-2xl shadow-md">
                  <span className="text-3xl">🛒</span>
                </div>
                <div>
                  <h2 className="text-3xl font-black text-white">바구니에 순서대로 담기</h2>
                  <p className="text-xl text-emerald-400 font-bold italic">{scenario.theme}</p>
                </div>
              </div>
              <div className="flex flex-col items-end gap-2">
                <button
                  onClick={useHint}
                  disabled={hintsRemaining <= 0 || showHint}
                  className={`px-8 py-4 rounded-xl text-xl font-black transition-all shadow-md border-b-4 ${
                    hintsRemaining <= 0 ? 'bg-slate-800 text-slate-600 border-slate-700 opacity-50' : 'bg-red-800 text-white border-red-950 hover:bg-red-700 active:translate-y-1'
                  }`}
                >
                  {hintsRemaining <= 0 ? '힌트 모두사용' : `힌트 보기 (${getHintDuration() / 1000}초)`}
                </button>
                {difficulty === Difficulty.HARD && (
                  <span className="text-white font-bold bg-slate-800 px-3 py-1 rounded-full text-sm">남은 힌트: {hintsRemaining}회</span>
                )}
              </div>
            </div>

            <p className="text-lg font-bold text-emerald-500 mb-4 text-center animate-pulse">💡 상품을 클릭하거나 다른 번호로 끌어서 옮기세요!</p>

            {/* User Basket Slots */}
            <div className={`grid gap-4 mb-10 ${
              scenario.items.length <= 5 ? 'grid-cols-5' : 
              scenario.items.length <= 7 ? 'grid-cols-7' : 'grid-cols-9'
            }`}>
              {userAnswers.map((answer, idx) => (
                <div 
                  key={`slot-${idx}`}
                  onDragOver={(e) => handleDragOver(e, idx)}
                  onDragLeave={handleDragLeave}
                  onDrop={() => handleDrop(idx)}
                  draggable={answer !== null}
                  onDragStart={() => answer && handleDragStart(answer, idx)}
                  onClick={() => answer && removeAnswer(idx)}
                  className={`cursor-pointer flex flex-col items-center justify-center p-4 min-h-[160px] rounded-[1.5rem] border-4 border-dashed transition-all transform ${
                    hoveredSlotIdx === idx ? 'bg-emerald-900/40 border-emerald-400 scale-105 ring-4 ring-emerald-500/20' :
                    answer ? 'bg-slate-800 border-emerald-500 shadow-2xl ring-2 ring-emerald-900/50 scale-100 hover:border-emerald-400 cursor-grab active:cursor-grabbing' : 'bg-slate-950 border-slate-700 scale-100'
                  }`}
                >
                  <span className={`text-lg font-black mb-3 transition-colors ${hoveredSlotIdx === idx ? 'text-emerald-300' : 'text-slate-500'}`}>
                    {idx + 1}번
                  </span>
                  {answer ? (
                    <div className="animate-fadeIn text-center pointer-events-none">
                      <div className="text-6xl mb-2">{answer.icon}</div>
                      <div className="text-lg font-black text-white leading-tight">{answer.name}</div>
                      <span className="inline-block mt-3 text-xs bg-slate-700/80 text-slate-300 px-2 py-1 rounded-full font-bold">클릭시 빼기</span>
                    </div>
                  ) : (
                    <div className={`text-5xl font-black transition-colors ${hoveredSlotIdx === idx ? 'text-emerald-500 animate-bounce' : 'text-slate-800'}`}>
                      {hoveredSlotIdx === idx ? '📦' : '?'}
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Display Shelf */}
            <div className="bg-slate-950/60 p-8 rounded-[2.5rem] border-4 border-slate-800 shadow-inner relative overflow-hidden">
              <h3 className="text-2xl font-black text-slate-100 mb-6 text-center">매장 진열대 <span className="text-emerald-500 text-lg">(클릭하거나 바구니로 드래그)</span></h3>
              <div className="grid grid-cols-4 md:grid-cols-6 gap-4 p-4 bg-slate-900 rounded-2xl border-2 border-slate-800">
                {availableOptions.map((item) => {
                  const isUsed = userAnswers.some(a => a?.id === item.id);
                  return (
                    <button
                      key={`opt-${item.id}`}
                      draggable={!isUsed}
                      onDragStart={() => handleDragStart(item, null)}
                      onClick={() => handleSelectOption(item)}
                      disabled={isUsed}
                      className={`flex flex-col items-center p-4 rounded-2xl shadow-lg transition-all transform active:scale-95 border-2 ${
                        isUsed ? 'opacity-5 bg-slate-800 grayscale border-transparent cursor-default' : 
                        'bg-slate-800 border-slate-700 hover:border-emerald-500 hover:shadow-emerald-900/30 cursor-grab active:cursor-grabbing'
                      }`}
                    >
                      <span className="text-6xl mb-2">{item.icon}</span>
                      <span className="text-lg font-black text-slate-200 text-center">{item.name}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="mt-10 flex justify-center">
              <button
                onClick={checkResults}
                disabled={userAnswers.some(a => a === null)}
                className="px-28 py-8 bg-emerald-700 text-white text-4xl font-black rounded-full shadow-[0_10px_0_rgb(6,95,70)] hover:bg-emerald-800 transition-all active:shadow-none active:translate-y-2 disabled:bg-slate-800 disabled:text-slate-600 disabled:shadow-none disabled:border-slate-700"
              >
                계산대로 가기
              </button>
            </div>
          </div>
        )}

        {gameState === GameState.RESULT && scenario && (
          <div className="flex-1 flex flex-col items-center justify-center animate-fadeIn text-center p-4">
            <div className="mb-10">
              <div className="text-[10rem] leading-none mb-8 drop-shadow-2xl">
                {score === scenario.items.length ? '👑' : score >= (scenario.items.length / 2) ? '😊' : '💪'}
              </div>
              <h2 className="text-6xl font-black text-white mb-6">
                총 {score}개 정답!
              </h2>
              <p className="text-3xl text-slate-300 font-black max-w-2xl leading-relaxed">
                {score === scenario.items.length 
                  ? '와아! 완벽한 기억력입니다!\n우리 동네 최고의 기억력 박사님!' 
                  : score >= (scenario.items.length / 2) 
                  ? '훌륭합니다! 조금만 더 하면\n완벽하게 맞힐 수 있어요!' 
                  : '괜찮습니다! 자꾸 반복하면\n두뇌가 더 튼튼해질 거예요!'}
              </p>
            </div>

            <div className="w-full bg-slate-950/70 rounded-[2.5rem] p-8 mb-12 border-4 border-slate-800 shadow-2xl">
              <h3 className="text-2xl font-black text-slate-200 mb-8 border-b-4 border-yellow-700 inline-block px-6 pb-2">영수증 확인</h3>
              <div className="flex flex-wrap justify-center gap-6">
                {scenario.items.map((item, idx) => (
                  <div key={`res-${idx}`} className="flex flex-col items-center bg-slate-800 p-5 rounded-[2rem] shadow-xl border-2 border-slate-700 w-36 relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-full h-2 bg-emerald-700"></div>
                    <span className="text-sm font-black bg-slate-900 text-slate-400 px-3 py-1 rounded-full mb-3">{idx + 1}번</span>
                    <span className="text-6xl mb-3 drop-shadow-md">{item.icon}</span>
                    <span className="text-lg font-black text-white mb-4 text-center">{item.name}</span>
                    <div className="text-5xl">
                      {userAnswers[idx]?.id === item.id ? (
                        <span className="text-emerald-400 font-black drop-shadow-[0_0_10px_rgba(52,211,153,0.5)]">⭕</span>
                      ) : (
                        <span className="text-red-500 font-black drop-shadow-[0_0_10px_rgba(239,68,68,0.5)]">❌</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex flex-wrap gap-8 justify-center">
              <button
                onClick={startGame}
                className="px-14 py-8 bg-emerald-700 text-white text-3xl font-black rounded-full shadow-[0_8px_0_rgb(6,95,70)] hover:bg-emerald-800 transition-all active:shadow-none active:translate-y-1"
              >
                🔄 다시하기
              </button>
              <button
                onClick={goHome}
                className="px-14 py-8 bg-slate-700 text-white text-3xl font-black rounded-full shadow-[0_8px_0_rgb(51,65,85)] hover:bg-slate-600 transition-all active:shadow-none active:translate-y-1"
              >
                ⚙️ 레벨변경
              </button>
            </div>
          </div>
        )}
      </main>

      <footer className="mt-8 text-slate-600 text-center font-bold text-lg">
        <p>어르신들의 두뇌 건강 파트너, <span className="text-emerald-700 font-black">메모리 마트</span></p>
      </footer>
    </div>
  );
};

export default App;
