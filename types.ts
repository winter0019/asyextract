export interface CorpsMember {
  id: string;
  sn: number;
  stateCode: string;
  surname: string;
  firstName: string;
  middleName: string;
  gender: string;
  phone: string;
  companyName: string;
  attendanceDate?: string;
  attendanceType?: string;
  day?: string;
}

export interface ExtractionMetadata {
  lga?: string;
  batchInfo?: string;
  title?: string;
  datePrinted?: string;
}

export interface ExtractionResponse {
  members: CorpsMember[];
  metadata?: ExtractionMetadata;
}

export interface AppState {
  isProcessing: boolean;
  processingStep: 'idle' | 'scanning' | 'extracting' | 'validating';
  data: CorpsMember[];
  metadata: ExtractionMetadata;
  error: string | null;
  selectedGroup: string | null;
}