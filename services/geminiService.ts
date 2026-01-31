
import { GoogleGenAI, Type } from "@google/genai";
import { Difficulty, GameScenario } from "../types";

export async function generateScenario(difficulty: Difficulty): Promise<GameScenario> {
  // Fixed: Create a new GoogleGenAI instance right before making an API call to ensure it always uses the most up-to-date API key.
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  const prompt = `
    60-70대 시니어 사용자를 위한 기억력 게임 시나리오를 생성해주세요.
    난이도: ${difficulty}
    
    요구사항:
    1. 특정 장소나 테마(예: 시장, 주방, 공원)를 정해주세요.
    2. 테마에 어울리는 5개의 주요 물건(items)을 선정하세요. 각 물건은 이름, 설명, 관련 이모지 아이콘을 포함해야 합니다.
    3. 오답용 방해 물건(decoys)을 4개 생성하세요. 난이도가 높을수록 실제 물건과 비슷한 성격의 물건을 생성하세요.
    
    결과는 JSON 형식으로 제공하세요.
  `;

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
    const data = JSON.parse(response.text.trim());
    return data as GameScenario;
  } catch (error) {
    console.error("Failed to parse Gemini response:", error);
    // Fallback scenario
    return {
      theme: "즐거운 시장 나들이",
      items: [
        { id: "1", name: "빨간 사과", description: "아삭아삭한 제철 사과", icon: "🍎" },
        { id: "2", name: "대파", description: "국물 맛을 내는 신선한 채소", icon: "🌿" },
        { id: "3", name: "고등어", description: "영양 만점 바다 물고기", icon: "🐟" },
        { id: "4", name: "검정 봉지", description: "물건을 담는 튼튼한 봉지", icon: "🛍️" },
        { id: "5", name: "지갑", description: "돈과 카드가 든 소중한 지갑", icon: "👛" }
      ],
      decoys: [
        { id: "d1", name: "포도", description: "달콤한 과일", icon: "🍇" },
        { id: "d2", name: "우유", description: "고소한 마시는 우유", icon: "🥛" },
        { id: "d3", name: "장미", description: "빨간 꽃", icon: "🌹" },
        { id: "d4", name: "운동화", description: "편안한 신발", icon: "👟" }
      ]
    };
  }
}
