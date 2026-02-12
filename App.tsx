
import React, { useState, useMemo, useEffect } from 'react';
import { 
  Upload, Users, Trash2, Search, 
  Loader2, AlertCircle, FileSpreadsheet,
  Printer, X, LayoutGrid, Plus, Scan, Building2,
  ChevronLeft, BadgeCheck, Phone, EyeOff, FileText, Smartphone, Hash
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
      const searchStr = `${m.surname} ${m.firstName} ${m.middleName} ${m.stateCode}`.toLowerCase();
      const matchesSearch = searchStr.includes(searchTerm.toLowerCase());
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
      id: `manual-${Date.now()}`,
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
      const NYSC_GREEN = [0, 104, 55];
      const BLUE_LINE = [0, 0, 255];
      doc.setDrawColor(0);
      doc.setLineWidth(0.1);
      doc.circle(28, 25, 14); 
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7);
      doc.text('NYSC LOGO', 28, 26, { align: 'center' });
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(26);
      doc.setTextColor(NYSC_GREEN[0], NYSC_GREEN[1], NYSC_GREEN[2]);
      doc.text('National Youth Service Corps', pageWidth / 2 + 10, 22, { align: 'center' });
      doc.setFontSize(18);
      doc.setTextColor(0, 0, 0);
      doc.text(editableMetadata.lga || '', pageWidth / 2 + 10, 31, { align: 'center' });
      doc.setFontSize(16);
      doc.text(`${editableMetadata.title || 'Clearance'} - ${editableMetadata.batchInfo || ''}`, pageWidth / 2 + 10, 40, { align: 'center' });
      doc.setDrawColor(BLUE_LINE[0], BLUE_LINE[1], BLUE_LINE[2]);
      doc.setLineWidth(1.2);
      doc.line(14, 52, pageWidth - 14, 52);

      const headers = ['SN', 'State Code', 'Surname', 'Firstname', 'Middle', 'Sex'];
      if (showGSM) headers.push('Phone');
      if (showPPA) headers.push('PPA / Organization');
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
        headStyles: { fillColor: [255, 255, 255], textColor: [0, 0, 0], fontStyle: 'bold' },
        styles: { fontSize: 9, font: 'helvetica' },
        margin: { left: 14, right: 14 }
      });
    } else {
      const headers = ['SN', 'State Code', 'Full Name', 'Gender', 'Phone', 'PPA / Organization'];
      const body = filteredData.map(m => [
        m.sn, m.stateCode, `${m.surname} ${m.firstName} ${m.middleName}`, m.gender, m.phone, m.companyName
      ]);

      autoTable(doc, {
        startY: 15,
        head: [headers],
        body: body,
        theme: 'striped',
        headStyles: { fillColor: [30, 41, 59], textColor: [255, 255, 255], fontStyle: 'bold' },
        styles: { fontSize: 10, font: 'helvetica' },
        margin: { left: 14, right: 14 }
      });
    }

    doc.save(`NYSC_${mode}_${Date.now()}.pdf`);
  };

  if (mode === 'landing') {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center p-6">
        <div className="text-center space-y-4 mb-16">
          <BadgeCheck className="w-20 h-20 text-[#006837] mx-auto" />
          <h1 className="text-6xl font-black text-slate-900 tracking-tight">NYSC EXTRACT</h1>
          <p className="text-slate-400 text-xl font-medium">Extract, group, and replicate official records instantly.</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-10 w-full max-w-4xl">
          <button onClick={() => setMode('plain')} className="group bg-slate-50 p-12 rounded-[3rem] border-2 border-transparent hover:border-slate-200 transition-all hover:bg-white hover:shadow-2xl text-left">
            <FileSpreadsheet className="w-12 h-12 mb-8 text-slate-400 group-hover:text-slate-900 transition-colors" />
            <h3 className="text-2xl font-black text-slate-900 mb-2">Plain Organizer</h3>
            <p className="text-slate-500 mb-8 font-medium">Internal data list. No logos, just counts and PPA grouping.</p>
            <span className="text-[#006837] font-black uppercase text-sm flex items-center gap-2">Get Started <ChevronLeft size={16} className="rotate-180" /></span>
          </button>
          <button onClick={() => setMode('official')} className="group bg-emerald-50 p-12 rounded-[3rem] border-2 border-transparent hover:border-emerald-200 transition-all hover:bg-white hover:shadow-2xl text-left">
            <Printer className="w-12 h-12 mb-8 text-[#006837]" />
            <h3 className="text-2xl font-black text-slate-900 mb-2">Official Clone Mode</h3>
            <p className="text-slate-500 mb-8 font-medium">Perfect replica of the Monthly Clearance template with official headers.</p>
            <span className="text-[#006837] font-black uppercase text-sm flex items-center gap-2">Launch Template <ChevronLeft size={16} className="rotate-180" /></span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#fbfcfd] flex flex-col font-sans text-slate-900">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30 px-6 h-20 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button onClick={() => setMode('landing')} className="p-3 hover:bg-slate-50 rounded-2xl transition-all"><ChevronLeft size={20} /></button>
          <div className="h-10 w-[1px] bg-slate-200" />
          <div>
            <h1 className="text-lg font-black uppercase tracking-tight">{mode === 'official' ? 'Official Document Clone' : 'Plain Organizer'}</h1>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Personnel Management</p>
          </div>
        </div>
        <button onClick={generatePDF} className="bg-[#006837] text-white px-8 py-3 rounded-2xl text-xs font-black flex items-center gap-2 shadow-xl hover:shadow-[#006837]/20 transition-all active:scale-95">
          <Printer size={18}/> Export PDF
        </button>
      </header>

      <main className="max-w-7xl mx-auto w-full p-8 space-y-8">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          <div className="lg:col-span-3 space-y-6">
            <div className="bg-white p-6 rounded-[2rem] border border-slate-200 shadow-sm flex flex-col md:flex-row gap-4">
              <div className="relative flex-[2]">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
                <input 
                  type="text" 
                  placeholder="Search names or codes..." 
                  className="w-full pl-12 pr-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-bold focus:ring-4 focus:ring-[#006837]/5 transition-all" 
                  value={searchTerm} 
                  onChange={e => setSearchTerm(e.target.value)} 
                />
              </div>
              <div className="relative flex-1">
                <Building2 className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
                <input 
                  type="text" 
                  placeholder="Filter by PPA..." 
                  className="w-full pl-12 pr-6 py-4 bg-emerald-50/20 border border-emerald-50 rounded-2xl text-sm font-bold focus:ring-4 focus:ring-emerald-500/10 transition-all outline-none" 
                  value={ppaSearch} 
                  onChange={e => setPpaSearch(e.target.value)} 
                />
              </div>
            </div>

            {mode === 'official' && (
              <div className="bg-white p-6 rounded-[2rem] border border-slate-200 shadow-sm grid grid-cols-1 md:grid-cols-3 gap-6">
                 <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">LGA</label>
                    <input className="w-full bg-slate-50 p-3 rounded-xl text-sm font-bold border-none focus:ring-2 focus:ring-[#006837]" value={editableMetadata.lga} onChange={e => setEditableMetadata({...editableMetadata, lga: e.target.value})} />
                 </div>
                 <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Batch Info</label>
                    <input className="w-full bg-slate-50 p-3 rounded-xl text-sm font-bold border-none focus:ring-2 focus:ring-[#006837]" value={editableMetadata.batchInfo} onChange={e => setEditableMetadata({...editableMetadata, batchInfo: e.target.value})} />
                 </div>
                 <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Title</label>
                    <input className="w-full bg-slate-50 p-3 rounded-xl text-sm font-bold border-none focus:ring-2 focus:ring-[#006837]" value={editableMetadata.title} onChange={e => setEditableMetadata({...editableMetadata, title: e.target.value})} />
                 </div>
              </div>
            )}
          </div>

          <div className="space-y-6">
            <div className="bg-white p-8 rounded-[2rem] border border-slate-200 shadow-sm flex flex-col gap-4">
              <label className="w-full cursor-pointer group">
                <input type="file" multiple className="hidden" onChange={handleFileUpload} />
                <div className="w-full flex flex-col items-center justify-center py-6 border-2 border-dashed border-slate-200 rounded-2xl group-hover:border-[#006837] group-hover:bg-emerald-50/30 transition-all">
                  <Upload className="w-8 h-8 text-slate-300 group-hover:text-[#006837] mb-2" />
                  <span className="text-[10px] font-black uppercase text-slate-400 group-hover:text-slate-600">{uploadedFiles.length ? `${uploadedFiles.length} Selected` : 'Upload Documents'}</span>
                </div>
              </label>
              <button 
                onClick={processData} 
                disabled={state.isProcessing || !uploadedFiles.length} 
                className="w-full py-4 bg-[#006837] text-white rounded-2xl text-sm font-black disabled:opacity-30 shadow-lg shadow-emerald-900/10 active:scale-95 transition-all"
              >
                {state.isProcessing ? <Loader2 className="animate-spin mx-auto" size={20} /> : 'Start Extraction'}
              </button>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between px-2">
          <div className="flex gap-4">
            <div className="bg-white px-6 py-3 rounded-2xl border border-slate-200 flex items-center gap-6 shadow-sm">
              <div className="flex flex-col"><span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Total</span><span className="text-xl font-black">{stats.total}</span></div>
              <div className="h-8 w-[1px] bg-slate-100" />
              <div className="flex flex-col"><span className="text-[9px] font-black text-blue-500 uppercase tracking-widest">Males</span><span className="text-xl font-black text-blue-600">{stats.males}</span></div>
              <div className="h-8 w-[1px] bg-slate-100" />
              <div className="flex flex-col"><span className="text-[9px] font-black text-pink-500 uppercase tracking-widest">Females</span><span className="text-xl font-black text-pink-600">{stats.females}</span></div>
            </div>
            {mode === 'official' && (
              <div className="flex gap-2 p-1.5 bg-white rounded-2xl border border-slate-200">
                <button onClick={() => setShowGSM(!showGSM)} title="Toggle Phone" className={`p-2.5 rounded-xl transition-all ${showGSM ? 'bg-emerald-50 text-[#006837]' : 'text-slate-300'}`}><Smartphone size={18} /></button>
                <button onClick={() => setShowPPA(!showPPA)} title="Toggle PPA" className={`p-2.5 rounded-xl transition-all ${showPPA ? 'bg-emerald-50 text-[#006837]' : 'text-slate-300'}`}><Building2 size={18} /></button>
              </div>
            )}
          </div>
          <button onClick={addNewMember} className="bg-white border-2 border-slate-100 hover:border-[#006837] px-8 py-4 rounded-[2rem] text-xs font-black text-[#006837] flex items-center gap-3 transition-all active:scale-95 group shadow-sm">
            <Plus size={20} className="group-hover:rotate-90 transition-transform" /> Add Row (Write Details)
          </button>
        </div>

        {state.isProcessing ? (
          <div className="p-32 text-center bg-white rounded-[3rem] border border-slate-100 space-y-6">
            <div className="loading-spinner mx-auto w-12 h-12"></div>
            <p className="text-slate-500 font-black animate-pulse uppercase tracking-[0.2em] text-xs">AI Vision Engaged - Splitting Names & Mapping PPAs</p>
          </div>
        ) : editableData.length > 0 ? (
          <div className="bg-white border border-slate-200 rounded-[2.5rem] overflow-hidden shadow-sm">
            <div className="overflow-x-auto custom-scrollbar">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50/50 text-[10px] font-black text-slate-400 uppercase tracking-[0.1em] border-b border-slate-100">
                    <th className="px-8 py-6 w-16">SN</th>
                    <th className="px-6 py-6">State Code</th>
                    <th className="px-6 py-6">Surname</th>
                    <th className="px-6 py-6">Firstname</th>
                    <th className="px-6 py-6">Middle</th>
                    <th className="px-6 py-6">Sex</th>
                    {(mode === 'plain' || showPPA) && <th className="px-6 py-6">PPA / Organization</th>}
                    {(mode === 'plain' || showGSM) && <th className="px-6 py-6">Phone (GSM)</th>}
                    <th className="px-8 py-6 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredData.map(m => (
                    <tr key={m.id} className={`group hover:bg-slate-50/30 transition-colors ${m.id.startsWith('manual-') ? 'bg-emerald-50/20' : ''}`}>
                      <td className="px-8 py-4">
                        <input type="number" className="w-10 text-xs font-black bg-transparent outline-none focus:text-[#006837]" value={m.sn} onChange={e => updateMember(m.id, 'sn', parseInt(e.target.value))} />
                      </td>
                      <td className="px-6 py-4">
                        <input className="w-full text-xs font-black uppercase bg-transparent outline-none focus:text-[#006837] placeholder:text-slate-300" placeholder="KT/..." value={m.stateCode} onChange={e => updateMember(m.id, 'stateCode', e.target.value)} />
                      </td>
                      <td className="px-6 py-4">
                        <input className="w-full text-xs font-black uppercase bg-transparent outline-none focus:text-[#006837] placeholder:text-slate-300" placeholder="SURNAME" value={m.surname} onChange={e => updateMember(m.id, 'surname', e.target.value)} />
                      </td>
                      <td className="px-6 py-4">
                        <input className="w-full text-xs font-black uppercase bg-transparent outline-none focus:text-[#006837] placeholder:text-slate-300" placeholder="FIRSTNAME" value={m.firstName} onChange={e => updateMember(m.id, 'firstName', e.target.value)} />
                      </td>
                      <td className="px-6 py-4">
                        <input className="w-full text-xs font-bold uppercase bg-transparent outline-none focus:text-[#006837] placeholder:text-slate-300" placeholder="MIDDLE" value={m.middleName} onChange={e => updateMember(m.id, 'middleName', e.target.value)} />
                      </td>
                      <td className="px-6 py-4">
                        <select className="bg-transparent text-[10px] font-black outline-none cursor-pointer" value={m.gender} onChange={e => updateMember(m.id, 'gender', e.target.value)}>
                          <option value="M">M</option><option value="F">F</option>
                        </select>
                      </td>
                      {(mode === 'plain' || showPPA) && (
                        <td className="px-6 py-4">
                          <input 
                            className="w-full text-xs font-bold text-emerald-800 bg-transparent outline-none placeholder:text-slate-300" 
                            placeholder="WRITE PPA..." 
                            value={m.companyName} 
                            onChange={e => updateMember(m.id, 'companyName', e.target.value)} 
                          />
                        </td>
                      )}
                      {(mode === 'plain' || showGSM) && (
                        <td className="px-6 py-4">
                          <input 
                            className="w-full text-xs font-bold text-slate-600 bg-transparent outline-none placeholder:text-slate-300" 
                            placeholder="GSM..." 
                            value={m.phone} 
                            onChange={e => updateMember(m.id, 'phone', e.target.value)} 
                          />
                        </td>
                      )}
                      <td className="px-8 py-4 text-right">
                        <button onClick={() => removeMember(m.id)} className="p-2.5 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-xl transition-all opacity-0 group-hover:opacity-100"><Trash2 size={16} /></button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {filteredData.length === 0 && (
                <div className="p-20 text-center text-slate-400 font-medium italic">No results matching your filters.</div>
              )}
            </div>
          </div>
        ) : (
          <div className="bg-white border-4 border-dashed border-slate-100 rounded-[4rem] p-32 text-center space-y-10">
            <div className="bg-slate-50 p-12 rounded-full w-fit mx-auto border-4 border-white shadow-inner">
              <FileText className="w-20 h-20 text-slate-200" />
            </div>
            <div className="space-y-4 max-w-sm mx-auto">
              <h2 className="text-4xl font-black text-slate-900 leading-none">Awaiting Data</h2>
              <p className="text-slate-400 font-medium leading-relaxed">Upload a document scan to extract details, or manually write member information using the "Add Row" tool.</p>
            </div>
          </div>
        )}
      </main>

      <footer className="mt-auto py-12 text-center border-t border-slate-100 bg