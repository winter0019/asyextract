
import { GoogleGenAI, Type, GenerateContentResponse } from "@google/genai";
import { ExtractionResponse } from "../types";

export interface FileData {
  data: string; 
  mimeType: string;
  name: string;
}

/**
 * Extracts personnel data and document metadata from NYSC lists using Gemini Flash.
 */
export const extractCorpsData = async (files: FileData[]): Promise<ExtractionResponse> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  // Using Flash for better quota availability and speed on structured extraction tasks.
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
    TASK: Precisely extract personnel data and document headers from the provided NYSC documents.
    FORMAT: Strictly JSON.
    
    METADATA EXTRACTION:
    - lga: The Local Government name mentioned (e.g., "Mani Local Government")
    - batchInfo: The Batch and Stream info (e.g., "Batch B Stream 1 and 2, December 2025")
    - title: The main document title (e.g., "Monthly Clearance")
    - datePrinted: Extract "Date Printed" value if available.

    PERSONNEL FIELDS:
    - sn (Number)
    - stateCode (String)
    - surname (String)
    - firstName (String)
    - middleName (String, empty if not found)
    - gender (M/F)
    - phone (GSM number)
    - companyName (PPA/Organization)
    - attendanceDate (String, e.g. "03-11-2025")
    - attendanceType (String, e.g. "Clearance")
    - day (String, e.g. "Monday")
    
    RULES:
    1. If a name column exists, split it: typically Surname is the first word or separated by a comma.
    2. Normalize all text to TITLE CASE for Names and UPPERCASE for State Codes.
    3. Ensure SN is strictly a number.
    4. If gender is not clear, use 'M' as default.
  `;

  try {
    const response: GenerateContentResponse = await ai.models.generateContent({
      model,
      contents: { parts: [...parts, { text: prompt }] },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            metadata: {
              type: Type.OBJECT,
              properties: {
                lga: { type: Type.STRING },
                batchInfo: { type: Type.STRING },
                title: { type: Type.STRING },
                datePrinted: { type: Type.STRING },
              }
            },
            members: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  sn: { type: Type.NUMBER },
                  stateCode: { type: Type.STRING },
                  surname: { type: Type.STRING },
                  firstName: { type: Type.STRING },
                  middleName: { type: Type.STRING },
                  gender: { type: Type.STRING },
                  phone: { type: Type.STRING },
                  companyName: { type: Type.STRING },
                  attendanceDate: { type: Type.STRING },
                  attendanceType: { type: Type.STRING },
                  day: { type: Type.STRING },
                },
                required: ["sn", "stateCode", "surname", "firstName", "gender"],
              },
            },
          },
          required: ["members"],
        },
      },
    });

    const jsonStr = (response.text || "").trim();
    const parsed = JSON.parse(jsonStr) as ExtractionResponse;
    
    parsed.members = (parsed.members || []).map((m) => {
      return {
        ...m,
        id: Math.random().toString(36).substr(2, 9),
        surname: (m.surname || '').trim(),
        firstName: (m.firstName || '').trim(),
        middleName: (m.middleName || '').trim(),
        gender: (m.gender || 'M').toUpperCase().startsWith('F') ? 'F' : 'M',
        stateCode: (m.stateCode || '').toUpperCase().trim(),
        phone: (m.phone || '').trim(),
        companyName: (m.companyName || '').trim()
      };
    }).sort((a, b) => (a.sn || 0) - (b.sn || 0));
    
    return parsed;
  } catch (error: any) {
    console.error("Extraction Error:", error);
    throw error;
  }
};
