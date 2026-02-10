import { GoogleGenAI, Type } from "@google/genai";
import { ExtractionResponse } from "../types";

export interface FileData {
  data: string; // base64 for images/pdf, or raw text for csv
  mimeType: string;
  name: string;
}

export const extractCorpsData = async (files: FileData[]): Promise<ExtractionResponse> => {
  const apiKey = process.env.API_KEY;

  if (!apiKey || apiKey === "undefined") {
    throw new Error("API_KEY is missing. Please set the API_KEY environment variable in your Netlify dashboard settings.");
  }

  // Use the standard pattern for API key initialization
  const ai = new GoogleGenAI({ apiKey });
  const model = 'gemini-3-flash-preview';

  const parts = files.map(file => {
    // Handle text files vs images
    if (file.mimeType.startsWith('text/') || file.name.endsWith('.csv')) {
      return { text: `Source Document (${file.name}):\n${file.data}` };
    }
    
    // Clean base64 data if it contains the data: prefix
    const base64Data = file.data.includes(',') ? file.data.split(',')[1] : file.data;
    
    return {
      inlineData: {
        data: base64Data,
        mimeType: file.mimeType.includes('pdf') ? 'application/pdf' : (file.mimeType || 'image/jpeg')
      }
    };
  });

  const prompt = `
    TASK: Precisely extract personnel data from the provided NYSC documents.
    FIELDS: Serial Number (SN), State Code (e.g., NY/24B/1234), Full Name, Gender (M/F), Phone Number, and PPA (Organization).
    
    CONTEXTUAL GROUPING:
    Clearance lists are often grouped by PPA. The name of the PPA/Organization usually appears once as a header or title above a list of names. 
    You MUST assign that header to every member in that section.
    
    CLEANING RULES:
    - Convert names to UPPERCASE.
    - Ensure State Code matches the NY/XX/XXXX format.
    - Return a valid JSON object.
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
    if (!text) throw new Error("The AI model returned an empty response. Please check the document clarity.");
    
    const parsed = JSON.parse(text) as ExtractionResponse;
    
    // Final data normalization
    parsed.members = (parsed.members || []).map(m => ({
      ...m,
      id: m.id || Math.random().toString(36).substr(2, 9),
      gender: (m.gender || 'M').toUpperCase().startsWith('F') ? 'F' : 'M',
      fullName: (m.fullName || 'Unknown').toUpperCase(),
      companyName: (m.companyName || 'UNASSIGNED').toUpperCase()
    })).sort((a, b) => (a.sn || 0) - (b.sn || 0));
    
    return parsed;
  } catch (error: any) {
    console.error("Gemini Extraction Error:", error);
    if (error.message?.includes("API key")) {
      throw new Error("Invalid or missing API Key. Ensure the 'API_KEY' variable is set correctly in your Netlify settings.");
    }
    throw error;
  }
};