
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
    TASK: High-precision extraction of NYSC Corps Member data from images/documents.
    
    CRITICAL INSTRUCTION: You MUST extract the "PPA" (Place of Primary Assignment) / Organization for every member. 
    It is frequently listed:
    - In a specific column labeled "PPA", "Organization", or "Employer".
    - As a subheading or grouping label above a list of names.
    - Inside parentheses or brackets near the member's name.
    
    If multiple members are listed under one PPA heading, apply that PPA to all of them.
    
    METADATA EXTRACTION:
    - lga: The Local Government (e.g. "Mani Local Government")
    - batchInfo: Batch/Stream info (e.g. "2025 Batch B Stream II")
    - title: Document heading (e.g. "Monthly Clearance")

    FIELDS PER MEMBER:
    - sn (Integer)
    - stateCode (e.g. "KT/24B/1234")
    - surname (Family name)
    - firstName (First name)
    - middleName (Middle name/initial)
    - gender (M or F)
    - phone (GSM Number)
    - companyName (THE PPA/ORGANIZATION - DO NOT LEAVE EMPTY IF AT ALL DISCERNIBLE)
    - attendanceType (Usually "Clearance")
    - day (e.g. "Monday")
    
    JSON OUTPUT RULES:
    1. Normalize all State Codes to UPPERCASE.
    2. Split Full Names into Surname, FirstName, MiddleName.
    3. If PPA is missing but you see a group header like "DISTRIBUTION OF CORPS MEMBERS TO [NAME]", use [NAME] as the PPA.
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
    
    parsed.members = (parsed.members || []).map((m) => ({
      ...m,
      id: Math.random().toString(36).substr(2, 9),
      gender: (m.gender || 'M').toUpperCase().startsWith('F') ? 'F' : 'M',
      stateCode: (m.stateCode || '').toUpperCase().trim(),
      companyName: (m.companyName || '').trim(),
      middleName: (m.middleName || '').trim()
    })).sort((a, b) => (a.sn || 0) - (b.sn || 0));
    
    return parsed;
  } catch (error: any) {
    console.error("Extraction Error:", error);
    throw error;
  }
};
