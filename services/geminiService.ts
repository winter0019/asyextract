import { GoogleGenAI, Type } from "@google/genai";
import { ExtractionResponse } from "../types.ts";

export interface FileData {
  data: string; // base64 for images/pdf, or raw text for csv
  mimeType: string;
  name: string;
}

export const extractCorpsData = async (files: FileData[]): Promise<ExtractionResponse> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
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
    
    CONTEXT: 
    - These are official personnel lists or clearance documents.
    - Columns typically include: Serial Number (SN), State Code (e.g., NY/24B/1234), Full Name, Gender, Phone, and PPA (Organization).
    
    CRITICAL INSTRUCTION FOR GROUPING:
    - Lists are often grouped by PPA (Place of Primary Assignment). 
    - The PPA name might appear once as a header or title ABOVE a table of names.
    - You MUST assign that header name to every "companyName" field for all individuals listed under it until a new header is found.
    
    EXTRACTION REQUIREMENTS:
    1. Normalize Name to UPPERCASE.
    2. Normalize Gender to exactly "M" or "F".
    3. If PPA is not found, use "Unassigned".
    4. Generate a unique "id" string for every record.
    5. Extract EVERY person listed. Do not skip anyone.
    
    Return the data in a JSON object with a "members" array.
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
    
    // Final cleanup to ensure consistency
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