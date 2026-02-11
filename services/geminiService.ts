
import { GoogleGenAI, Type } from "@google/genai";
import { ExtractionResponse } from "../types";

export interface FileData {
  data: string; // base64 for images/pdf, or raw text for csv
  mimeType: string;
  name: string;
}

export const extractCorpsData = async (files: FileData[]): Promise<ExtractionResponse> => {
  const apiKey = process.env.API_KEY;

  if (!apiKey || apiKey === "undefined" || apiKey === "") {
    throw new Error(
      "Gemini API key is missing. Please ensure 'GEMINI_API_KEY' is set in your Netlify Site Settings and that you have triggered a new deploy."
    );
  }

  const ai = new GoogleGenAI({ apiKey });
  const model = 'gemini-3-flash-preview';

  const parts = files.map(file => {
    if (file.mimeType.startsWith('text/') || file.name.endsWith('.csv')) {
      return { text: `Source Document (${file.name}):\n${file.data}` };
    }
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
    FORMAT: Strictly JSON. No markdown backticks. No preamble.
    
    FIELDS: 
    - sn (Number)
    - stateCode (String, format: NY/24B/1234)
    - fullName (String, UPPERCASE)
    - gender (M/F)
    - phone (String)
    - companyName (String, the PPA or Organization name)
    
    CRITICAL: 
    Lists are usually grouped under an Organization/PPA header. Assign that header to every member in its section. 
    If a phone number is missing, use "N/A".
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

    let text = response.text || "";
    // Robust cleaning: strip markdown code blocks if the model ignored the config
    text = text.replace(/^```json\n?/, "").replace(/\n?```$/, "").trim();
    
    if (!text) throw new Error("Document could not be read. Please ensure the scan is clear.");
    
    const parsed = JSON.parse(text) as ExtractionResponse;
    
    parsed.members = (parsed.members || []).map(m => ({
      ...m,
      id: m.id || Math.random().toString(36).substr(2, 9),
      gender: (m.gender || 'M').toUpperCase().startsWith('F') ? 'F' : 'M',
      fullName: (m.fullName || 'Unknown').toUpperCase(),
      companyName: (m.companyName || 'UNASSIGNED').toUpperCase()
    })).sort((a, b) => (a.sn || 0) - (b.sn || 0));
    
    return parsed;
  } catch (error: any) {
    console.error("Extraction Error:", error);
    throw error;
  }
};
