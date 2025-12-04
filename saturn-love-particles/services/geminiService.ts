import { GoogleGenAI, Type } from "@google/genai";
import { PhraseResponse } from "../types";

const apiKey = process.env.API_KEY || ''; 

// Initialize GenAI client only if key exists to prevent immediate crashes
const getClient = () => {
  if (!apiKey) return null;
  return new GoogleGenAI({ apiKey });
};

export const generateRomanticPhrases = async (existingPhrases: string[]): Promise<string[]> => {
  const ai = getClient();
  if (!ai) {
    console.warn("Gemini API Key not found. Using fallback.");
    return [];
  }

  const prompt = `Generate 20 unique, short, romantic phrases (max 12 Chinese characters each) in Simplified Chinese.
  They should be poetic and suitable for a couple, perhaps with a cosmic/space theme.
  Do not repeat any of these existing phrases: ${existingPhrases.slice(0, 20).join(", ")}...`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            phrases: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
            },
          },
        },
      },
    });

    // Parse the JSON response directly as typed via SDK
    const jsonResponse = JSON.parse(response.text || '{"phrases": []}') as PhraseResponse;
    return jsonResponse.phrases || [];

  } catch (error) {
    console.error("Failed to generate phrases:", error);
    return [];
  }
};