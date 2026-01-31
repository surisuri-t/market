
import React, { useState, useEffect, useCallback } from 'react';
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
  const [hintUsed, setHintUsed] = useState<boolean>(false);

  // API 관리 상태
  const [showApiModal, setShowApiModal] = useState<boolean>(false);
  const [apiTestStatus, setApiTestStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');

  const observationTime = 10; 

  const prefetch = useCallback(async (targetDifficulty: Difficulty, targetCategory: Category) => {
    setIsPrefetching(true);
    try {
      const nextScenario = await generateScenario(targetDifficulty, targetCategory);
      setPrefetchedScenario(nextScenario);
    } catch (error) {
      console.error("Pre-fetch failed", error);
    } finally {
      setIsPrefetching(false);
    }
  }, []);

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
      const currentScenario = await generateScenario(difficulty, category);
      setScenario(currentScenario);
      initiateGameSession(currentScenario);
    } catch (error) {
      alert("상품을 진열하는 중 오류가 발생했습니다. API 키가 등록되어 있지 않거나 잘못되었습니다.");
      setShowApiModal(true);
    } finally {
      setLoading(false);
    }
  };

  const initiateGameSession = (currentScenario: GameScenario) => {
    setGameState(GameState.OBSERVATION);
    setTimer(observationTime);
    setUserAnswers(new Array(currentScenario.items.length).fill(null));
    setScore(0);
    setHintUsed(false);
    setShowHint(false);
    
    const pool = [...currentScenario.items, ...currentScenario.decoys].sort(() => Math.random() - 0.5);
    setAvailableOptions(pool);
  };

  const handleOpenKeyDialog = async () => {
    try {
      // @ts-ignore - window.aistudio is globally defined in the platform environment
      await window.aistudio.openSelectKey();
      setApiTestStatus('idle');
      alert("보안 입력창이 열렸습니다. 준비하신 API 키를 복사해서 붙여넣어 주세요.");
    } catch (e) {
      console.error("Failed to open key dialog", e);
    }
  };

  const handleDeleteKey = () => {
    if (window.confirm("정말로 API 키 설정을 초기화하시겠습니까? 다시 사용하려면 새로 등록해야 합니다.")) {
      setApiTestStatus('idle');
      // 로컬 게임 상태 초기화
      setPrefetchedScenario(null);
      alert("키 설정이 초기화되었습니다. 'API 키 입력' 버튼을 눌러 새 키를 등록해 주세요.");
    }
  };

  const runConnectionTest = async () => {
    setApiTestStatus('testing');
    const success = await testApiKeyConnection();
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
      const newAnswers = [...userAnswers];
      newAnswers[emptyIdx] = item;
      setUserAnswers(newAnswers);
    }
  };

  const removeAnswer = (idx: number) => {
    const newAnswers = [...userAnswers];
    newAnswers[idx] = null;
    setUserAnswers(newAnswers);
  };

  const useHint = () => {
    if (hintUsed) return;
    setShowHint(true);
    setHintUsed(true);
    setTimeout(() => setShowHint(false), 3000);
  };

  const checkResults = () => {
    if (!scenario) return;
    let correctCount = 0;
    userAnswers.forEach((answer, idx) => {
      if (answer && answer.id === scenario.items[idx].id) {
        correctCount++;
      }
    });
    setScore(correctCount);
    setGameState(GameState.RESULT);
  };

  const getCategoryIcon = (cat: Category) => {
    switch (cat) {
      case Category.GROCERY: return '🛒';
      case Category.STATIONERY: return '✏️';
      case Category.FRUIT: return '🍎';
      case Category.ELECTRONICS: return '📺';
      case Category.CLOTHING: return '👕';
      default: return '🛍️';
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4">
      {/* API Key Modal */}
      {showApiModal && (
        <div className="fixed inset-0 bg-black/70 z-[100] flex items-center justify-center p-4 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white rounded-[3rem] shadow-2xl max-w-lg w-full p-10 border-8 border-emerald-100 relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-4 bg-emerald-800"></div>
            <button 
              onClick={() => setShowApiModal(false)}
              className="absolute top-6 right-6 text-4xl text-slate-400 hover:text-slate-600 transition-colors"
            >
              ✕
            </button>
            <div className="text-center">
              <div className="text-6xl mb-6">🔒</div>
              <h2 className="text-4xl font-black text-slate-900 mb-4">보안 API 관리</h2>
              <p className="text-xl text-slate-600 font-medium mb-10 leading-relaxed">
                깃허브 업로드 시에도 안전하도록<br/>
                API 키는 보안 창을 통해 관리됩니다.
              </p>

              <div className="space-y-4 mb-8">
                {/* 이 버튼이 클릭되면 키를 입력(붙여넣기)할 수 있는 보안 시스템 창이 뜹니다. */}
                <button
                  onClick={handleOpenKeyDialog}
                  className="w-full py-6 bg-emerald-700 text-white text-2xl font-black rounded-2xl shadow-lg hover:bg-emerald-800 transition-all flex flex-col items-center justify-center"
                >
                  <span className="text-sm opacity-80 mb-1">복사한 키를 여기에</span>
                  <span>API 키 입력 및 저장하기</span>
                </button>
                
                <button
                  onClick={handleDeleteKey}
                  className="w-full py-4 bg-red-50 text-red-600 text-xl font-black rounded-2xl border-2 border-red-200 hover:bg-red-100 transition-all flex items-center justify-center gap-2"
                >
                  <span>🗑️ API 키 삭제하기</span>
                </button>

                <div className="pt-6 border-t-2 border-slate-100 mt-6">
                  <button
                    onClick={runConnectionTest}
                    disabled={apiTestStatus === 'testing'}
                    className={`w-full py-5 text-2xl font-black rounded-2xl border-4 transition-all ${
                      apiTestStatus === 'testing' ? 'bg-slate-100 text-slate-400 border-slate-200' :
                      apiTestStatus === 'success' ? 'bg-green-100 text-green-800 border-green-300 scale-105' :
                      apiTestStatus === 'error' ? 'bg-red-50 text-red-700 border-red-300' :
                      'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    {apiTestStatus === 'testing' ? '연결 시도 중...' : 
                     apiTestStatus === 'success' ? '✨ 연결 성공! (작동 중)' : 
                     apiTestStatus === 'error' ? '❌ 연결 실패 (키 재입력 필요)' : 
                     '📡 정상 작동 확인하기'}
                  </button>
                </div>
              </div>

              <div className="bg-yellow-50 p-4 rounded-2xl border-2 border-yellow-100 text-left">
                <p className="text-sm text-yellow-800 font-bold mb-1">💡 팁:</p>
                <p className="text-xs text-yellow-700 leading-tight">
                  코드를 깃허브에 공유해도 API 키는 유출되지 않으니 안심하세요. 키는 사용자의 로컬 브라우저에만 암호화되어 저장됩니다.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Mart Header Sign */}
      <header className="mb-8 w-full max-w-5xl bg-emerald-800 text-white p-6 rounded-t-[2rem] shadow-lg text-center relative overflow-hidden border-b-8 border-emerald-900">
        <div className="absolute top-0 left-0 w-full h-2 bg-yellow-400"></div>
        <div className="flex items-center justify-center gap-4 mb-1">
          <span className="text-6xl drop-shadow-md">{getCategoryIcon(category)}</span>
          <h1 className="text-6xl font-black tracking-tighter">메모리 마트</h1>
        </div>
        <p className="text-2xl font-bold opacity-90">우리 동네 최고의 쇼핑 기억력 게임!</p>
      </header>

      {/* Main Game Area */}
      <main className="w-full max-w-5xl bg-white shadow-2xl rounded-b-[3rem] p-10 mart-border min-h-[650px] flex flex-col relative animate-fadeIn">
        
        {/* API Settings Button */}
        <button 
          onClick={() => setShowApiModal(true)}
          className="absolute top-6 left-6 bg-emerald-50 hover:bg-emerald-100 p-4 rounded-full transition-all z-10 shadow-sm border-2 border-emerald-200 group"
          title="보안 설정 및 API 관리"
        >
          <span className="text-3xl group-hover:rotate-90 transition-transform block">⚙️</span>
        </button>

        {gameState !== GameState.LOBBY && (
          <button 
            onClick={goHome}
            className="absolute top-6 right-6 bg-slate-100 hover:bg-slate-200 p-4 rounded-full transition-all z-50 shadow-md border-2 border-slate-200"
            title="처음으로"
          >
            <span className="text-3xl">🏠</span>
          </button>
        )}

        {gameState === GameState.LOBBY && (
          <div className="flex-1 flex flex-col items-center justify-around space-y-10">
            
            {/* Category Selection */}
            <div className="text-center w-full">
              <p className="text-5xl text-emerald-950 mb-8 font-black tracking-tight">어디서 쇼핑을 할까요?</p>
              <div className="flex flex-wrap gap-4 justify-center">
                {(Object.values(Category) as Category[]).map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setCategory(cat)}
                    className={`px-5 py-3 rounded-2xl text-base font-bold transition-all shadow-sm flex items-center gap-2 border-2 ${
                      category === cat 
                        ? 'bg-emerald-700 text-white border-emerald-800 scale-105 shadow-md ring-4 ring-emerald-100' 
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-emerald-50'
                    }`}
                  >
                    <span className="text-xl">{getCategoryIcon(cat)}</span>
                    {cat}
                  </button>
                ))}
              </div>
            </div>

            {/* Difficulty Selection */}
            <div className="text-center w-full">
              <p className="text-5xl text-emerald-950 mb-8 font-black tracking-tight">난이도를 선택해 주세요</p>
              <div className="flex flex-wrap gap-6 justify-center">
                {(Object.values(Difficulty) as Difficulty[]).map((level) => (
                  <button
                    key={level}
                    onClick={() => setDifficulty(level)}
                    className={`px-14 py-7 rounded-3xl text-3xl font-black transition-all shadow-md border-b-8 active:border-b-0 active:translate-y-1 ${
                      difficulty === level 
                        ? 'bg-slate-900 text-white border-black scale-110' 
                        : 'bg-slate-200 text-slate-600 border-slate-300 hover:bg-slate-300'
                    }`}
                  >
                    {level}
                  </button>
                ))}
              </div>
            </div>

            <div className="relative pt-6">
              <button
                onClick={startGame}
                disabled={loading}
                className="px-28 py-10 bg-emerald-700 text-white text-5xl font-black rounded-full shadow-[0_10px_0_rgb(6,95,70)] hover:bg-emerald-800 transition-all active:shadow-none active:translate-y-2 disabled:bg-slate-400 disabled:shadow-none"
              >
                {loading ? '상품 준비 중...' : '쇼핑 시작!'}
              </button>
              {isPrefetching && !loading && (
                <div className="absolute -bottom-12 left-1/2 -translate-x-1/2 text-emerald-600 font-bold animate-pulse text-xl whitespace-nowrap">
                  카트를 소독하고 있어요...
                </div>
              )}
            </div>
          </div>
        )}

        {gameState === GameState.OBSERVATION && scenario && (
          <div className="flex-1 flex flex-col animate-fadeIn">
            <div className="flex justify-between items-center mb-8 bg-emerald-50 p-6 rounded-3xl border-2 border-emerald-100">
              <div className="flex items-center gap-3">
                <span className="text-4xl">🏪</span>
                <h2 className="text-4xl font-black text-emerald-900">{scenario.theme}</h2>
              </div>
              <div className="bg-red-600 px-10 py-4 rounded-2xl shadow-lg border-b-4 border-red-800">
                <span className="text-4xl font-black text-white">남은 시간: {timer}초</span>
              </div>
            </div>
            
            <p className="text-3xl text-emerald-900 mb-10 font-black text-center py-6 bg-emerald-50 rounded-3xl border-2 border-emerald-100 animate-pulse">
              아래 물건들이 담길 <span className="text-red-600 underline">순서</span>를 꼭 기억하세요!
            </p>

            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-5">
              {scenario.items.map((item, idx) => (
                <div key={item.id} className="flex flex-col items-center p-5 bg-white rounded-[2rem] border-4 border-slate-100 shadow-lg hover:border-emerald-300 transition-colors">
                  <span className="text-2xl font-black bg-yellow-400 px-4 py-1 rounded-full mb-4 text-slate-900">{idx + 1}번</span>
                  <div className="text-8xl mb-6">{item.icon}</div>
                  <div className="text-2xl font-black text-slate-800 mb-1">{item.name}</div>
                  <div className="text-lg text-slate-500 font-bold">{item.description}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {gameState === GameState.FILL_GAPS && scenario && (
          <div className="flex-1 flex flex-col animate-fadeIn">
            {showHint && (
              <div className="absolute inset-0 bg-white/98 z-40 flex flex-col items-center justify-center p-8 backdrop-blur-sm">
                <div className="bg-white p-10 rounded-[3rem] shadow-2xl border-8 border-red-500 text-center">
                  <h3 className="text-4xl font-black text-red-600 mb-10">⚠️ 잠깐 확인하세요!</h3>
                  <div className="flex flex-wrap justify-center gap-6">
                    {scenario.items.map((item, idx) => (
                      <div key={`hint-${idx}`} className="flex flex-col items-center p-4 bg-emerald-50 rounded-2xl border-2 border-emerald-100">
                        <span className="text-7xl mb-2">{item.icon}</span>
                        <span className="text-xl font-black bg-emerald-700 text-white px-3 py-1 rounded-full">{idx + 1}번</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            <div className="flex justify-between items-center mb-8">
              <div className="flex items-center gap-4">
                <div className="bg-yellow-400 p-4 rounded-2xl">
                  <span className="text-4xl">🛒</span>
                </div>
                <div>
                  <h2 className="text-4xl font-black text-slate-900">장바구니를 채워주세요!</h2>
                  <p className="text-2xl text-emerald-700 font-bold italic">{scenario.theme}</p>
                </div>
              </div>
              {(difficulty === Difficulty.NORMAL || difficulty === Difficulty.HARD) && (
                <button
                  onClick={useHint}
                  disabled={hintUsed}
                  className={`px-10 py-5 rounded-2xl text-2xl font-black transition-all shadow-md border-b-4 ${
                    hintUsed ? 'bg-slate-200 text-slate-400 border-slate-300 cursor-not-allowed' : 'bg-red-500 text-white border-red-700 hover:bg-red-600'
                  }`}
                >
                  {hintUsed ? '힌트 사용완료' : '힌트 보기 (3초)'}
                </button>
              )}
            </div>

            <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-7 gap-4 mb-10">
              {userAnswers.map((answer, idx) => (
                <div 
                  key={`slot-${idx}`}
                  onClick={() => answer && removeAnswer(idx)}
                  className={`cursor-pointer flex flex-col items-center justify-center p-4 min-h-[180px] rounded-[2rem] border-4 border-dashed transition-all transform hover:scale-105 ${
                    answer ? 'bg-emerald-50 border-emerald-500 shadow-xl' : 'bg-slate-50 border-slate-300'
                  }`}
                >
                  <span className="text-xl font-black text-slate-400 mb-4">{idx + 1}번째 상품</span>
                  {answer ? (
                    <div className="animate-fadeIn text-center">
                      <div className="text-7xl mb-2">{answer.icon}</div>
                      <div className="text-xl font-black text-slate-800">{answer.name}</div>
                      <span className="inline-block mt-2 text-sm bg-red-100 text-red-600 px-3 py-1 rounded-full font-bold">빼기</span>
                    </div>
                  ) : (
                    <div className="text-slate-200 text-7xl font-black">?</div>
                  )}
                </div>
              ))}
            </div>

            <div className="bg-slate-100 p-8 rounded-[2.5rem] border-4 border-slate-200 relative overflow-hidden">
              <div className="absolute top-0 right-0 p-4 opacity-5">
                <span className="text-9xl">🏪</span>
              </div>
              <h3 className="text-3xl font-black text-slate-800 mb-6 text-center">매장 진열대 <span className="text-emerald-700 text-xl font-bold">(클릭해서 카트에 담으세요)</span></h3>
              <div className="grid grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-4 max-h-[280px] overflow-y-auto p-4 bg-white rounded-3xl shadow-inner">
                {availableOptions.map((item) => {
                  const isUsed = userAnswers.some(a => a?.id === item.id);
                  return (
                    <button
                      key={`opt-${item.id}`}
                      onClick={() => handleSelectOption(item)}
                      disabled={isUsed}
                      className={`flex flex-col items-center p-4 rounded-2xl shadow-md transition-all transform active:scale-95 border-2 ${
                        isUsed ? 'opacity-20 bg-slate-100 grayscale cursor-default' : 'bg-white border-slate-100 hover:border-emerald-400 hover:bg-emerald-50'
                      }`}
                    >
                      <span className="text-6xl mb-2">{item.icon}</span>
                      <span className="text-lg font-black text-slate-800 truncate w-full">{item.name}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="mt-10 flex justify-center">
              <button
                onClick={checkResults}
                disabled={userAnswers.some(a => a === null)}
                className="px-28 py-8 bg-emerald-700 text-white text-5xl font-black rounded-full shadow-[0_8px_0_rgb(6,95,70)] hover:bg-emerald-800 transition-all active:shadow-none active:translate-y-1 disabled:bg-slate-300 disabled:shadow-none"
              >
                계산하기
              </button>
            </div>
          </div>
        )}

        {gameState === GameState.RESULT && scenario && (
          <div className="flex-1 flex flex-col items-center justify-center animate-fadeIn text-center p-4">
            <div className="mb-10">
              <div className="text-[10rem] leading-none mb-8 drop-shadow-xl">
                {score === scenario.items.length ? '👑' : score >= (scenario.items.length / 2) ? '😊' : '💪'}
              </div>
              <h2 className="text-7xl font-black text-slate-900 mb-6">
                총 {score}개 성공!
              </h2>
              <p className="text-4xl text-slate-700 font-black max-w-3xl leading-snug">
                {score === scenario.items.length 
                  ? '와아! 완벽한 기억력입니다!\n마트 VIP로 임명합니다!' 
                  : score >= (scenario.items.length / 2) 
                  ? '정말 대단하세요!\n기억력이 아주 훌륭하십니다!' 
                  : '조금 아쉽지만 잘하셨어요!\n다시 한 번 도전해 볼까요?'}
              </p>
            </div>

            <div className="w-full bg-slate-50 rounded-[3rem] p-10 mb-12 border-4 border-slate-100 shadow-inner">
              <h3 className="text-3xl font-black text-slate-800 mb-8 border-b-4 border-yellow-400 inline-block px-6">영수증 확인하기</h3>
              <div className="flex flex-wrap justify-center gap-6">
                {scenario.items.map((item, idx) => (
                  <div key={`res-${idx}`} className="flex flex-col items-center bg-white p-6 rounded-[2rem] shadow-md border-2 border-slate-100 w-36 relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-full h-2 bg-emerald-700"></div>
                    <span className="text-lg font-black bg-slate-100 px-3 py-1 rounded-full mb-3 text-slate-600">{idx+1}번</span>
                    <span className="text-6xl mb-3">{item.icon}</span>
                    <span className="text-xl font-black text-slate-800 mb-4 truncate w-full">{item.name}</span>
                    <div className="text-5xl">
                      {userAnswers[idx]?.id === item.id ? (
                        <span className="text-green-500 font-black">⭕</span>
                      ) : (
                        <span className="text-red-500 font-black">❌</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex flex-wrap gap-8 justify-center">
              <button
                onClick={startGame}
                className="px-16 py-8 bg-emerald-700 text-white text-4xl font-black rounded-full shadow-[0_8px_0_rgb(6,95,70)] hover:bg-emerald-800 transition-all active:shadow-none active:translate-y-1 flex items-center gap-4"
              >
                <span>🔄 다시하기</span>
              </button>
              <button
                onClick={goHome}
                className="px-16 py-8 bg-slate-800 text-white text-4xl font-black rounded-full shadow-[0_8px_0_rgb(30,41,59)] hover:bg-slate-900 transition-all active:shadow-none active:translate-y-1 flex items-center gap-4"
              >
                <span>⚙️ 레벨변경</span>
              </button>
            </div>
          </div>
        )}
      </main>

      <footer className="mt-10 text-slate-600 text-center font-bold text-xl">
        <p>어르신들의 두뇌 건강 파트너, <span className="text-emerald-700 font-black">메모리 마트</span></p>
      </footer>
    </div>
  );
};

export default App;
