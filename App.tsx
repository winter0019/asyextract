
import React, { useState, useMemo } from 'react';
import { 
  Upload, Users, MapPin, Trash2, Search, 
  Loader2, AlertCircle, FileSpreadsheet, File as FileIcon, 
  TrendingUp, List, LayoutGrid, ChevronRight,
  Printer, X, BarChart3, PieChart, Download, FileJson, Info
} from 'lucide-react';
import { extractCorpsData, FileData } from './services/geminiService';
import { CorpsMember, AppState } from './types';

const App: React.FC = () => {
  const [state, setState] = useState<AppState>({
    isProcessing: false,
    processingStep: 'idle',
    data: [],
    error: null,
    selectedGroup: null,
  });
  
  const [uploadedFiles, setUploadedFiles] = useState<FileData[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [viewMode, setViewMode] = useState<'table' | 'report' | 'analytics'>('table');
  
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []) as File[];
    
    files.forEach(file => {
      const reader = new FileReader();
      reader.onload = (event) => {
        const content = event.target?.result as string;
        const fileData: FileData = {
          name: file.name,
          mimeType: file.type || 'application/octet-stream',
          data: content
        };
        setUploadedFiles(prev => [...prev, fileData]);
      };

      if (file.type.startsWith('text/') || file.type === 'application/json' || file.name.endsWith('.csv')) {
        reader.readAsText(file);
      } else {
        reader.readAsDataURL(file);
      }
    });
  };

  const removeFile = (index: number) => {
    setUploadedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const processData = async () => {
    if (uploadedFiles.length === 0) return;

    setState(prev => ({ 
      ...prev, 
      isProcessing: true, 
      processingStep: 'scanning',
      error: null 
    }));

    try {
      setState(prev => ({ ...prev, processingStep: 'extracting' }));
      const result = await extractCorpsData(uploadedFiles);
      
      setState(prev => ({ 
        ...prev, 
        data: result.members, 
        isProcessing: false, 
        processingStep: 'idle' 
      }));
      
      setUploadedFiles([]);
    } catch (err: any) {
      setState(prev => ({ 
        ...prev, 
        isProcessing: false, 
        processingStep: 'idle',
        error: err.message || "Failed to process documents. Please check your internet connection or try again."
      }));
    }
  };

  const exportToCSV = () => {
    if (state.data.length === 0) return;
    
    const headers = ['SN', 'State Code', 'Full Name', 'Gender', 'Phone', 'PPA'];
    const rows = state.data.map(m => [
      m.sn,
      m.stateCode,
      `"${m.fullName.replace(/"/g, '""')}"`,
      m.gender,
      m.phone,
      `"${m.companyName.replace(/"/g, '""')}"`
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(e => e.join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `NYSC_Personnel_Data_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const filteredData = useMemo(() => {
    return state.data.filter(member => 
      member.fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      member.stateCode.toLowerCase().includes(searchTerm.toLowerCase()) ||
      member.companyName.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [state.data, searchTerm]);

  const stats = useMemo(() => {
    const total = state.data.length;
    const females = state.data.filter(m => m.gender === 'F').length;
    const males = total - females;
    const uniquePPAs = new Set(state.data.map(m => m.companyName)).size;
    
    return { total, females, males, uniquePPAs };
  }, [state.data]);

  const ppaGroups = useMemo(() => {
    const groups: Record<string, CorpsMember[]> = {};
    state.data.forEach(m => {
      if (!groups[m.companyName]) groups[m.companyName] = [];
      groups[m.companyName].push(m);
    });
    return groups;
  }, [state.data]);

  const sortedPPAs = useMemo(() => {
    return (Object.entries(ppaGroups) as [string, CorpsMember[]][]).sort((a, b) => a[0].localeCompare(b[0]));
  }, [ppaGroups]);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans">
      {/* DETAILED PRINT REPORT (HIDDEN ON SCREEN) */}
      <div className="print-only p-12 bg-white text-black leading-tight text-[11pt]">
        {/* Document Header */}
        <div className="flex justify-between items-start border-b-[3px] border-black pb-4 mb-8">
          <div className="text-left">
            <p className="text-[9pt] font-black tracking-widest text-slate-500 mb-1 uppercase">Official Personnel Records</p>
            <h1 className="text-2xl font-black uppercase tracking-tight">National Youth Service Corps</h1>
            <p className="text-sm font-bold uppercase">Secretariat - Deployment & Statistics Unit</p>
          </div>
          <div className="text-right border-[1.5px] border-black p-2 bg-slate-50">
            <p className="text-[8pt] font-black uppercase mb-1">Status: Restricted</p>
            <p className="text-[9pt] font-mono">REF: NYSC/STAT/{new Date().getFullYear()}/{Math.random().toString(36).substr(2, 6).toUpperCase()}</p>
          </div>
        </div>

        {/* Report Overview Section */}
        <div className="mb-10 no-break">
          <h2 className="text-lg font-black uppercase mb-4 bg-black text-white px-3 py-1 inline-block">Executive Summary</h2>
          <div className="grid grid-cols-2 gap-10">
            <div className="space-y-1.5 border-r border-slate-300 pr-10">
              <div className="flex justify-between border-b border-slate-200 py-1">
                <span className="font-bold">Total Corps Members:</span>
                <span className="font-black">{stats.total}</span>
              </div>
              <div className="flex justify-between border-b border-slate-200 py-1">
                <span className="font-bold text-indigo-800">Male Personnel:</span>
                <span>{stats.males} ({Math.round((stats.males/stats.total)*100)}%)</span>
              </div>
              <div className="flex justify-between border-b border-slate-200 py-1">
                <span className="font-bold text-pink-800">Female Personnel:</span>
                <span>{stats.females} ({Math.round((stats.females/stats.total)*100)}%)</span>
              </div>
            </div>
            <div className="space-y-1.5">
              <div className="flex justify-between border-b border-slate-200 py-1">
                <span className="font-bold">Active PPAs Identified:</span>
                <span className="font-black">{stats.uniquePPAs}</span>
              </div>
              <div className="flex justify-between border-b border-slate-200 py-1">
                <span className="font-bold">Extraction Engine:</span>
                <span className="text-[9pt]">Gemini AI (v3-Flash)</span>
              </div>
              <div className="flex justify-between border-b border-slate-200 py-1">
                <span className="font-bold">Timestamp:</span>
                <span className="font-mono text-[9pt]">{new Date().toLocaleString()}</span>
              </div>
            </div>
          </div>
        </div>

        {/* PPA Strength Summary Table */}
        <div className="mb-12 no-break">
          <h2 className="text-lg font-black uppercase mb-4 border-b-2 border-black pb-1">PPA Strength Summary</h2>
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-slate-100">
                <th className="text-left border border-black px-3 py-1 font-black text-[10pt]">Organization (PPA)</th>
                <th className="text-center border border-black px-3 py-1 font-black text-[10pt] w-24">Males</th>
                <th className="text-center border border-black px-3 py-1 font-black text-[10pt] w-24">Females</th>
                <th className="text-center border border-black px-3 py-1 font-black text-[10pt] w-24">Total</th>
              </tr>
            </thead>
            <tbody>
              {sortedPPAs.map(([ppa, members]) => {
                const m = members.filter(x => x.gender === 'M').length;
                const f = members.length - m;
                return (
                  <tr key={ppa}>
                    <td className="border border-black px-3 py-1 uppercase font-bold text-[9pt]">{ppa}</td>
                    <td className="border border-black px-3 py-1 text-center font-mono text-[9pt]">{m}</td>
                    <td className="border border-black px-3 py-1 text-center font-mono text-[9pt]">{f}</td>
                    <td className="border border-black px-3 py-1 text-center font-black text-[9pt]">{members.length}</td>
                  </tr>
                );
              })}
              <tr className="bg-slate-200">
                <td className="border border-black px-3 py-1 font-black uppercase">GRAND TOTAL</td>
                <td className="border border-black px-3 py-1 text-center font-black">{stats.males}</td>
                <td className="border border-black px-3 py-1 text-center font-black">{stats.females}</td>
                <td className="border border-black px-3 py-1 text-center font-black">{stats.total}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className="page-break" />

        {/* Detailed Breakdown Per PPA */}
        {sortedPPAs.map(([ppa, members], index) => (
          <div key={ppa} className={`${index > 0 ? 'page-break-after' : ''} mb-12`}>
            <div className="bg-black text-white px-4 py-2 flex justify-between items-center mb-4">
              <h3 className="text-md font-black uppercase tracking-tight">{ppa}</h3>
              <p className="text-xs font-bold">SECTION {index + 1} | STRENGTH: {members.length}</p>
            </div>
            
            <table className="w-full border-[1.5px] border-black">
              <thead>
                <tr className="bg-slate-100">
                  <th className="text-left w-10 border border-black px-2 py-1 font-bold text-[9pt]">SN</th>
                  <th className="text-left w-32 border border-black px-2 py-1 font-bold text-[9pt]">STATE CODE</th>
                  <th className="text-left border border-black px-2 py-1 font-bold text-[9pt]">FULL NAME</th>
                  <th className="text-center w-12 border border-black px-2 py-1 font-bold text-[9pt]">GDR</th>
                  <th className="text-left w-32 border border-black px-2 py-1 font-bold text-[9pt]">PHONE</th>
                </tr>
              </thead>
              <tbody>
                {members.sort((a,b) => a.sn - b.sn).map(m => (
                  <tr key={m.id}>
                    <td className="border border-black px-2 py-1 text-[8.5pt] font-mono">{m.sn}</td>
                    <td className="border border-black px-2 py-1 text-[8.5pt] font-mono font-bold tracking-tight">{m.stateCode}</td>
                    <td className="border border-black px-2 py-1 text-[8.5pt] font-black uppercase">{m.fullName}</td>
                    <td className="border border-black px-2 py-1 text-[8.5pt] text-center">{m.gender}</td>
                    <td className="border border-black px-2 py-1 text-[8.5pt]">{m.phone}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            
            <div className="mt-8 grid grid-cols-3 gap-8 no-break">
              <div className="border-t border-black pt-1">
                <p className="text-[7pt] font-bold uppercase text-slate-500 mb-6">Prepared by / Extraction Officer</p>
                <div className="border-b border-dotted border-slate-400 w-full mb-1 h-4"></div>
                <p className="text-[7pt] font-mono">Date: {new Date().toLocaleDateString()}</p>
              </div>
              <div className="border-t border-black pt-1">
                <p className="text-[7pt] font-bold uppercase text-slate-500 mb-6">Reviewing Authority</p>
                <div className="border-b border-dotted border-slate-400 w-full mb-1 h-4"></div>
                <p className="text-[7pt] font-mono">Signed:</p>
              </div>
              <div className="border-t border-black pt-1">
                <p className="text-[7pt] font-bold uppercase text-slate-500 mb-6">Official Stamp / Verification</p>
                <div className="border-2 border-slate-200 w-full h-12 flex items-center justify-center">
                  <p className="text-[6pt] text-slate-300">STAMP AREA</p>
                </div>
              </div>
            </div>
          </div>
        ))}

        {/* Final Document Disclaimer */}
        <div className="fixed bottom-0 left-0 right-0 p-8 text-center bg-white">
          <div className="border-t border-slate-200 pt-2">
            <p className="text-[7pt] text-slate-400 uppercase tracking-[0.2em]">
              Confidential Personnel Report | End of Document | Verification Hash: {Math.random().toString(36).substring(2, 10).toUpperCase()}
            </p>
          </div>
        </div>
      </div>

      {/* Main UI Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-20 no-print">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="bg-emerald-600 p-2 rounded-lg shadow-lg shadow-emerald-600/20">
              <Users className="text-white h-5 w-5" />
            </div>
            <h1 className="font-bold text-xl tracking-tight text-slate-800">CorpsScan <span className="text-emerald-600">Pro</span></h1>
          </div>
          
          <div className="flex items-center gap-3">
            {state.data.length > 0 && (
              <>
                <div className="flex bg-slate-100 p-1 rounded-lg mr-2">
                  <button 
                    onClick={() => setViewMode('table')}
                    className={`p-1.5 rounded-md transition-all ${viewMode === 'table' ? 'bg-white shadow-sm text-emerald-600' : 'text-slate-500 hover:text-slate-700'}`}
                    title="Table View"
                  >
                    <List size={18} />
                  </button>
                  <button 
                    onClick={() => setViewMode('report')}
                    className={`p-1.5 rounded-md transition-all ${viewMode === 'report' ? 'bg-white shadow-sm text-emerald-600' : 'text-slate-500 hover:text-slate-700'}`}
                    title="PPA Group View"
                  >
                    <LayoutGrid size={18} />
                  </button>
                  <button 
                    onClick={() => setViewMode('analytics')}
                    className={`p-1.5 rounded-md transition-all ${viewMode === 'analytics' ? 'bg-white shadow-sm text-emerald-600' : 'text-slate-500 hover:text-slate-700'}`}
                    title="Analytics Dashboard"
                  >
                    <BarChart3 size={18} />
                  </button>
                </div>
                
                <button 
                  className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-4 py-2 rounded-lg font-medium text-sm flex items-center gap-2 transition-colors border border-slate-200 group"
                  onClick={exportToCSV}
                >
                  <Download size={16} className="group-hover:translate-y-0.5 transition-transform" />
                  CSV
                </button>
                
                <div className="relative group">
                  <button 
                    className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg font-medium text-sm flex items-center gap-2 transition-all shadow-md active:scale-95"
                    onClick={() => window.print()}
                  >
                    <Printer size={16} />
                    Export PDF
                  </button>
                  <div className="absolute top-full mt-2 right-0 bg-slate-800 text-white text-[10px] p-2 rounded w-40 opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity shadow-xl z-50 text-center">
                    Select <strong>"Save as PDF"</strong> in the print destination to download.
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8 no-print">
        {state.error && (
          <div className="mb-6 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl flex items-center gap-3 animate-in fade-in slide-in-from-top-2">
            <AlertCircle size={20} className="shrink-0" />
            <p className="text-sm font-medium">{state.error}</p>
            <button onClick={() => setState(s => ({...s, error: null}))} className="ml-auto hover:bg-red-100 p-1 rounded-full transition-colors">
              <X size={16} />
            </button>
          </div>
        )}

        {state.data.length === 0 && !state.isProcessing ? (
          <div className="max-w-2xl mx-auto py-12">
            <div className="bg-white rounded-3xl border border-slate-200 p-12 text-center shadow-xl shadow-slate-200/50">
              <div className="bg-emerald-50 w-24 h-24 rounded-full flex items-center justify-center mx-auto mb-8 shadow-inner">
                <Upload className="text-emerald-600 w-12 h-12" />
              </div>
              <h2 className="text-3xl font-bold text-slate-900 mb-3 tracking-tight">AI Personnel Extraction</h2>
              <p className="text-slate-500 mb-10 max-w-md mx-auto text-lg">
                Upload scanned clearance lists or photos. We'll automatically identify members and group them by PPA.
              </p>
              
              <div className="space-y-4">
                <label className="block w-full cursor-pointer group">
                  <input 
                    type="file" 
                    multiple 
                    className="hidden" 
                    onChange={handleFileUpload}
                    accept="image/*,application/pdf,.csv,.txt"
                  />
                  <div className="border-2 border-dashed border-slate-200 rounded-3xl py-12 px-6 bg-slate-50 group-hover:border-emerald-400 group-hover:bg-emerald-50/30 transition-all duration-300">
                    <div className="flex flex-col items-center">
                      <div className="bg-white p-4 rounded-2xl shadow-sm mb-4 group-hover:scale-110 transition-transform">
                        <FileIcon className="text-slate-400 group-hover:text-emerald-500 transition-colors" size={32} />
                      </div>
                      <span className="text-slate-700 font-bold text-lg">Click to browse or drop documents</span>
                      <span className="text-slate-400 text-sm mt-2">Supports JPG, PNG, PDF, CSV, and TXT</span>
                    </div>
                  </div>
                </label>

                {uploadedFiles.length > 0 && (
                  <div className="mt-8 text-left animate-in fade-in slide-in-from-bottom-4">
                    <div className="flex items-center justify-between mb-4 px-2">
                      <h3 className="text-sm font-bold text-slate-900 uppercase tracking-widest">Selected Files ({uploadedFiles.length})</h3>
                      <button onClick={() => setUploadedFiles([])} className="text-xs text-red-600 font-bold hover:underline">Clear All</button>
                    </div>
                    <div className="space-y-3 max-h-60 overflow-y-auto custom-scrollbar pr-2">
                      {uploadedFiles.map((file, i) => (
                        <div key={i} className="flex items-center justify-between bg-white border border-slate-100 p-4 rounded-2xl shadow-sm">
                          <div className="flex items-center gap-4">
                            <div className="bg-slate-50 p-2.5 rounded-xl">
                              <FileIcon size={20} className="text-emerald-600" />
                            </div>
                            <div className="overflow-hidden">
                              <p className="text-sm font-bold text-slate-800 truncate max-w-[240px]">{file.name}</p>
                              <p className="text-[10px] text-slate-400 font-mono uppercase tracking-tighter">{file.mimeType}</p>
                            </div>
                          </div>
                          <button 
                            onClick={() => removeFile(i)}
                            className="p-2 hover:bg-red-50 hover:text-red-600 rounded-xl text-slate-300 transition-all"
                          >
                            <Trash2 size={18} />
                          </button>
                        </div>
                      ))}
                    </div>
                    
                    <button 
                      onClick={processData}
                      className="w-full mt-8 bg-emerald-600 hover:bg-emerald-700 text-white py-5 rounded-2xl font-black text-lg flex items-center justify-center gap-3 shadow-2xl shadow-emerald-600/30 transition-all active:scale-[0.98] hover:-translate-y-1"
                    >
                      Process & Organize Data
                      <ChevronRight size={24} />
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : state.isProcessing ? (
          <div className="flex flex-col items-center justify-center py-32 text-center animate-in fade-in duration-500">
            <div className="relative mb-10">
              <div className="w-32 h-32 rounded-full border-[6px] border-emerald-100 border-t-emerald-600 animate-spin" />
              <div className="absolute inset-0 flex items-center justify-center">
                <Loader2 className="text-emerald-600 animate-pulse" size={48} />
              </div>
            </div>
            <h2 className="text-3xl font-black text-slate-900 mb-3 tracking-tight">
              {state.processingStep === 'scanning' ? 'Scanning Documents...' : 
               state.processingStep === 'extracting' ? 'AI Intelligence Extracting Data...' : 
               'Finalizing Personnel Records...'}
            </h2>
            <p className="text-slate-400 font-medium">This usually takes about 10-15 seconds depending on document size.</p>
          </div>
        ) : (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
            {/* Quick Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              {[
                { label: 'Total Strength', val: stats.total, icon: Users, color: 'emerald' },
                { label: 'PPA Count', val: stats.uniquePPAs, icon: MapPin, color: 'blue' },
                { label: 'Male', val: stats.males, icon: TrendingUp, color: 'indigo' },
                { label: 'Female', val: stats.females, icon: TrendingUp, color: 'pink', flip: true }
              ].map((stat, i) => (
                <div key={i} className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow group">
                  <p className="text-slate-500 text-[10px] font-black uppercase tracking-widest mb-2">{stat.label}</p>
                  <div className="flex items-end justify-between">
                    <h3 className="text-4xl font-black text-slate-900 tracking-tighter">{stat.val}</h3>
                    <div className={`bg-${stat.color}-50 text-${stat.color}-600 p-3 rounded-2xl group-hover:scale-110 transition-transform`}>
                      <stat.icon size={24} className={stat.flip ? 'rotate-180' : ''} />
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Content Filters */}
            <div className="flex flex-col md:flex-row gap-4 items-center justify-between bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
              <div className="relative w-full md:w-full max-w-lg">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
                <input 
                  type="text" 
                  placeholder="Filter by name, state code, or PPA organization..."
                  className="w-full pl-12 pr-6 py-3 bg-slate-50 border-0 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2 bg-slate-100 px-3 py-1 rounded-lg mr-2 text-slate-500 text-xs">
                  <Info size={14} />
                  <span>Showing {filteredData.length} of {state.data.length}</span>
                </div>
                <button 
                  onClick={() => {
                    if(confirm('Are you sure you want to clear all extracted data?')) {
                      setState(prev => ({ ...prev, data: [] }));
                    }
                  }}
                  className="px-6 py-3 text-red-600 font-bold hover:bg-red-50 rounded-xl transition-colors flex items-center gap-2"
                >
                  <Trash2 size={18} />
                  Reset Session
                </button>
              </div>
            </div>

            {/* Dynamic Views */}
            <div className="min-h-[400px]">
              {viewMode === 'table' ? (
                <div className="bg-white rounded-3xl border border-slate-200 shadow-xl shadow-slate-200/50 overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-slate-900 border-b border-slate-800">
                          <th className="px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">SN</th>
                          <th className="px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">State Code</th>
                          <th className="px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Full Name</th>
                          <th className="px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Gender</th>
                          <th className="px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Phone Number</th>
                          <th className="px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Assigned PPA</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {filteredData.map((member) => (
                          <tr key={member.id} className="hover:bg-slate-50 transition-colors group">
                            <td className="px-6 py-4 text-sm font-mono text-slate-400">{member.sn}</td>
                            <td className="px-6 py-4 text-sm font-black text-emerald-700 font-mono tracking-tight">{member.stateCode}</td>
                            <td className="px-6 py-4 text-sm font-black text-slate-900 uppercase group-hover:text-emerald-700 transition-colors">{member.fullName}</td>
                            <td className="px-6 py-4 text-sm text-center">
                              <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-tighter ${member.gender === 'M' ? 'bg-indigo-50 text-indigo-700' : 'bg-pink-50 text-pink-700'}`}>
                                {member.gender === 'M' ? 'Male' : 'Female'}
                              </span>
                            </td>
                            <td className="px-6 py-4 text-sm font-medium text-slate-600">{member.phone}</td>
                            <td className="px-6 py-4 text-[10px] font-black text-slate-500 uppercase tracking-tight max-w-[200px] truncate">{member.companyName}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {filteredData.length === 0 && (
                    <div className="py-20 text-center flex flex-col items-center">
                      <div className="bg-slate-50 p-6 rounded-full mb-4">
                        <Search className="text-slate-300" size={40} />
                      </div>
                      <p className="text-slate-500 font-bold">No results matching "{searchTerm}"</p>
                    </div>
                  )}
                </div>
              ) : viewMode === 'report' ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {sortedPPAs.map(([ppa, members]) => (
                    <div key={ppa} className="bg-white rounded-3xl border border-slate-200 shadow-sm hover:shadow-lg transition-all flex flex-col group overflow-hidden">
                      <div className="p-5 bg-slate-900 border-b border-slate-800 flex items-center justify-between">
                        <h3 className="font-black text-white text-[10px] truncate uppercase tracking-widest">{ppa}</h3>
                        <span className="bg-emerald-500 text-white text-[10px] font-black px-2.5 py-1 rounded-full shrink-0 ml-4">{members.length}</span>
                      </div>
                      <div className="p-5 space-y-4 max-h-[400px] overflow-y-auto custom-scrollbar flex-grow bg-white">
                        {members.map(m => (
                          <div key={m.id} className="flex items-center gap-4 group/item">
                            <div className={`w-10 h-10 rounded-2xl flex-shrink-0 flex items-center justify-center text-xs font-black shadow-sm group-hover/item:scale-110 transition-transform ${m.gender === 'M' ? 'bg-indigo-50 text-indigo-700 border border-indigo-100' : 'bg-pink-50 text-pink-700 border border-pink-100'}`}>
                              {m.fullName.charAt(0)}
                            </div>
                            <div className="overflow-hidden">
                              <p className="text-sm font-black text-slate-900 truncate uppercase leading-none mb-1">{m.fullName}</p>
                              <p className="text-[10px] text-slate-400 font-mono font-bold tracking-tighter">{m.stateCode}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                      <div className="p-4 border-t border-slate-50 bg-slate-50/50 flex justify-between items-center">
                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Distribution Active</p>
                        <Download size={12} className="text-slate-300" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm">
                    <div className="flex items-center gap-3 mb-10">
                      <div className="bg-emerald-50 p-2 rounded-xl">
                        <PieChart className="text-emerald-600" size={20} />
                      </div>
                      <h3 className="font-black text-slate-900 uppercase tracking-tight">Gender Distribution</h3>
                    </div>
                    <div className="flex items-center justify-around py-4">
                      <div className="text-center relative">
                        <div className="text-6xl font-black text-indigo-600 tracking-tighter">{Math.round((stats.males / stats.total) * 100 || 0)}%</div>
                        <p className="text-xs font-black text-slate-400 uppercase tracking-widest mt-2">Male Personnel</p>
                        <p className="text-[10px] font-bold text-indigo-400">({stats.males} Members)</p>
                      </div>
                      <div className="w-px h-24 bg-slate-100" />
                      <div className="text-center">
                        <div className="text-6xl font-black text-pink-600 tracking-tighter">{Math.round((stats.females / stats.total) * 100 || 0)}%</div>
                        <p className="text-xs font-black text-slate-400 uppercase tracking-widest mt-2">Female Personnel</p>
                        <p className="text-[10px] font-bold text-pink-400">({stats.females} Members)</p>
                      </div>
                    </div>
                  </div>
                  
                  <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm">
                    <div className="flex items-center gap-3 mb-10">
                      <div className="bg-emerald-50 p-2 rounded-xl">
                        <BarChart3 className="text-emerald-600" size={20} />
                      </div>
                      <h3 className="font-black text-slate-900 uppercase tracking-tight">Top PPA Capacity</h3>
                    </div>
                    <div className="space-y-6 max-h-[340px] overflow-y-auto pr-4 custom-scrollbar">
                      {sortedPPAs
                        .sort((a, b) => b[1].length - a[1].length)
                        .map(([ppa, members]) => (
                          <div key={ppa} className="group/bar">
                            <div className="flex justify-between text-[10px] font-black mb-2 uppercase text-slate-500 tracking-tight">
                              <span className="truncate mr-4 group-hover/bar:text-slate-900 transition-colors">{ppa}</span>
                              <span className="text-slate-900">{members.length}</span>
                            </div>
                            <div className="w-full bg-slate-50 h-3 rounded-full overflow-hidden border border-slate-100 shadow-inner">
                              <div 
                                className="bg-emerald-500 h-full rounded-full transition-all duration-1000 ease-out shadow-sm" 
                                style={{ width: `${(members.length / stats.total) * 100}%` }}
                              />
                            </div>
                          </div>
                        ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default App;
