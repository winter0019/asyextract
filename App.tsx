
import React, { useState, useMemo, useEffect } from 'react';
import { 
  Upload, Users, Trash2, Search, 
  Loader2, AlertCircle, FileSpreadsheet,
  Printer, X, LayoutGrid, Save, Plus, Scan, Building2,
  ChevronLeft, FileText, BadgeCheck, Phone, EyeOff, Hash
} from 'lucide-react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { extractCorpsData, FileData } from './services/geminiService';
import { CorpsMember, AppState, ExtractionMetadata } from './types';

type AppMode = 'landing' | 'plain' | 'official';

const App: React.FC = () => {
  const [mode, setMode] = useState<AppMode>('landing');
  const [state, setState] = useState<AppState>({
    isProcessing: false,
    processingStep: 'idle',
    data: [],
    metadata: {
      lga: 'Mani Local Government',
      batchInfo: 'Batch B Stream 1 and 2, December 2025',
      title: 'Monthly Clearance',
      datePrinted: 'December 22, 2025'
    },
    error: null,
    selectedGroup: null,
  });
  
  const [uploadedFiles, setUploadedFiles] = useState<FileData[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [ppaSearch, setPpaSearch] = useState('');
  
  // Toggles for Feature 2 (Official Mode)
  const [showGSM, setShowGSM] = useState(true);
  const [showPPA, setShowPPA] = useState(true);
  
  const [editableData, setEditableData] = useState<CorpsMember[]>([]);
  const [editableMetadata, setEditableMetadata] = useState<ExtractionMetadata>(state.metadata);

  useEffect(() => {
    setEditableData(state.data);
    setEditableMetadata(state.metadata);
  }, [state.data, state.metadata]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []) as File[];
    files.forEach(file => {
      const reader = new FileReader();
      reader.onload = (event) => {
        setUploadedFiles(prev => [...prev, {
          name: file.name,
          mimeType: file.type || 'application/octet-stream',
          data: event.target?.result as string
        }]);
      };
      if (file.type.startsWith('text/') || file.name.endsWith('.csv')) reader.readAsText(file);
      else reader.readAsDataURL(file);
    });
  };

  const processData = async () => {
    if (uploadedFiles.length === 0) return;
    setState(prev => ({ ...prev, isProcessing: true, error: null }));
    try {
      const result = await extractCorpsData(uploadedFiles);
      setState(prev => ({ 
        ...prev, 
        data: result.members, 
        metadata: { ...prev.metadata, ...result.metadata },
        isProcessing: false 
      }));
      setUploadedFiles([]);
    } catch (err: any) {
      setState(prev => ({ ...prev, isProcessing: false, error: err.message }));
    }
  };

  const filteredData = useMemo(() => {
    return editableData.filter(m => {
      const nameStr = `${m.surname} ${m.firstName} ${m.middleName} ${m.stateCode}`.toLowerCase();
      const matchesSearch = nameStr.includes(searchTerm.toLowerCase());
      const matchesPpa = ppaSearch === '' || (m.companyName || '').toLowerCase().includes(ppaSearch.toLowerCase());
      return matchesSearch && matchesPpa;
    });
  }, [editableData, searchTerm, ppaSearch]);

  const stats = useMemo(() => {
    const males = filteredData.filter(m => m.gender === 'M').length;
    return { total: filteredData.length, males, females: filteredData.length - males };
  }, [filteredData]);

  const updateMember = (id: string, field: keyof CorpsMember, value: any) => {
    setEditableData(prev => prev.map(m => m.id === id ? { ...m, [field]: value } : m));
  };

  const removeMember = (id: string) => {
    setEditableData(prev => prev.filter(m => m.id !== id));
  };

  const addNewMember = () => {
    const lastSn = editableData.length > 0 ? Math.max(...editableData.map(m => m.sn)) : 0;
    const newMember: CorpsMember = {
      id: Math.random().toString(36).substr(2, 9),
      sn: lastSn + 1,
      stateCode: '',
      surname: '',
      firstName: '',
      middleName: '',
      gender: 'M',
      phone: '',
      companyName: '',
      attendanceType: 'Clearance',
      day: 'Monday'
    };
    setEditableData([newMember, ...editableData]);
  };

  const generatePDF = () => {
    const doc = new jsPDF('l', 'mm', 'a4');
    const pageWidth = doc.internal.pageSize.getWidth();
    
    if (mode === 'official') {
      // Feature 2: Official Document Clone (Formal)
      const NYSC_GREEN = [0, 104, 55];
      const BLUE_LINE = [0, 0, 255];

      // Logo Placeholder (Left)
      doc.setDrawColor(0);
      doc.setLineWidth(0.2);
      doc.circle(28, 25, 14); 
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7);
      doc.text('NYSC', 28, 24, { align: 'center' });
      doc.text('OFFICIAL', 28, 28, { align: 'center' });

      // Formal Headers
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(26);
      doc.setTextColor(NYSC_GREEN[0], NYSC_GREEN[1], NYSC_GREEN[2]);
      doc.text('National Youth Service Corps', pageWidth / 2 + 10, 22, { align: 'center' });
      
      doc.setFontSize(18);
      doc.setTextColor(0, 0, 0);
      doc.text(editableMetadata.lga || '', pageWidth / 2 + 10, 31, { align: 'center' });
      
      doc.setFontSize(16);
      doc.text(`${editableMetadata.title} for ${editableMetadata.batchInfo}`, pageWidth / 2 + 10, 40, { align: 'center' });
      
      doc.setFont('courier', 'normal');
      doc.setFontSize(10);
      doc.setTextColor(80, 80, 80);
      doc.text(`Date Printed: ${editableMetadata.datePrinted}`, pageWidth - 14, 48, { align: 'right' });

      doc.setDrawColor(BLUE_LINE[0], BLUE_LINE[1], BLUE_LINE[2]);
      doc.setLineWidth(1.2);
      doc.line(14, 52, pageWidth - 14, 52);

      const headers = ['SN', 'State Code', 'Surname', 'Firstname', 'Middle Name', 'Gender'];
      if (showGSM) headers.push('Phone No');
      if (showPPA) headers.push('Organization (PPA)');
      headers.push('Type', 'Day');

      const body = filteredData.map(m => {
        const row = [m.sn, m.stateCode, m.surname, m.firstName, m.middleName || '', m.gender];
        if (showGSM) row.push(m.phone);
        if (showPPA) row.push(m.companyName);
        row.push(m.attendanceType || 'Clearance', m.day || 'Monday');
        return row;
      });

      autoTable(doc, {
        startY: 56,
        head: [headers],
        body: body,
        theme: 'grid',
        headStyles: { fillColor: [255, 255, 255], textColor: [0, 0, 0], fontStyle: 'bold', lineWidth: 0.1 },
        styles: { fontSize: 9, font: 'helvetica', lineWidth: 0.1 },
        margin: { left: 14, right: 14 }
      });
    } else {
      // Feature 1: Plain Data Extract (No Logo/Heading)
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(18);
      doc.text(`Personnel Extract: ${editableMetadata.lga}`, 14, 20);
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.text(`Stats: Total: ${stats.total} | Male: ${stats.males} | Female: ${stats.females}`, 14, 28);
      if (ppaSearch) {
        doc.text(`Filtered for Organization: ${ppaSearch}`, 14, 34);
      }

      const headers = ['SN', 'State Code', 'Full Name', 'Gender', 'Phone No', 'PPA'];
      const body = filteredData.map(m => [
        m.sn, 
        m.stateCode, 
        `${m.surname} ${m.firstName} ${m.middleName}`, 
        m.gender, 
        m.phone,
        m.companyName
      ]);

      autoTable(doc, {
        startY: ppaSearch ? 40 : 38,
        head: [headers],
        body: body,
        theme: 'striped',
        headStyles: { fillColor: [51, 65, 85], textColor: [255, 255, 255] },
        styles: { fontSize: 10 }
      });
    }

    doc.save(`NYSC_${mode === 'official' ? 'Official' : 'Data'}_Extract.pdf`);
  };

  if (mode === 'landing') {
    return (
      <div className="min-h-screen bg-[#f8fafc] flex flex-col items-center justify-center p-6">
        <div className="text-center space-y-6 max-w-2xl mb-12">
          <BadgeCheck className="w-16 h-16 text-[#006837] mx-auto" />
          <h1 className="text-5xl font-black text-slate-900 tracking-tight leading-none">
            NYSC <span className="text-[#006837]">Data Engine</span>
          </h1>
          <p className="text-slate-500 text-lg font-medium">Streamline your corps member records with automated extraction and professional report generation.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 w-full max-w-5xl">
          <button 
            onClick={() => setMode('plain')}
            className="group bg-white p-10 rounded-[2.5rem] border border-slate-200 shadow-xl hover:shadow-2xl transition-all hover:-translate-y-2 text-left"
          >
            <div className="bg-slate-50 p-6 rounded-3xl w-fit mb-8 group-hover:bg-emerald-50">
              <Building2 className="w-12 h-12 text-slate-400 group-hover:text-emerald-600" />
            </div>
            <h3 className="text-2xl font-black text-slate-900 mb-2">1. Plain Data Extract</h3>
            <p className="text-slate-500 mb-8 font-medium">Extract M/F counts, phone numbers, and PPA. Generate a simple clean list for internal organizing.</p>
            <div className="flex items-center gap-2 text-[#006837] font-black text-sm uppercase">Launch Data Organizer <ChevronLeft size={16} className="rotate-180" /></div>
          </button>

          <button 
            onClick={() => setMode('official')}
            className="group bg-white p-10 rounded-[2.5rem] border border-slate-200 shadow-xl hover:shadow-2xl transition-all hover:-translate-y-2 text-left"
          >
            <div className="bg-emerald-50 p-6 rounded-3xl w-fit mb-8">
              <Printer className="w-12 h-12 text-[#006837]" />
            </div>
            <h3 className="text-2xl font-black text-slate-900 mb-2">2. Official Document Clone</h3>
            <p className="text-slate-500 mb-8 font-medium">Replicate the formal NYSC Monthly Clearance with logo and headers. Full editing control before export.</p>
            <div className="flex items-center gap-2 text-[#006837] font-black text-sm uppercase">Launch Template Mode <ChevronLeft size={16} className="rotate-180" /></div>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans text-slate-900">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-sm px-4 h-16 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button onClick={() => setMode('landing')} className="p-2 hover:bg-slate-100 rounded-xl transition-all"><ChevronLeft size={20} /></button>
          <div className="h-8 w-[1px] bg-slate-200" />
          <h1 className="text-lg font-black tracking-tight text-slate-800">
            {mode === 'official' ? 'Official Document Clone' : 'Plain Data Extract'}
          </h1>
        </div>
        <div className="flex items-center gap-3">
          {editableData.length > 0 && (
            <button onClick={generatePDF} className="bg-[#006837] text-white px-5 py-2 rounded-xl text-xs font-black flex items-center gap-2 shadow-lg active:scale-95 transition-all">
              <Printer size={16}/> {mode === 'official' ? 'Export Formal Copy' : 'Export Plain List'}
            </button>
          )}
        </div>
      </header>

      <main className="max-w-7xl mx-auto w-full p-6 space-y-6">
        {state.error && (
          <div className="bg-rose-50 border border-rose-200 text-rose-800 p-4 rounded-2xl flex items-start gap-3">
            <AlertCircle className="w-5 h-5 mt-0.5" />
            <div><p className="font-bold">Error</p><p className="text-sm">{state.error}</p></div>
          </div>
        )}

        {/* Feature-Specific Settings */}
        {mode === 'official' && (
          <div className="bg-white border border-emerald-100 rounded-2xl p-6 shadow-sm space-y-4">
            <h3 className="text-xs font-black text-[#006837] uppercase tracking-widest">Document Headers (Editable)</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase">Local Govt</label>
                <input value={editableMetadata.lga} onChange={e => setEditableMetadata({...editableMetadata, lga: e.target.value})} className="w-full bg-slate-50 border p-2 rounded-lg text-sm font-bold" />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase">Batch Info</label>
                <input value={editableMetadata.batchInfo} onChange={e => setEditableMetadata({...editableMetadata, batchInfo: e.target.value})} className="w-full bg-slate-50 border p-2 rounded-lg text-sm font-bold" />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase">Title</label>
                <input value={editableMetadata.title} onChange={e => setEditableMetadata({...editableMetadata, title: e.target.value})} className="w-full bg-slate-50 border p-2 rounded-lg text-sm font-bold" />
              </div>
              <div className="space-y-1 flex items-end gap-2">
                <button onClick={() => setShowGSM(!showGSM)} className={`flex-1 py-2 rounded-lg text-[10px] font-black border transition-all ${showGSM ? 'bg-[#006837] text-white' : 'bg-slate-50 text-slate-400'}`}>
                  {showGSM ? 'GSM: ON' : 'GSM: OFF'}
                </button>
                <button onClick={() => setShowPPA(!showPPA)} className={`flex-1 py-2 rounded-lg text-[10px] font-black border transition-all ${showPPA ? 'bg-[#006837] text-white' : 'bg-slate-50 text-slate-400'}`}>
                  {showPPA ? 'PPA: ON' : 'PPA: OFF'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Search & Upload Controls */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 flex flex-col md:flex-row gap-3 bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
              <input type="text" placeholder="Search Names / Codes..." className="w-full pl-10 pr-4 py-2 bg-slate-50 border rounded-xl text-sm focus:ring-2 focus:ring-[#006837]" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
            </div>
            <div className="relative flex-1">
              <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
              <input type="text" placeholder="Filter by PPA Organization..." className="w-full pl-10 pr-4 py-2 bg-emerald-50/30 border rounded-xl text-sm focus:ring-2 focus:ring-[#006837]" value={ppaSearch} onChange={e => setPpaSearch(e.target.value)} />
            </div>
          </div>

          <div className="flex gap-3 bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
            <label className="flex-1 cursor-pointer">
              <input type="file" multiple className="hidden" onChange={handleFileUpload} />
              <div className="flex items-center justify-center gap-2 h-full border-2 border-dashed border-slate-200 rounded-xl text-xs font-bold text-slate-500 hover:bg-slate-50 transition-all">
                <Upload size={14} /> {uploadedFiles.length ? `${uploadedFiles.length} Selected` : 'Select Scans'}
              </div>
            </label>
            <button onClick={processData} disabled={state.isProcessing || !uploadedFiles.length} className="px-6 bg-[#006837] text-white rounded-xl text-xs font-black disabled:opacity-40">
              {state.isProcessing ? <Loader2 className="animate-spin" size={18} /> : 'Process'}
            </button>
          </div>
        </div>

        {/* Stats Row */}
        <div className="flex items-center justify-between gap-4">
          <div className="flex gap-3">
            <div className="bg-white px-4 py-2 rounded-xl border border-slate-200 text-[11px] font-black uppercase tracking-widest flex items-center gap-4">
              <span className="text-slate-400">Total: <span className="text-slate-900">{stats.total}</span></span>
              <span className="text-blue-500">M: {stats.males}</span>
              <span className="text-pink-500">F: {stats.females}</span>
            </div>
          </div>
          <button onClick={addNewMember} className="bg-white border-2 border-slate-100 hover:border-[#006837]/20 px-4 py-2 rounded-xl text-xs font-black text-[#006837] flex items-center gap-2 transition-all active:scale-95">
            <Plus size={16} /> Add Personnel
          </button>
        </div>

        {/* Table/Editor Workspace */}
        {state.isProcessing ? (
          <div className="p-24 text-center space-y-6 bg-white rounded-3xl border">
            <div className="loading-spinner mx-auto"></div>
            <p className="text-slate-500 font-bold animate-pulse">AI is parsing records and cleaning data...</p>
          </div>
        ) : editableData.length > 0 ? (
          <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
            <div className="overflow-x-auto custom-scrollbar">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50/80 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">
                    <th className="px-6 py-4 w-16">SN</th>
                    <th className="px-6 py-4">State Code</th>
                    <th className="px-6 py-4">Surname</th>
                    <th className="px-6 py-4">Firstname</th>
                    <th className="px-6 py-4">Middle Name</th>
                    <th className="px-6 py-4">Gender</th>
                    {mode === 'plain' || showPPA ? <th className="px-6 py-4">Organization (PPA)</th> : null}
                    {mode === 'plain' || showGSM ? <th className="px-6 py-4">Phone No</th> : null}
                    <th className="px-6 py-4 text-right">Delete</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredData.map(m => (
                    <tr key={m.id} className="hover:bg-slate-50/50 group transition-colors">
                      <td className="px-6 py-3">
                        <input type="number" className="w-12 text-xs font-mono bg-transparent border-b border-transparent focus:border-emerald-200 outline-none" value={m.sn} onChange={e => updateMember(m.id, 'sn', parseInt(e.target.value))} />
                      </td>
                      <td className="px-6 py-3">
                        <input className="w-full text-xs font-bold uppercase bg-transparent outline-none focus:text-[#006837]" placeholder="KT/25B/..." value={m.stateCode} onChange={e => updateMember(m.id, 'stateCode', e.target.value)} />
                      </td>
                      <td className="px-6 py-3">
                        <input className="w-full text-xs font-black uppercase bg-transparent outline-none focus:text-[#006837]" placeholder="SURNAME" value={m.surname} onChange={e => updateMember(m.id, 'surname', e.target.value)} />
                      </td>
                      <td className="px-6 py-3">
                        <input className="w-full text-xs font-black uppercase bg-transparent outline-none focus:text-[#006837]" placeholder="FIRSTNAME" value={m.firstName} onChange={e => updateMember(m.id, 'firstName', e.target.value)} />
                      </td>
                      <td className="px-6 py-3">
                        <input className="w-full text-xs uppercase bg-transparent outline-none focus:text-[#006837]" placeholder="MIDDLE" value={m.middleName} onChange={e => updateMember(m.id, 'middleName', e.target.value)} />
                      </td>
                      <td className="px-6 py-3">
                        <select className="bg-transparent text-[10px] font-black outline-none cursor-pointer" value={m.gender} onChange={e => updateMember(m.id, 'gender', e.target.value)}>
                          <option value="M">M</option><option value="F">F</option>
                        </select>
                      </td>
                      {(mode === 'plain' || showPPA) && (
                        <td className="px-6 py-3">
                          <input className="w-full text-xs font-bold text-emerald-800 bg-transparent outline-none" placeholder="PPA" value={m.companyName} onChange={e => updateMember(m.id, 'companyName', e.target.value)} />
                        </td>
                      )}
                      {(mode === 'plain' || showGSM) && (
                        <td className="px-6 py-3">
                          <input className="w-full text-xs bg-transparent outline-none" placeholder="GSM Number" value={m.phone} onChange={e => updateMember(m.id, 'phone', e.target.value)} />
                        </td>
                      )}
                      <td className="px-6 py-3 text-right">
                        <button onClick={() => removeMember(m.id)} className="p-2 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-xl transition-all opacity-0 group-hover:opacity-100"><Trash2 size={14} /></button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {filteredData.length === 0 && (
              <div className="p-12 text-center text-slate-400 italic font-medium">No records matching your search filters.</div>
            )}
          </div>
        ) : (
          <div className="bg-white border-2 border-dashed border-slate-200 rounded-[2.5rem] p-24 text-center space-y-10">
            <div className="bg-slate-50 p-10 rounded-full w-fit mx-auto border-2 border-slate-100">
              <FileText className="w-16 h-16 text-slate-300" />
            </div>
            <div className="space-y-4 max-w-sm mx-auto">
              <h2 className="text-3xl font-black text-slate-900 tracking-tight leading-none">Ready for Extraction</h2>
              <p className="text-slate-500 font-medium">Upload your clearance documents to begin. The AI will split names, identify genders, and link organizations automatically.</p>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default App;
