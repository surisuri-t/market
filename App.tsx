
import React, { useState, useEffect, useCallback } from 'react';
import { Difficulty, GameState, GameScenario, GameItem } from './types';
import { generateScenario } from './services/geminiService';

const App: React.FC = () => {
  const [gameState, setGameState] = useState<GameState>(GameState.LOBBY);
  const [difficulty, setDifficulty] = useState<Difficulty>(Difficulty.NORMAL);
  const [scenario, setScenario] = useState<GameScenario | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [timer, setTimer] = useState<number>(0);
  const [userAnswers, setUserAnswers] = useState<(GameItem | null)[]>([null, null, null, null, null]);
  const [availableOptions, setAvailableOptions] = useState<GameItem[]>([]);
  const [score, setScore] = useState<number>(0);

  const observationTime = {
    [Difficulty.EASY]: 15,
    [Difficulty.NORMAL]: 10,
    [Difficulty.HARD]: 5
  };

  const startGame = async () => {
    setLoading(true);
    try {
      const newScenario = await generateScenario(difficulty);
      setScenario(newScenario);
      setGameState(GameState.OBSERVATION);
      setTimer(observationTime[difficulty]);
      setUserAnswers([null, null, null, null, null]);
      setScore(0);
      
      // Shuffle items and decoys for the options pool
      const pool = [...newScenario.items, ...newScenario.decoys].sort(() => Math.random() - 0.5);
      setAvailableOptions(pool);
    } catch (error) {
      alert("게임을 준비하는 도중 오류가 발생했습니다. 다시 시도해주세요.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Fixed: Use any or number instead of NodeJS.Timeout for browser environments
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

  const handleDrop = (index: number, item: GameItem) => {
    const newAnswers = [...userAnswers];
    newAnswers[index] = item;
    setUserAnswers(newAnswers);
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

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4">
      {/* Header */}
      <header className="mb-8 text-center">
        <h1 className="text-4xl font-bold text-amber-900 mb-2">순서기억하기</h1>
        <p className="text-xl text-amber-700 font-medium">어르신들을 위한 기억력 강화 게임</p>
      </header>

      {/* Main Container */}
      <main className="w-full max-w-4xl bg-white shadow-xl rounded-3xl p-8 border-4 border-amber-200 min-h-[500px] flex flex-col">
        {gameState === GameState.LOBBY && (
          <div className="flex-1 flex flex-col items-center justify-center space-y-8 animate-fadeIn">
            <div className="text-center">
              <p className="text-2xl text-gray-700 mb-6 font-bold">난이도를 선택하고 시작 버튼을 눌러주세요!</p>
              <div className="flex gap-4 justify-center">
                {(Object.values(Difficulty) as Difficulty[]).map((level) => (
                  <button
                    key={level}
                    onClick={() => setDifficulty(level)}
                    className={`px-8 py-4 rounded-2xl text-2xl font-bold transition-all ${
                      difficulty === level 
                        ? 'bg-amber-600 text-white scale-105 shadow-lg' 
                        : 'bg-amber-100 text-amber-800 hover:bg-amber-200'
                    }`}
                  >
                    {level}
                  </button>
                ))}
              </div>
            </div>
            <button
              onClick={startGame}
              disabled={loading}
              className="px-12 py-6 bg-green-600 text-white text-3xl font-bold rounded-full shadow-2xl hover:bg-green-700 transition-transform active:scale-95 disabled:bg-gray-400"
            >
              {loading ? '게임 준비 중...' : '게임 시작!'}
            </button>
          </div>
        )}

        {gameState === GameState.OBSERVATION && scenario && (
          <div className="flex-1 flex flex-col animate-fadeIn">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-3xl font-bold text-amber-900">테마: {scenario.theme}</h2>
              <div className="bg-red-100 px-6 py-2 rounded-full border-2 border-red-400">
                <span className="text-3xl font-bold text-red-600">남은 시간: {timer}초</span>
              </div>
            </div>
            <p className="text-2xl text-gray-700 mb-8 font-bold text-center bg-yellow-50 py-4 rounded-xl">
              아래 5개의 물건과 그 순서를 잘 기억해주세요!
            </p>
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
              {scenario.items.map((item, idx) => (
                <div key={item.id} className="flex flex-col items-center p-4 bg-amber-50 rounded-2xl border-2 border-amber-200 shadow-sm">
                  <span className="text-2xl font-bold text-amber-800 mb-2">{idx + 1}번</span>
                  <div className="text-6xl mb-4">{item.icon}</div>
                  <div className="text-2xl font-bold text-gray-800 mb-2">{item.name}</div>
                  <div className="text-sm text-gray-600 text-center">{item.description}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {gameState === GameState.FILL_GAPS && scenario && (
          <div className="flex-1 flex flex-col animate-fadeIn">
            <div className="mb-6 text-center">
              <h2 className="text-3xl font-bold text-amber-900 mb-2">기억나는 물건을 알맞은 칸에 채워주세요!</h2>
              <p className="text-xl text-amber-700 font-medium">테마: {scenario.theme}</p>
            </div>

            {/* Empty Slots */}
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-10">
              {userAnswers.map((answer, idx) => (
                <div 
                  key={`slot-${idx}`}
                  className={`flex flex-col items-center justify-center p-4 min-h-[180px] rounded-2xl border-4 border-dashed transition-all ${
                    answer ? 'bg-green-50 border-green-400' : 'bg-gray-50 border-gray-300'
                  }`}
                >
                  <span className="text-xl font-bold text-gray-400 mb-2">{idx + 1}번 칸</span>
                  {answer ? (
                    <>
                      <div className="text-6xl mb-2">{answer.icon}</div>
                      <div className="text-xl font-bold text-gray-800">{answer.name}</div>
                      <button 
                        onClick={() => {
                          const newA = [...userAnswers];
                          newA[idx] = null;
                          setUserAnswers(newA);
                        }}
                        className="mt-2 text-red-500 font-bold hover:underline"
                      >
                        지우기
                      </button>
                    </>
                  ) : (
                    <div className="text-gray-300 text-lg italic">여기에 놓으세요</div>
                  )}
                </div>
              ))}
            </div>

            {/* Options Pool */}
            <div className="bg-amber-50 p-6 rounded-3xl border-2 border-amber-200">
              <h3 className="text-xl font-bold text-amber-800 mb-4 text-center">보따리 안의 물건들 (클릭해서 빈 칸에 넣기)</h3>
              <div className="flex flex-wrap justify-center gap-3">
                {availableOptions.map((item) => {
                  const isUsed = userAnswers.some(a => a?.id === item.id);
                  return (
                    <button
                      key={`opt-${item.id}`}
                      onClick={() => {
                        if (isUsed) return;
                        const emptyIdx = userAnswers.findIndex(a => a === null);
                        if (emptyIdx !== -1) handleDrop(emptyIdx, item);
                      }}
                      disabled={isUsed}
                      className={`flex flex-col items-center p-3 w-32 rounded-xl shadow-md transition-all ${
                        isUsed ? 'opacity-30 bg-gray-200' : 'bg-white hover:bg-amber-100 active:scale-95'
                      }`}
                    >
                      <span className="text-4xl mb-1">{item.icon}</span>
                      <span className="text-lg font-bold text-gray-800">{item.name}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="mt-8 flex justify-center">
              <button
                onClick={checkResults}
                disabled={userAnswers.some(a => a === null)}
                className="px-16 py-5 bg-blue-600 text-white text-2xl font-bold rounded-full shadow-xl hover:bg-blue-700 transition-all disabled:bg-gray-400"
              >
                다 채웠어요! 결과 보기
              </button>
            </div>
          </div>
        )}

        {gameState === GameState.RESULT && scenario && (
          <div className="flex-1 flex flex-col items-center justify-center animate-fadeIn text-center">
            <div className="mb-6">
              <div className="text-8xl mb-4">
                {score === 5 ? '🎊' : score >= 3 ? '👏' : '💪'}
              </div>
              <h2 className="text-5xl font-bold text-amber-900 mb-4">
                {score}개 정답!
              </h2>
              <p className="text-2xl text-gray-700 font-medium">
                {score === 5 ? '정말 대단하세요! 백점 만점입니다!' : 
                 score >= 3 ? '잘하셨어요! 조금만 더 집중하면 완벽하겠어요!' :
                 '괜찮아요! 반복해서 연습하면 기억력이 더 좋아질 거예요.'}
              </p>
            </div>

            <div className="w-full bg-amber-50 rounded-2xl p-6 mb-8">
              <h3 className="text-xl font-bold text-amber-800 mb-4">정답 확인</h3>
              <div className="grid grid-cols-5 gap-2">
                {scenario.items.map((item, idx) => (
                  <div key={`res-${idx}`} className="flex flex-col items-center">
                    <span className="text-xs font-bold text-amber-600">{idx+1}번</span>
                    <span className="text-3xl">{item.icon}</span>
                    <span className="text-xs font-medium text-gray-600">{item.name}</span>
                    {userAnswers[idx]?.id === item.id ? (
                      <span className="text-green-600 font-bold">⭕</span>
                    ) : (
                      <span className="text-red-600 font-bold">❌</span>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div className="flex gap-4">
              <button
                onClick={() => setGameState(GameState.LOBBY)}
                className="px-10 py-5 bg-amber-600 text-white text-2xl font-bold rounded-full shadow-lg hover:bg-amber-700 transition-all"
              >
                다시 하기
              </button>
              <button
                onClick={startGame}
                className="px-10 py-5 bg-green-600 text-white text-2xl font-bold rounded-full shadow-lg hover:bg-green-700 transition-all"
              >
                다음 게임 (같은 난이도)
              </button>
            </div>
          </div>
        )}
      </main>

      <footer className="mt-8 text-amber-800 text-center font-medium">
        <p>© 2026 실버 메모리 케어. 어르신들의 뇌 건강을 응원합니다.</p>
      </footer>
    </div>
  );
};

export default App;
