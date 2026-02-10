
import { GoogleGenAI, Type } from "@google/genai";
import { ExtractionResponse } from "../types";

export interface FileData {
  data: string; // base64 for images/pdf, or raw text for csv
  mimeType: string;
  name: string;
}

export const extractCorpsData = async (files: FileData[]): Promise<ExtractionResponse> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });
  const model = 'gemini-3-flash-preview';

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
    CONTEXT: personnel lists or clearance documents.
    Columns: Serial Number (SN), State Code, Full Name, Gender, Phone, and PPA.
    Note: PPA name might appear once as a header above a table. Assign it to everyone in that group.
    Return JSON with a "members" array.
  `;

  try {
    const response = await ai.models.generateContent({
      model,
      contents: { parts: [...parts, { text: prompt }] },
      config: {
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
    if (!text) throw new Error("AI returned empty content");
    
    const parsed = JSON.parse(text) as ExtractionResponse;
    parsed.members = parsed.members.map(m => ({
      ...m,
      gender: (m.gender || 'M').toUpperCase().startsWith('F') ? 'F' : 'M',
      fullName: (m.fullName || '').toUpperCase(),
      companyName: (m.companyName || 'Unassigned').toUpperCase()
    })).sort((a, b) => (a.sn || 0) - (b.sn || 0));
    
    return parsed;
  } catch (error) {
    console.error("Extraction failed:", error);
    throw error;
  }
};
