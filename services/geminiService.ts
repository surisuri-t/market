
import { GoogleGenAI, Type } from "@google/genai";
import { Difficulty, Category, GameScenario } from "../types";

/**
 * API 키 유효성을 테스트합니다.
 * @param customKey 사용자가 직접 입력한 키 (없으면 process.env.API_KEY 사용)
 */
export async function testApiKeyConnection(customKey?: string): Promise<boolean> {
  const apiKey = customKey || process.env.API_KEY;
  if (!apiKey) return false;

  try {
    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: '안녕! 연결 테스트 중이야. 짧게 "OK"라고 답해줘.',
    });
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
  const decoyCount = 5;

  if (difficulty === Difficulty.NORMAL) itemCount = 6;
  else if (difficulty === Difficulty.HARD) itemCount = 7;

  const prompt = `Generate a Korean shopping memory game scenario.
Category: ${category} (This MUST be the theme of the items).
Difficulty: ${difficulty}.
Items: ${itemCount} items related to ${category} to remember in order.
Decoys: ${decoyCount} similar items related to ${category}.
JSON structure: { theme: string, items: [{id, name, description, icon}], decoys: [{id, name, description, icon}] }.
Descriptions should be under 5 characters.
Icons must be relevant emojis.`;

  const response = await ai.models.generateContent({
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
  });

  try {
    const text = response.text;
    if (!text) throw new Error("Empty response");
    const data = JSON.parse(text.trim());
    return data as GameScenario;
  } catch (error) {
    console.error("Failed to parse Gemini response:", error);
    return {
      theme: `${category} 장터`,
      items: Array.from({ length: itemCount }, (_, i) => ({
        id: `item-${i}`,
        name: `${category} 물건 ${i + 1}`,
        description: "신선함",
        icon: "📦"
      })),
      decoys: Array.from({ length: decoyCount }, (_, i) => ({
        id: `decoy-${i}`,
        name: `${category} 방해 ${i + 1}`,
        description: "다른것",
        icon: "❓"
      }))
    };
  }
}
