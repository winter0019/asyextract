
import { GoogleGenAI, Type } from "@google/genai";
import { ExtractionResponse } from "../types.ts";

export interface FileData {
  data: string; // base64 for images/pdf, or raw text for csv
  mimeType: string;
  name: string;
}

export const extractCorpsData = async (files: FileData[]): Promise<ExtractionResponse> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const model = 'gemini-3-pro-preview';

  const parts = files.map(file => {
    if (file.mimeType === 'text/csv' || file.mimeType === 'text/plain') {
      return { text: `File Name: ${file.name}\nContent:\n${file.data}` };
    }
    return {
      inlineData: {
        data: file.data.includes(',') ? file.data.split(',')[1] : file.data,
        mimeType: file.mimeType
      }
    };
  });

  const prompt = `
    TASK: Extract list-based data from the provided documents.
    
    CONTEXT: 
    - These are likely official clearance lists, payrolls, or posting documents.
    - Common columns: S/N (Serial), ID/Code (e.g., NY/24B/1234), Full Name, Gender, Contact/Phone, and Organization/PPA.
    
    EXTRACTION REQUIREMENTS:
    1. Identify tables and rows across all provided files.
    2. Normalize Name to UPPERCASE.
    3. Normalize Gender to exactly "M" or "F".
    4. Normalize Phone to a standard format if possible.
    5. Generate a unique "id" (string) for every record extracted.
    6. If a field like "Company" or "PPA" isn't explicitly on every row, infer it from headers or preceding group labels.
    7. Ensure you extract EVERY person listed. Do not skip anyone.
    
    Return the data in the requested JSON structure.
  `;

  try {
    const response = await ai.models.generateContent({
      model,
      contents: { parts: [...parts, { text: prompt }] },
      config: {
        thinkingConfig: { thinkingBudget: 6000 },
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            members: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  id: { type: Type.STRING },
                  sn: { type: Type.NUMBER },
                  stateCode: { type: Type.STRING },
                  fullName: { type: Type.STRING },
                  gender: { type: Type.STRING },
                  phone: { type: Type.STRING },
                  companyName: { type: Type.STRING },
                },
                required: ["id", "sn", "stateCode", "fullName", "gender", "phone", "companyName"],
              },
            },
          },
          required: ["members"],
        },
      },
    });

    const text = response.text;
    if (!text) {
      throw new Error("EMPTY_RESPONSE");
    }
    
    const parsed = JSON.parse(text) as ExtractionResponse;
    
    if (!parsed.members || parsed.members.length === 0) {
      throw new Error("NO_MEMBERS_FOUND");
    }

    // Basic cleanup and sorting
    parsed.members = parsed.members.map(m => ({
      ...m,
      gender: m.gender.toUpperCase().startsWith('M') ? 'M' : 'F'
    })).sort((a, b) => (a.sn || 0) - (b.sn || 0));
    
    return parsed;
  } catch (error: any) {
    console.error("Extraction failed:", error);
    
    // Classify errors for the frontend
    const message = error.message || "";
    
    if (message.includes("API_KEY_INVALID") || message.includes("401") || message.includes("403")) {
      throw new Error("AUTH_ERROR");
    } else if (message.includes("503") || message.includes("overloaded")) {
      throw new Error("SERVICE_OVERLOAD");
    } else if (message.includes("NetworkError") || message.includes("Failed to fetch")) {
      throw new Error("NETWORK_ERROR");
    } else if (message === "EMPTY_RESPONSE" || message === "NO_MEMBERS_FOUND") {
      throw new Error("RECOGNITION_ERROR");
    }
    
    throw error;
  }
};
