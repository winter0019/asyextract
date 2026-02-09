
export interface CorpsMember {
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
  data: CorpsMember[];
  error: string | null;
  selectedGroup: string | null;
}
