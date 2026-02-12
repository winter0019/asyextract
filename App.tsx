
import React, { useState, useMemo, useEffect } from 'react';
import { 
  Upload, Users, Trash2, Search, 
  Loader2, AlertCircle, FileSpreadsheet,
  Printer, X, LayoutGrid, Plus, Scan, Building2,
  ChevronLeft, BadgeCheck, Phone, EyeOff, FileText, Smartphone
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
  
  // Toggles for Official Mode
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
    // Add to top for easy "writing"
    setEditableData([newMember, ...editableData]);
  };

  const generatePDF = () => {
    const doc = new jsPDF('l', 'mm', 'a4');
    const pageWidth = doc.internal.pageSize.getWidth();
    
    if (mode === 'official') {
      // FEATURE 2: OFFICIAL CLONE
      const NYSC_GREEN = [0, 104, 55];
      const BLUE_LINE = [0, 0, 255];

      // Circular Logo Placeholder
      doc.setDrawColor(0);
      doc.setLineWidth(0.1);
      doc.circle(28, 25, 14); 
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7);
      doc.text('NYSC', 28, 24, { align: 'center' });
      doc.text('LOGO', 28, 28, { align: 'center' });

      // Branding
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(26);
      doc.setTextColor(NYSC_GREEN[0], NYSC_GREEN[1], NYSC_GREEN[2]);
      doc.text('National Youth Service Corps', pageWidth / 2 + 10, 22, { align: 'center' });
      
      doc.setFontSize(18);
      doc.setTextColor(0, 0, 0);
      doc.text(editableMetadata.lga || 'Mani Local Government', pageWidth / 2 + 10, 31, { align: 'center' });
      
      doc.setFontSize(16);
      doc.text(`${editableMetadata.title || 'Monthly Clearance'} for ${editableMetadata.batchInfo || 'Batch B'}`, pageWidth / 2 + 10, 40, { align: 'center' });
      
      doc.setFont('courier', 'normal');
      doc.setFontSize(10);
      doc.setTextColor(80, 80, 80);
      doc.text(`Date Printed: ${editableMetadata.datePrinted || ''}`, pageWidth - 14, 48, { align: 'right' });

      doc.setDrawColor(BLUE_LINE[0], BLUE_LINE[1], BLUE_LINE[2]);
      doc.setLineWidth(1.2);
      doc.line(14, 52, pageWidth - 14, 52);

      const headers = ['SN', 'State Code', 'Surname', 'Firstname', 'Middle Name', 'Gender'];
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
        headStyles: { fillColor: [255, 255, 255], textColor: [0, 0, 0], fontStyle: 'bold', lineWidth: 0.1 },
        styles: { fontSize: 9, font: 'helvetica', lineWidth: 0.1 },
        margin: { left: 14, right: 14 }
      });
    } else {
      // FEATURE 1: PLAIN DATA EXTRACT
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(20);
      doc.text(`Personnel List: ${editableMetadata.lga || 'Extracted List'}`, 14, 20);
      
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.text(`Total: ${stats.total} | Male: ${stats.males} | Female: ${stats.females}`, 14, 28);
      
      const headers = ['SN', 'State Code', 'Full Name', 'Gender', 'Phone', 'Organization (PPA)'];
      const body = filteredData.map(m => [
        m.sn, 
        m.stateCode, 
        `${m.surname} ${m.firstName} ${m.middleName}`, 
        m.gender, 
        m.phone,
        m.companyName
      ]);

      autoTable(doc, {
        startY: 34,
        head: [headers],
        body: body,
        theme: 'striped',
        headStyles: { fillColor: [30, 41, 59], textColor: [255, 255, 255], fontStyle: 'bold' },
        styles: { fontSize: 10 }
      });
    }

    doc.save(`NYSC_${mode.toUpperCase()}_${Date.now()}.pdf`);
  };

  if (mode === 'landing') {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center p-6">
        <div className="text-center space-y-4 mb-16 animate-in fade-in slide-in-from-top-4 duration-700">
          <div className="bg-[#006837] w-20 h-20 rounded-3xl flex items-center justify-center mx-auto shadow-2xl rotate-3">
            <BadgeCheck className="w-12 h-12 text-white" />
          </div>
          <h1 className="text-6xl font-black text-slate-900 tracking-tight leading-none">
            NYSC <span className="text-[#006837]">Extract</span>
          </h1>
          <p className="text-slate-400 text-xl font-medium max-w-lg mx-auto italic">Official document replication & automated data organization powered by Gemini Flash.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-10 w-full max-w-4xl">
          <button 
            onClick={() => setMode('plain')}
            className="group bg-slate-50 p-12 rounded-[3rem] border-2 border-transparent hover:border-slate-200 transition-all hover:bg-white hover:shadow-2xl text-left"
          >
            <div className="bg-slate-200 p-5 rounded-2xl w-fit mb-8 group-hover:bg-slate-900 group-hover:text-white transition-all">
              <FileSpreadsheet className="w-10 h-10" />
            </div>
            <h3 className="text-2xl font-black text-slate-900 mb-2">Plain Data Organizer</h3>
            <p className="text-slate-500 mb-8 font-medium">No headers or logo. Focused on M/F counts, phone numbers, and PPA search for internal records.</p>
            <span className="flex items-center gap-2 text-slate-900 font-bold text-sm uppercase tracking-widest">
              Start Organizing <ChevronLeft size={16} className="rotate-180" />
            </span>
          </button>

          <button 
            onClick={() => setMode('official')}
            className="group bg-emerald-50 p-12 rounded-[3rem] border-2 border-transparent hover:border-emerald-200 transition-all hover:bg-white hover:shadow-2xl text-left"
          >
            <div className="bg-emerald-100 p-5 rounded-2xl w-fit mb-8 group-hover:bg-[#006837] group-hover:text-white transition-all">
              <Printer className="w-10 h-10 text-[#006837] group-hover:text-white" />
            </div>
            <h3 className="text-2xl font-black text-slate-900 mb-2">Official Clone Mode</h3>
            <p className="text-slate-500 mb-8 font-medium">Generate pixel-perfect replicas of Monthly Clearance sheets with circular logo, green headers, and blue separators.</p>
            <span className="flex items-center gap-2 text-[#006837] font-bold text-sm uppercase tracking-widest">
              Launch Template <ChevronLeft size={16} className="rotate-180" />
            </span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-sm px-6 h-18 flex items-center justify-between">
        <div className="flex items-center gap-5">
          <button onClick={() => setMode('landing')} className="p-3 bg-slate-50 hover:bg-slate-100 rounded-2xl transition-all"><ChevronLeft size={20} /></button>
          <div className="h-10 w-[2px] bg-slate-100" />
          <div>
            <h1 className="text-xl font-black text-slate-800 tracking-tighter uppercase leading-none">
              {mode === 'official' ? 'Official Clone' : 'Plain Organizer'}
            </h1>
            <p className="text-[10px] font-black text-slate-400 tracking-[0.3em] uppercase mt-1">Personnel Management</p>
          </div>
        </div>
        
        <div className="flex items-center gap-4">
          {editableData.length > 0 && (
            <button onClick={generatePDF} className="bg-[#006837] text-white px-8 py-3 rounded-2xl text-xs font-black flex items-center gap-3 shadow-xl hover:shadow-[#006837]/20 active:scale-95 transition-all">
              <Printer size={18}/> Export PDF
            </button>
          )}
        </div>
      </header>

      <main className="max-w-7xl mx-auto w-full p-8 space-y-8 pb-32">
        {state.error && (
          <div className="bg-rose-50 border-2 border-rose-100 text-rose-800 p-6 rounded-[2rem] flex items-start gap-4 animate-in slide-in-from-top-2">
            <AlertCircle className="w-6 h-6 shrink-0 mt-1" />
            <div><p className="font-black text-lg">Extraction Failure</p><p className="font-medium opacity-80">{state.error}</p></div>
          </div>
        )}

        {/* Dynamic Controls based on Feature */}
        <div className={`grid grid-cols-1 lg:grid-cols-4 gap-6`}>
          <div className="lg:col-span-3 space-y-6">
            <div className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-sm space-y-6">
              <div className="flex flex-col md:flex-row gap-4">
                <div className="relative flex-[2]">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 w-5 h-5" />
                  <input type="text" placeholder="Search by name, state code, or details..." className="w-full pl-12 pr-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-bold focus:ring-4 focus:ring-[#006837]/5 focus:border-[#006837] transition-all" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
                </div>
                <div className="relative flex-1">
                  <Building2 className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 w-5 h-5" />
                  <input type="text" placeholder="Filter PPA..." className="w-full pl-12 pr-6 py-4 bg-emerald-50/20 border border-emerald-50 rounded-2xl text-sm font-bold focus:ring-4 focus:ring-emerald-500/5 focus:border-emerald-500 transition-all" value={ppaSearch} onChange={e => setPpaSearch(e.target.value)} />
                </div>
              </div>

              {mode === 'official' && (
                <div className="pt-4 border-t border-slate-50 grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Local Govt Area</label>
                    <input value={editableMetadata.lga} onChange={e => setEditableMetadata({...editableMetadata, lga: e.target.value})} className="w-full bg-slate-50 border-none p-4 rounded-2xl text-sm font-bold focus:ring-2 focus:ring-[#006837]" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Batch Info</label>
                    <input value={editableMetadata.batchInfo} onChange={e => setEditableMetadata({...editableMetadata, batchInfo: e.target.value})} className="w-full bg-slate-50 border-none p-4 rounded-2xl text-sm font-bold focus:ring-2 focus:ring-[#006837]" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Document Title</label>
                    <input value={editableMetadata.title} onChange={e => setEditableMetadata({...editableMetadata, title: e.target.value})} className="w-full bg-slate-50 border-none p-4 rounded-2xl text-sm font-bold focus:ring-2 focus:ring-[#006837]" />
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="space-y-6">
             <div className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-sm flex flex-col items-center justify-center text-center space-y-4">
                <label className="w-full cursor-pointer">
                  <input type="file" multiple className="hidden" onChange={handleFileUpload} />
                  <div className="w-full flex flex-col items-center justify-center py-6 border-2 border-dashed border-slate-200 rounded-3xl hover:bg-slate-50 transition-all group">
                    <Upload className="w-8 h-8 text-slate-300 group-hover:text-[#006837] mb-2" />
                    <span className="text-xs font-black text-slate-400 uppercase tracking-widest group-hover:text-slate-600">{uploadedFiles.length ? `${uploadedFiles.length} Ready` : 'Upload Documents'}</span>
                  </div>
                </label>
                <button onClick={processData} disabled={state.isProcessing || !uploadedFiles.length} className="w-full py-4 bg-[#006837] text-white rounded-3xl text-sm font-black disabled:opacity-30 shadow-lg shadow-[#006837]/20 active:scale-95 transition-all">
                  {state.isProcessing ? <Loader2 className="animate-spin mx-auto" /> : 'Start Extraction'}
                </button>
             </div>
          </div>
        </div>

        {/* Editor Area with Clear "Write" space */}
        <div className="flex items-center justify-between px-2">
          <div className="flex gap-4">
            <div className="bg-white px-6 py-3 rounded-2xl border border-slate-200 flex items-center gap-6">
              <div className="flex flex-col">
                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Total Count</span>
                <span className="text-xl font-black text-slate-900">{stats.total}</span>
              </div>
              <div className="h-8 w-[1px] bg-slate-100" />
              <div className="flex flex-col">
                <span className="text-[9px] font-black text-blue-400 uppercase tracking-widest">Males</span>
                <span className="text-xl font-black text-blue-600">{stats.males}</span>
              </div>
              <div className="h-8 w-[1px] bg-slate-100" />
              <div className="flex flex-col">
                <span className="text-[9px] font-black text-pink-400 uppercase tracking-widest">Females</span>
                <span className="text-xl font-black text-pink-600">{stats.females}</span>
              </div>
            </div>

            {mode === 'official' && (
              <div className="flex gap-2 p-2 bg-white rounded-2xl border border-slate-200">
                <button onClick={() => setShowGSM(!showGSM)} className={`p-2 rounded-xl transition-all ${showGSM ? 'bg-emerald-50 text-[#006837]' : 'text-slate-300 hover:bg-slate-50'}`}>
                  {showGSM ? <Phone size={18} /> : <EyeOff size={18} />}
                </button>
                <button onClick={() => setShowPPA(!showPPA)} className={`p-2 rounded-xl transition-all ${showPPA ? 'bg-emerald-50 text-[#006837]' : 'text-slate-300 hover:bg-slate-50'}`}>
                  {showPPA ? <Building2 size={18} /> : <EyeOff size={18} />}
                </button>
              </div>
            )}
          </div>

          <button onClick={addNewMember} className="bg-white border-2 border-slate-200 hover:border-[#006837] px-8 py-4 rounded-[2rem] text-xs font-black text-[#006837] flex items-center gap-3 transition-all shadow-sm active:scale-95 group">
            <Plus size={20} className="group-hover:rotate-90 transition-transform" /> Add Row (Write Details)
          </button>
        </div>

        {state.isProcessing ? (
          <div className="p-32 text-center bg-white rounded-[4rem] border-2 border-slate-50 shadow-inner space-y-8">
            <div className="loading-spinner mx-auto w-16 h-16 border-[6px]"></div>
            <div className="space-y-2">
              <h2 className="text-3xl font-black text-slate-900 animate-pulse">Analyzing Documents...</h2>
              <p className="text-slate-400 font-bold uppercase tracking-[0.2em] text-xs">AI Vision Engaged</p>
            </div>
          </div>
        ) : editableData.length > 0 ? (
          <div className="bg-white border border-slate-200 rounded-[3rem] overflow-hidden shadow-2xl animate-in zoom-in-95 duration-500">
            <div className="overflow-x-auto custom-scrollbar">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50/50 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">
                    <th className="px-8 py-6 w-20">SN</th>
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
                    <tr key={m.id} className={`group hover:bg-slate-50/50 transition-colors ${m.id.startsWith('manual-') ? 'bg-emerald-50/30' : ''}`}>
                      <td className="px-8 py-4">
                        <input type="number" className="w-full text-xs font-mono font-black bg-transparent outline-none focus:text-[#006837]" value={m.sn} onChange={e => updateMember(m.id, 'sn', parseInt(e.target.value))} />
                      </td>
                      <td className="px-6 py-4">
                        <input className="w-full text-xs font-black uppercase bg-transparent outline-none focus:text-[#006837] placeholder:text-slate-300" placeholder="WRITE CODE..." value={m.stateCode} onChange={e => updateMember(m.id, 'stateCode', e.target.value)} />
                      </td>
                      <td className="px-6 py-4">
                        <input className="w-full text-xs font-black uppercase bg-transparent outline-none focus:text-[#006837] placeholder:text-slate-300" placeholder="SURNAME..." value={m.surname} onChange={e => updateMember(m.id, 'surname', e.target.value)} />
                      </td>
                      <td className="px-6 py-4">
                        <input className="w-full text-xs font-black uppercase bg-transparent outline-none focus:text-[#006837] placeholder:text-slate-300" placeholder="FIRSTNAME..." value={m.firstName} onChange={e => updateMember(m.id, 'firstName', e.target.value)} />
                      </td>
                      <td className="px-6 py-4">
                        <input className="w-full text-xs font-bold uppercase bg-transparent outline-none focus:text-[#006837] placeholder:text-slate-300" placeholder="MIDDLE..." value={m.middleName} onChange={e => updateMember(m.id, 'middleName', e.target.value)} />
                      </td>
                      <td className="px-6 py-4">
                        <select className="bg-transparent text-[10px] font-black outline-none cursor-pointer focus:text-[#006837]" value={m.gender} onChange={e => updateMember(m.id, 'gender', e.target.value)}>
                          <option value="M">M</option><option value="F">F</option>
                        </select>
                      </td>
                      {(mode === 'plain' || showPPA) && (
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            <Building2 size={14} className="text-slate-300" />
                            <input className="w-full text-xs font-bold text-emerald-800 bg-transparent outline-none placeholder:text-slate-300" placeholder="WRITE PPA..." value={m.companyName} onChange={e => updateMember(m.id, 'companyName', e.target.value)} />
                          </div>
                        </td>
                      )}
                      {(mode === 'plain' || showGSM) && (
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            <Smartphone size={14} className="text-slate-300" />
                            <input className="w-full text-xs font-bold text-slate-600 bg-transparent outline-none placeholder:text-slate-300" placeholder="PHONE..." value={m.phone} onChange={e => updateMember(m.id, 'phone', e.target.value)} />
                          </div>
                        </td>
                      )}
                      <td className="px-8 py-4 text-right">
                        <button onClick={() => removeMember(m.id)} className="p-3 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-2xl transition-all opacity-0 group-hover:opacity-100"><Trash2 size={16} /></button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="bg-white border-4 border-dashed border-slate-200 rounded-[5rem] p-32 text-center space-y-10 group">
            <div className="bg-slate-50 p-12 rounded-full w-fit mx-auto border-4 border-slate-100 group-hover:scale-110 transition-transform duration-500">
              <FileText className="w-20 h-20 text-slate-200" />
            </div>
            <div className="space-y-4 max-w-sm mx-auto">
              <h2 className="text-4xl font-black text-slate-900 tracking-tight leading-none">Awaiting Scans</h2>
              <p className="text-slate-400 font-medium">Upload your clearance lists or click "Add Row" to manually write details in the space provided.</p>
            </div>
          </div>
        )}
      </main>

      <footer className="mt-auto py-12 text-center space-y-4 opacity-40 grayscale hover:grayscale-0 transition-all">
        <div className="bg-[#006837] w-12 h-12 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <BadgeCheck className="text-white w-6 h-6" />
        </div>
        <p className="text-[10px] font-black uppercase tracking-[0.4em] text-slate-900">NYSC Data Integrity Engine &bull; Version 5.1.0</p>
      </footer>
    </div>
  );
};

export default App;
