import { GoogleGenAI, Type } from "@google/genai";
import { SYSTEM_INSTRUCTION } from '../constants';
import { ReportData } from '../types';

const apiKey = process.env.API_KEY || '';
// Initialize loosely; we will re-initialize in the function call to ensure fresh key if needed.
let ai = new GoogleGenAI({ apiKey });

export const generateMarketReport = async (): Promise<ReportData> => {
  if (!apiKey) {
    throw new Error("API Key is missing. Please configure your environment.");
  }

  // Re-init to be safe
  ai = new GoogleGenAI({ apiKey });

  // Define models: Primary (High Intelligence) and Fallback (High Speed/Stability)
  const primaryModel = 'gemini-3-pro-preview';
  const fallbackModel = 'gemini-3-flash-preview';

  const schema = {
    type: Type.OBJECT,
    properties: {
      btcPrice: { type: Type.NUMBER, description: "Current BTC Price in USD" },
      timestamp: { type: Type.STRING, description: "Current Date/Time in KST" },
      indicators: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            name: { type: Type.STRING },
            weight: { type: Type.NUMBER },
            currentValue: { type: Type.STRING },
            score: { type: Type.NUMBER },
            weightedScore: { type: Type.NUMBER },
            signal: { type: Type.STRING, enum: ["BUY", "NEUTRAL", "SELL"] }
          }
        }
      },
      totalScore: { type: Type.NUMBER },
      interpretation: { type: Type.STRING, description: "Market summary in Korean (한국어)" },
      strategyText: { type: Type.STRING, description: "Detailed entry/exit strategy in Markdown in Korean (한국어)" },
      risksAndAdvice: { type: Type.STRING, description: "Macro risks and 300% goal tips in Markdown in Korean (한국어)" },
      sources: { type: Type.ARRAY, items: { type: Type.STRING } }
    },
    required: ["btcPrice", "indicators", "totalScore", "strategyText"]
  };

  const prompt = "Generate the Weekly Bitcoin Indicator Analysis report. \n\nIMPORTANT: \n1. FETCH REAL-TIME DATA via Google Search.\n2. When checking MacroMicro, LOOK FOR THE DATE. Search snippets often show cached/old data (e.g. Previous vs Current). \n3. **LANGUAGE**: Write the 'interpretation', 'strategyText', and 'risksAndAdvice' sections in **KOREAN (한국어)**.\n4. Prefer the value labeled 'Current' or 'Latest' found in text snippets.\n5. If you see multiple numbers, cross-reference the date.";
  
  const generate = async (modelName: string) => {
    return await ai.models.generateContent({
      model: modelName,
      contents: prompt,
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        tools: [{ googleSearch: {} }],
        responseMimeType: "application/json",
        responseSchema: schema,
      }
    });
  };

  try {
    console.log(`Attempting generation with ${primaryModel}...`);
    const response = await generate(primaryModel);
    const text = response.text;
    if (!text) throw new Error("No response from AI");
    return JSON.parse(text) as ReportData;

  } catch (error: any) {
    console.warn(`${primaryModel} failed, retrying with ${fallbackModel}. Error:`, error);
    
    // Retry with fallback model
    try {
      const response = await generate(fallbackModel);
      const text = response.text;
      if (!text) throw new Error("No response from AI (Fallback)");
      return JSON.parse(text) as ReportData;
    } catch (fallbackError) {
      console.error("Gemini API Error (Both models failed):", fallbackError);
      throw fallbackError;
    }
  }
};