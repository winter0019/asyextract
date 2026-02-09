
import { GoogleGenAI, Type } from "@google/genai";
import { ExtractionResponse } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export interface FileData {
  data: string; // base64 for images/pdf, or raw text for csv
  mimeType: string;
  name: string;
}

export const extractCorpsData = async (files: FileData[]): Promise<ExtractionResponse> => {
  // Using gemini-3-pro-preview for complex reasoning tasks like cross-referencing tables across multiple images
  const model = 'gemini-3-pro-preview';

  const parts = files.map(file => {
    if (file.mimeType === 'text/csv' || file.mimeType === 'text/plain') {
      return { text: `Content of file ${file.name}:\n${file.data}` };
    }
    // Handle images and PDFs
    return {
      inlineData: {
        data: file.data.includes(',') ? file.data.split(',')[1] : file.data,
        mimeType: file.mimeType
      }
    };
  });

  const prompt = `
    TASK: Extract National Youth Service Corps (NYSC) member data from the provided documents.
    
    CONTEXT: 
    - These are likely 'Monthly Clearance' lists or 'PPA Posting' documents.
    - Columns usually include: S/N (Serial Number), State Code (e.g., LA/23B/1234), Name, Gender, Phone Number, and PPA (Place of Primary Assignment / Company Name).
    
    IMPORTANT CROSS-REFERENCING:
    - If data is split across multiple pages, use the S/N (Serial Number) or State Code to link members to their PPA if they appear on different sheets.
    - Ensure names are normalized (UPPERCASE).
    
    EXTRACTION RULES:
    1. Look for headers like "S/N", "STATE CODE", "NAME", "SEX", "PHONE", "PPA".
    2. Extract EVERY member found. Do not skip any rows.
    3. If a field is not found, return an empty string "".
    4. For gender, normalize to "M" or "F".
    
    Return a valid JSON object.
  `;

  try {
    const response = await ai.models.generateContent({
      model,
      contents: { parts: [...parts, { text: prompt }] },
      config: {
        thinkingConfig: { thinkingBudget: 4000 }, // Allow model to reason about cross-referencing
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            members: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  sn: { type: Type.NUMBER, description: "The serial number of the entry" },
                  stateCode: { type: Type.STRING, description: "The unique NYSC state code" },
                  fullName: { type: Type.STRING, description: "Full name of the corps member" },
                  gender: { type: Type.STRING, description: "M or F" },
                  phone: { type: Type.STRING, description: "Mobile phone number" },
                  companyName: { type: Type.STRING, description: "Place of Primary Assignment (PPA) / Employer" },
                },
                required: ["sn", "stateCode", "fullName", "gender", "phone", "companyName"],
              },
            },
          },
          required: ["members"],
        },
      },
    });

    const text = response.text;
    if (!text) throw new Error("No response from AI");
    
    const parsed = JSON.parse(text) as ExtractionResponse;
    
    // Sort by SN by default
    parsed.members.sort((a, b) => a.sn - b.sn);
    
    return parsed;
  } catch (error) {
    console.error("Gemini Extraction Error:", error);
    throw error;
  }
};
