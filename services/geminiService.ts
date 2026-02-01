
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

  // 매번 다른 결과를 얻기 위해 무작위 요소를 추가합니다.
  const randomFactor = Math.random().toString(36).substring(7);

  const prompt = `Generate a UNIQUE and CREATIVE Korean shopping memory game scenario.
Category: ${category}.
Difficulty: ${difficulty}.
Item Count: ${itemCount}.
Decoy Count: ${decoyCount}.
Random Seed: ${randomFactor}.

Specific Rules:
1. DO NOT repeat the same items from previous sessions. Be creative within the category.
2. Theme name (theme) should be catchy and specific (e.g., '손주들을 위한 간식 장보기', '비 오는 날의 부침개 재료').
3. Items MUST be in a specific logical order for the user to remember.
4. Descriptions MUST be under 8 characters and helpful for older adults.
5. JSON structure MUST be exactly: { theme: string, items: [{id, name, description, icon}], decoys: [{id, name, description, icon}] }.

Category Context:
- If Category is DINING: Use Korean dishes.
- If Category is TRAVEL: Use travel essentials.
- Otherwise, follow the standard category items.`;

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
    // Fallback logic remains for reliability
    return {
      theme: `${category} 장보기`,
      items: Array.from({ length: itemCount }, (_, i) => ({
        id: `item-${randomFactor}-${i}`,
        name: `${category} 품목 ${i + 1}`,
        description: "신선함",
        icon: "📦"
      })),
      decoys: Array.from({ length: decoyCount }, (_, i) => ({
        id: `decoy-${randomFactor}-${i}`,
        name: `다른 품목 ${i + 1}`,
        description: "관련상품",
        icon: "❓"
      }))
    };
  }
}
