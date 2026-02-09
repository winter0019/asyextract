export interface CorpsMember {
  id: string;
  sn: number;
  stateCode: string;
  fullName: string;
  gender: string;
  phone: string;
  companyName: string;
}

export interface ExtractionResponse {
  members: CorpsMember[];
}

export interface AppState {
  isProcessing: boolean;
  processingStep: 'idle' | 'scanning' | 'extracting' | 'validating';
  data: CorpsMember[];
  error: string | null;
  selectedGroup: string | null;
}