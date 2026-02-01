
import { GoogleGenAI, Type, GenerateContentResponse } from "@google/genai";
import { Difficulty, Category, GameScenario } from "../types";

/**
 * Helper function for exponential backoff
 */
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function callWithRetry(
  apiCall: () => Promise<GenerateContentResponse>,
  maxRetries: number = 3,
  initialDelay: number = 1000
): Promise<GenerateContentResponse> {
  let lastError: any;
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await apiCall();
    } catch (error: any) {
      lastError = error;
      const isRetryable = error?.message?.includes('503') || error?.message?.includes('429') || error?.status === 'UNAVAILABLE';
      if (isRetryable && i < maxRetries - 1) {
        const waitTime = initialDelay * Math.pow(2, i);
        console.warn(`API Overloaded. Retrying in ${waitTime}ms... (Attempt ${i + 1}/${maxRetries})`);
        await delay(waitTime);
        continue;
      }
      throw error;
    }
  }
  throw lastError;
}

/**
 * API 키 유효성을 테스트합니다.
 */
export async function testApiKeyConnection(customKey?: string): Promise<boolean> {
  const apiKey = customKey || process.env.API_KEY;
  if (!apiKey) return false;

  try {
    const ai = new GoogleGenAI({ apiKey });
    const response = await callWithRetry(() => ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: '안녕! 연결 테스트 중이야. 짧게 "OK"라고 답해줘.',
    }));
    return !!response.text;
  } catch (error) {
    console.error("API Connection Test Failed:", error);
    return false;
  }
}

/**
 * 게임 시나리오를 생성합니다.
 */
export async function generateScenario(difficulty: Difficulty, category: Category, customKey?: string): Promise<GameScenario> {
  const apiKey = customKey || process.env.API_KEY;
  if (!apiKey) throw new Error("API 키가 설정되지 않았습니다.");

  const ai = new GoogleGenAI({ apiKey });
  
  let itemCount = 5;
  let decoyCount = 7; 

  if (difficulty === Difficulty.NORMAL) {
    itemCount = 7;
    decoyCount = 5; 
  } else if (difficulty === Difficulty.HARD) {
    itemCount = 9;
    decoyCount = 3; 
  }

  // DINING 카테고리 지시사항 보강
  const categoryContext = category === Category.DINING 
    ? "식사하기(한국 전통 요리 위주)" 
    : category;

  const prompt = `Generate a Korean shopping memory game scenario.
Category: ${categoryContext}.
Difficulty: ${difficulty}.
Items: ${itemCount} items to remember in order.
Decoys: ${decoyCount} similar items to confuse the user.
JSON structure: { theme: string, items: [{id, name, description, icon}], decoys: [{id, name, description, icon}] }.

Specific Rules:
1. Use VERY short names (e.g., '김밥', '냉면', '떡볶이', '불고기', '파전').
2. Icons MUST be single high-quality emojis.
3. Descriptions MUST be under 8 characters.
4. If category is DINING, use these specific descriptions:
   - 김밥: '검정김에말린'
   - 냉면: '시원한여름면'
   - 떡볶이: '빨갛고매운맛'
   - 불고기: '양념된고기요리'
   - 파전: '한국식피자파전'
   - 삼계탕: '든든한보양식'
   - 김치찌개: '얼큰한뚝배기'`;

  const response = await callWithRetry(() => ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          theme: { type: Type.STRING },
          items: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                id: { type: Type.STRING },
                name: { type: Type.STRING },
                description: { type: Type.STRING },
                icon: { type: Type.STRING }
              },
              required: ["id", "name", "description", "icon"]
            }
          },
          decoys: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                id: { type: Type.STRING },
                name: { type: Type.STRING },
                description: { type: Type.STRING },
                icon: { type: Type.STRING }
              },
              required: ["id", "name", "description", "icon"]
            }
          }
        },
        required: ["theme", "items", "decoys"]
      }
    }
  }));

  try {
    const text = response.text;
    if (!text) throw new Error("Empty response");
    const data = JSON.parse(text.trim());
    return data as GameScenario;
  } catch (error) {
    console.error("Failed to parse Gemini response:", error);
    // Fallback logic for DINING with user-provided specific descriptions
    const fallbackItems = category === Category.DINING ? [
      { id: 'f1', name: '김밥', description: '검정김에말린', icon: '🍱' },
      { id: 'f2', name: '냉면', description: '시원한여름면', icon: '🍜' },
      { id: 'f3', name: '떡볶이', description: '빨갛고매운맛', icon: '🥘' },
      { id: 'f4', name: '불고기', description: '양념된고기요리', icon: '🥩' },
      { id: 'f5', name: '파전', description: '한국식피자파전', icon: '🥞' },
      { id: 'f6', name: '삼계탕', description: '든든한보양식', icon: '🥣' },
      { id: 'f7', name: '김치찌개', description: '얼큰한뚝배기', icon: '🍲' },
      { id: 'f8', name: '비빔밥', description: '건강한채소밥', icon: '🥗' },
      { id: 'f9', name: '잡채', description: '맛있는당면', icon: '🍝' }
    ] : Array.from({ length: itemCount }, (_, i) => ({
      id: `item-${i}`,
      name: `${category} 물건 ${i + 1}`,
      description: "신선함",
      icon: "📦"
    }));

    return {
      theme: `${category} 한 상`,
      items: fallbackItems.slice(0, itemCount),
      decoys: Array.from({ length: decoyCount }, (_, i) => ({
        id: `decoy-${i}`,
        name: `다른 메뉴 ${i + 1}`,
        description: "맛있는것",
        icon: "❓"
      }))
    };
  }
}
