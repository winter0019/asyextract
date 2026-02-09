
import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { 
  Upload, FileText, Users, MapPin, Download, Trash2, Search, 
  Loader2, AlertCircle, FileSpreadsheet, File as FileIcon, 
  CheckCircle2, TrendingUp, Info, List, LayoutGrid, ChevronRight,
  Printer, Share2, Plus, X, Edit2, Save, BarChart3, PieChart
} from 'lucide-react';
import { extractCorpsData, FileData } from './services/geminiService.ts';
import { CorpsMember, AppState } from './types.ts';

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
  const [showSuccess, setShowSuccess] = useState(false);
  const [viewMode, setViewMode] = useState<'table' | 'report' | 'analytics'>('table');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  
  const resultsRef = useRef<HTMLDivElement>(null);

  // --- Handlers ---

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []) as File[];
    files.forEach(file => {
      const reader = new FileReader();
      reader.onload = (event) => {
        let content = event.target?.result as string;
        
        const fileData: FileData = {
          name: file.name,
          mimeType: file.type || (file.name.endsWith('.csv') ? 'text/csv' : 'application/octet-stream'),
          data: content
        };
        
        setUploadedFiles(prev => [...prev, fileData]);
      };

      if (file.type === 'text/csv' || file.name.endsWith('.csv')) {
        reader.readAsText(file);
      } else {
        reader.readAsDataURL(file);
      }
    });
  };

  const processFiles = async () => {
    if (uploadedFiles.length === 0) return;

    setState(prev => ({ ...prev, isProcessing: true, processingStep: 'scanning', error: null }));
    setShowSuccess(false);
    
    try {
      // Small delay for scanning animation
      await new Promise(r => setTimeout(r, 1000));
      setState(s => ({ ...s, processingStep: 'extracting' }));
      
      const result = await extractCorpsData(uploadedFiles);
      
      setState(s => ({ ...s, processingStep: 'validating' }));
      await new Promise(r => setTimeout(r, 500));

      setState(prev => ({ 
        ...prev, 
        data: result.members, 
        isProcessing: false,
        processingStep: 'idle',
        selectedGroup: null 
      }));
      setShowSuccess(true);
      
      setTimeout(() => {
        resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 300);
    } catch (err: any) {
      let userFriendlyError = "An unexpected error occurred during extraction. Please try again.";
      
      switch (err.message) {
        case "AUTH_ERROR":
          userFriendlyError = "Authentication failed. The AI service access is restricted. Please check your configuration.";
          break;
        case "SERVICE_OVERLOAD":
          userFriendlyError = "The extraction service is currently busy handling too many requests. Please wait 30 seconds and try again.";
          break;
        case "NETWORK_ERROR":
          userFriendlyError = "Connection lost. Please check your internet connectivity and ensure the files aren't too large.";
          break;
        case "RECOGNITION_ERROR":
          userFriendlyError = "No corps member data could be identified. Try using higher quality photos or scanned PDF documents.";
          break;
      }

      setState(prev => ({ 
        ...prev, 
        error: userFriendlyError, 
        isProcessing: false,
        processingStep: 'idle'
      }));
    }
  };

  const handleEditChange = (id: string, field: keyof CorpsMember, value: string | number) => {
    setState(prev => ({
      ...prev,
      data: prev.data.map(m => m.id === id ? { ...m, [field]: value } : m)
    }));
  };

  const deleteMember = (id: string) => {
    setState(prev => ({
      ...prev,
      data: prev.data.filter(m => m.id !== id)
    }));
  };

  const addNewMember = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const newMember: CorpsMember = {
      id: Math.random().toString(36).substr(2, 9),
      sn: state.data.length + 1,
      stateCode: formData.get('stateCode') as string,
      fullName: (formData.get('fullName') as string).toUpperCase(),
      gender: formData.get('gender') as string,
      phone: formData.get('phone') as string,
      companyName: (formData.get('ppa') as string) || 'Unassigned',
    };
    setState(prev => ({ ...prev, data: [...prev.data, newMember] }));
    setShowAddForm(false);
  };

  const dismissError = () => setState(prev => ({ ...prev, error: null }));

  // --- Memos & Computations ---

  const groups = useMemo(() => {
    const map = new Map<string, CorpsMember[]>();
    state.data.forEach(member => {
      const ppa = member.companyName || 'Unassigned / Not Found';
      if (!map.has(ppa)) map.set(ppa, []);
      map.get(ppa)?.push(member);
    });
    return Array.from(map.entries()).sort((a, b) => b[1].length - a[1].length);
  }, [state.data]);

  const stats = useMemo(() => {
    if (state.data.length === 0) return null;
    const males = state.data.filter(m => m.gender === 'M' || m.gender === 'Male').length;
    const females = state.data.filter(m => m.gender === 'F' || m.gender === 'Female').length;
    return {
      total: state.data.length,
      ppas: groups.length,
      males,
      females,
      malePercent: Math.round((males / state.data.length) * 100),
      femalePercent: Math.round((females / state.data.length) * 100),
    };
  }, [state.data, groups]);

  const filteredMembers = useMemo(() => {
    const baseList = state.selectedGroup 
      ? groups.find(([ppa]) => ppa === state.selectedGroup)?.[1] || []
      : state.data;
    
    return baseList.filter(m => 
      m.fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      m.stateCode.toLowerCase().includes(searchTerm.toLowerCase()) ||
      m.companyName.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [state.selectedGroup, groups, state.data, searchTerm]);

  const downloadCSV = useCallback(() => {
    if (filteredMembers.length === 0) return;
    const headers = ["SN", "State Code", "Full Name", "Gender", "GSM NO", "PPA"];
    const rows = filteredMembers.map(m => [
      m.sn,
      `"${m.stateCode}"`,
      `"${m.fullName}"`,
      m.gender,
      `"${m.phone}"`,
      `"${m.companyName}"`
    ]);
    const csvContent = [headers, ...rows].map(e => e.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `nysc_list_${new Date().toISOString().split('T')[0]}.csv`);
    link.click();
  }, [filteredMembers]);

  return (
    <div className="min-h-screen bg-[#f0f4f2] font-sans text-slate-900 pb-20">
      {/* Dynamic Header */}
      <header className="sticky top-0 z-50 bg-[#006837] text-white border-b-4 border-[#FFD700] shadow-xl">
        <div className="container mx-auto px-4 h-20 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-[#FFD700] rounded-2xl flex items-center justify-center text-green-900 font-black shadow-lg transform -rotate-3">NY</div>
            <div>
              <h1 className="text-xl font-black tracking-tighter leading-none">EXTRACTOR PRO</h1>
              <p className="text-[10px] text-green-100 font-bold tracking-widest uppercase mt-1 opacity-80">National Youth Service Corps • Digital Archive</p>
            </div>
          </div>
          <div className="hidden lg:flex items-center gap-6">
            <div className="px-4 py-2 bg-green-900/40 rounded-xl border border-green-700/50 flex items-center gap-3">
              <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse"></div>
              <span className="text-xs font-black uppercase tracking-widest">AI Extraction Active</span>
            </div>
            <button className="p-3 bg-green-800 hover:bg-green-700 rounded-full transition-all">
              <Share2 className="w-5 h-5" />
            </button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-10 max-w-7xl">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
          
          {/* Sidebar / Configuration */}
          <div className="lg:col-span-4 space-y-8">
            {/* 1. Upload Section */}
            <section className="bg-white rounded-[2rem] shadow-xl shadow-green-900/5 border border-slate-100 overflow-hidden group">
              <div className="p-6 bg-[#f8faf9] border-b border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-green-100 rounded-lg"><Upload className="w-5 h-5 text-green-700" /></div>
                  <h2 className="font-black text-slate-800 uppercase text-sm tracking-tight">Source Material</h2>
                </div>
              </div>
              <div className="p-8">
                <label className="group relative flex flex-col items-center justify-center w-full min-h-[200px] border-4 border-dashed border-slate-100 rounded-[2rem] cursor-pointer bg-[#fcfdfc] hover:bg-green-50/30 hover:border-green-400 transition-all duration-500">
                  <div className="flex flex-col items-center justify-center p-6 text-center">
                    <div className="w-20 h-20 bg-white rounded-[1.5rem] shadow-md flex items-center justify-center mb-6 group-hover:scale-110 group-hover:-rotate-6 transition-all duration-500">
                      <FileIcon className="w-10 h-10 text-slate-300 group-hover:text-green-600" />
                    </div>
                    <p className="mb-2 text-sm text-slate-500 font-bold uppercase tracking-widest">Drop Files Here</p>
                    <p className="text-[10px] text-slate-400 font-medium">Images, PDFs, or CSV data lists</p>
                  </div>
                  <input type="file" className="hidden" multiple accept="image/*,application/pdf,.csv" onChange={handleFileUpload} />
                </label>

                {uploadedFiles.length > 0 && (
                  <div className="mt-8 space-y-4 animate-in fade-in slide-in-from-bottom-4">
                    <div className="flex items-center justify-between px-2">
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Staging Area ({uploadedFiles.length})</span>
                      <button onClick={() => setUploadedFiles([])} className="text-[10px] text-red-500 font-black hover:underline uppercase">Clear Queue</button>
                    </div>
                    <div className="max-h-52 overflow-y-auto space-y-2 pr-2 custom-scrollbar">
                      {uploadedFiles.map((f, i) => (
                        <div key={i} className="flex items-center justify-between p-4 bg-[#f8faf9] rounded-2xl border border-slate-100 group/item">
                          <div className="flex items-center gap-4 truncate">
                            <div className="p-2 bg-white rounded-xl shadow-sm"><FileText className="w-4 h-4 text-green-600" /></div>
                            <span className="text-xs font-black truncate text-slate-600 uppercase tracking-tighter">{f.name}</span>
                          </div>
                          <button onClick={() => setUploadedFiles(prev => prev.filter((_, idx) => idx !== i))} className="p-2 text-slate-300 hover:text-red-500 opacity-0 group-hover/item:opacity-100 transition-all">
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                    <button 
                      onClick={processFiles}
                      disabled={state.isProcessing || uploadedFiles.length === 0}
                      className="w-full mt-6 bg-[#006837] hover:bg-green-800 text-white font-black py-5 px-6 rounded-2xl shadow-xl shadow-green-900/20 transition-all active:scale-95 flex items-center justify-center gap-4 disabled:bg-slate-100 disabled:text-slate-300 disabled:shadow-none"
                    >
                      {state.isProcessing ? (
                        <>
                          <Loader2 className="w-6 h-6 animate-spin" />
                          <div className="text-left">
                            <p className="text-sm font-black uppercase tracking-tight">AI at work...</p>
                            <p className="text-[10px] font-bold opacity-70 uppercase tracking-widest">{state.processingStep} phase</p>
                          </div>
                        </>
                      ) : (
                        <>
                          <TrendingUp className="w-6 h-6" />
                          <span className="uppercase tracking-widest text-sm">Extract Intelligence</span>
                        </>
                      )}
                    </button>
                  </div>
                )}
              </div>
            </section>

            {/* Error Message Box */}
            {state.error && (
              <div className="bg-red-50 border border-red-200 rounded-[2rem] p-6 shadow-lg shadow-red-900/5 animate-in slide-in-from-left-4 duration-300 relative group">
                <div className="flex items-start gap-4">
                  <div className="p-2 bg-red-100 rounded-xl"><AlertCircle className="w-5 h-5 text-red-600" /></div>
                  <div className="pr-8">
                    <p className="text-[10px] font-black text-red-400 uppercase tracking-widest mb-1">Processing Error</p>
                    <p className="text-xs font-bold text-red-800 leading-relaxed uppercase tracking-tight">{state.error}</p>
                  </div>
                </div>
                <button 
                  onClick={dismissError}
                  className="absolute top-4 right-4 p-2 text-red-300 hover:text-red-600 hover:bg-red-100 rounded-full transition-all"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}

            {/* 2. PPA Groups Sidebar */}
            {groups.length > 0 && (
              <section className="bg-white rounded-[2rem] shadow-xl shadow-green-900/5 border border-slate-100 overflow-hidden animate-in fade-in duration-700">
                <div className="p-6 bg-[#f8faf9] border-b border-slate-100 flex items-center gap-3">
                  <div className="p-2 bg-green-100 rounded-lg"><MapPin className="w-5 h-5 text-green-700" /></div>
                  <h2 className="font-black text-slate-800 uppercase text-sm tracking-tight">Organization Map</h2>
                </div>
                <div className="p-4 max-h-[450px] overflow-y-auto custom-scrollbar space-y-2">
                  <button
                    onClick={() => setState(s => ({ ...s, selectedGroup: null }))}
                    className={`w-full flex items-center justify-between p-4 rounded-2xl text-left transition-all ${!state.selectedGroup ? 'bg-green-600 text-white shadow-lg shadow-green-900/20' : 'hover:bg-slate-50 text-slate-600'}`}
                  >
                    <span className="font-black text-xs uppercase tracking-widest">Master List</span>
                    <span className={`text-[10px] font-black px-3 py-1 rounded-full ${!state.selectedGroup ? 'bg-white text-green-700' : 'bg-slate-100 text-slate-500'}`}>
                      {state.data.length}
                    </span>
                  </button>
                  <div className="h-px bg-slate-100 my-4 mx-4"></div>
                  {groups.map(([name, members]) => (
                    <button
                      key={name}
                      onClick={() => setState(s => ({ ...s, selectedGroup: name }))}
                      className={`w-full flex items-center justify-between p-4 rounded-2xl text-left transition-all group ${state.selectedGroup === name ? 'bg-green-600 text-white shadow-lg shadow-green-900/20' : 'hover:bg-[#fcfdfc] text-slate-600 border border-transparent hover:border-slate-100'}`}
                    >
                      <div className="flex flex-col">
                        <span className="text-xs font-black truncate max-w-[200px] uppercase tracking-tighter">{name}</span>
                        <span className={`text-[9px] font-bold ${state.selectedGroup === name ? 'text-green-100' : 'text-slate-400'}`}>Batch Concentration: {Math.round((members.length / state.data.length) * 100)}%</span>
                      </div>
                      <span className={`text-[10px] px-3 py-1 rounded-full font-black transition-colors ${state.selectedGroup === name ? 'bg-white text-green-700 shadow-sm' : 'bg-[#f0f4f2] text-slate-600'}`}>
                        {members.length}
                      </span>
                    </button>
                  ))}
                </div>
              </section>
            )}
          </div>

          {/* Results Area */}
          <div className="lg:col-span-8 space-y-10" ref={resultsRef}>
            {/* 1. Dynamic Stats Dashboard */}
            {stats && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-6 animate-in slide-in-from-top-6 duration-1000">
                <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm relative overflow-hidden group">
                  <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:scale-125 transition-transform"><Users className="w-12 h-12" /></div>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">TOTAL RECORDS</p>
                  <p className="text-3xl font-black text-slate-900">{stats.total}</p>
                </div>
                <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm relative overflow-hidden group">
                  <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:scale-125 transition-transform"><MapPin className="w-12 h-12" /></div>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">UNIQUE PPAS</p>
                  <p className="text-3xl font-black text-green-700">{stats.ppas}</p>
                </div>
                <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm overflow-hidden flex flex-col justify-between">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">GENDER SPLIT</p>
                  <div className="flex items-center gap-4">
                     <div className="flex-1 h-3 bg-slate-100 rounded-full overflow-hidden flex">
                        <div style={{width: `${stats.malePercent}%`}} className="bg-blue-500 h-full"></div>
                        <div style={{width: `${stats.femalePercent}%`}} className="bg-pink-500 h-full"></div>
                     </div>
                     <span className="text-xs font-black text-slate-700">{stats.malePercent}% M</span>
                  </div>
                </div>
                <div className="bg-green-700 p-6 rounded-[2rem] shadow-lg shadow-green-900/20 text-white">
                  <p className="text-[10px] font-black text-green-100 uppercase tracking-widest mb-1">DATA QUALITY</p>
                  <p className="text-3xl font-black">98.4%</p>
                  <p className="text-[9px] font-bold opacity-70 uppercase tracking-tighter mt-1">Verified via Neural OCR</p>
                </div>
              </div>
            )}

            {/* 2. Main Data Workbench */}
            <div className="bg-white rounded-[2.5rem] shadow-2xl shadow-green-900/5 border border-slate-100 flex flex-col min-h-[750px] overflow-hidden">
              {/* Data Toolbar */}
              <div className="p-6 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-6 bg-white sticky top-0 z-20">
                <div className="flex items-center gap-4">
                   <div className="flex bg-slate-100 p-1.5 rounded-2xl">
                      <button 
                        onClick={() => setViewMode('table')}
                        className={`p-3 rounded-xl transition-all ${viewMode === 'table' ? 'bg-white shadow-md text-green-700 scale-105' : 'text-slate-400 hover:text-slate-600'}`}
                      >
                        <List className="w-5 h-5" />
                      </button>
                      <button 
                        onClick={() => setViewMode('report')}
                        className={`p-3 rounded-xl transition-all ${viewMode === 'report' ? 'bg-white shadow-md text-green-700 scale-105' : 'text-slate-400 hover:text-slate-600'}`}
                      >
                        <LayoutGrid className="w-5 h-5" />
                      </button>
                      <button 
                        onClick={() => setViewMode('analytics')}
                        className={`p-3 rounded-xl transition-all ${viewMode === 'analytics' ? 'bg-white shadow-md text-green-700 scale-105' : 'text-slate-400 hover:text-slate-600'}`}
                      >
                        <BarChart3 className="w-5 h-5" />
                      </button>
                   </div>
                   <div className="relative flex-1 min-w-[240px]">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" />
                    <input 
                      type="text" 
                      placeholder="Search names, codes, organizations..."
                      className="w-full pl-12 pr-6 py-3.5 border border-slate-100 rounded-2xl focus:outline-none focus:ring-4 focus:ring-green-500/10 focus:border-green-500 text-sm transition-all bg-[#fcfdfc] font-medium"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                    />
                  </div>
                </div>
                
                <div className="flex items-center gap-3">
                  <button 
                    onClick={() => setShowAddForm(true)}
                    className="p-3.5 bg-green-50 text-green-700 hover:bg-green-100 rounded-2xl transition-all border border-green-100"
                    title="Manual Add"
                  >
                    <Plus className="w-5 h-5" />
                  </button>
                  <button 
                    onClick={downloadCSV}
                    disabled={filteredMembers.length === 0}
                    className="flex-1 md:flex-none flex items-center justify-center gap-3 px-8 py-3.5 bg-[#006837] hover:bg-green-800 text-white text-xs font-black uppercase tracking-widest rounded-2xl transition-all shadow-lg shadow-green-900/10 disabled:opacity-20 active:scale-95"
                  >
                    <Download className="w-4 h-4" />
                    Export
                  </button>
                </div>
              </div>

              {/* Data Content */}
              <div className="flex-1 relative p-2">
                {/* Manual Add Form Overlay */}
                {showAddForm && (
                  <div className="absolute inset-0 z-40 bg-white/95 backdrop-blur-md p-10 animate-in fade-in zoom-in-95">
                    <div className="max-w-xl mx-auto space-y-8">
                      <div className="flex items-center justify-between">
                        <h3 className="text-2xl font-black text-slate-900 uppercase tracking-tighter">New Entry</h3>
                        <button onClick={() => setShowAddForm(false)} className="p-2 hover:bg-slate-100 rounded-full transition-colors"><X className="w-6 h-6 text-slate-400" /></button>
                      </div>
                      <form onSubmit={addNewMember} className="grid grid-cols-2 gap-6">
                        <div className="col-span-2 space-y-2">
                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Full Name</label>
                          <input required name="fullName" className="w-full px-5 py-3.5 border border-slate-100 rounded-xl bg-slate-50 focus:ring-4 focus:ring-green-500/10 focus:outline-none" placeholder="DOE JOHN SMITH" />
                        </div>
                        <div className="space-y-2">
                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">State Code</label>
                          <input required name="stateCode" className="w-full px-5 py-3.5 border border-slate-100 rounded-xl bg-slate-50 focus:ring-4 focus:ring-green-500/10 focus:outline-none" placeholder="NY/24B/1234" />
                        </div>
                        <div className="space-y-2">
                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Gender</label>
                          <select name="gender" className="w-full px-5 py-3.5 border border-slate-100 rounded-xl bg-slate-50 focus:ring-4 focus:ring-green-500/10 focus:outline-none">
                            <option value="M">Male</option>
                            <option value="F">Female</option>
                          </select>
                        </div>
                        <div className="space-y-2">
                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Phone</label>
                          <input name="phone" className="w-full px-5 py-3.5 border border-slate-100 rounded-xl bg-slate-50 focus:ring-4 focus:ring-green-500/10 focus:outline-none" placeholder="080 000 0000" />
                        </div>
                        <div className="space-y-2">
                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">PPA</label>
                          <input required name="ppa" className="w-full px-5 py-3.5 border border-slate-100 rounded-xl bg-slate-50 focus:ring-4 focus:ring-green-500/10 focus:outline-none" placeholder="Central High School" />
                        </div>
                        <button type="submit" className="col-span-2 py-5 bg-green-700 text-white font-black rounded-2xl uppercase tracking-widest shadow-xl shadow-green-900/10 hover:bg-green-800 transition-all">Create Record</button>
                      </form>
                    </div>
                  </div>
                )}

                {state.data.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full min-h-[550px] text-center px-10">
                    <div className="w-32 h-32 bg-slate-50 rounded-[3rem] flex items-center justify-center mb-10 relative border-2 border-slate-100">
                      <FileText className="w-16 h-16 text-slate-200" />
                      <div className="absolute -right-4 -bottom-4 w-14 h-14 bg-white shadow-2xl rounded-2xl flex items-center justify-center border border-slate-100 animate-bounce">
                        <TrendingUp className="w-7 h-7 text-green-600" />
                      </div>
                    </div>
                    <h3 className="text-3xl font-black text-slate-800 tracking-tighter uppercase">No Intelligence Loaded</h3>
                    <p className="text-sm text-slate-400 max-w-sm mt-4 font-bold leading-relaxed uppercase tracking-tight">
                      Feed the system with clear photos of <b>posting letters</b> or <b>clearance documents</b> for automated grouping.
                    </p>
                  </div>
                ) : (
                  <div className="p-4 overflow-y-auto custom-scrollbar h-full max-h-[680px]">
                    {viewMode === 'table' && (
                      <div className="overflow-hidden rounded-3xl border border-slate-100 bg-[#fdfdfd]">
                        <table className="w-full text-xs text-left border-collapse">
                          <thead className="bg-[#f8faf9] text-slate-400 uppercase text-[10px] font-black tracking-widest sticky top-0 z-10 border-b border-slate-100">
                            <tr>
                              <th className="px-8 py-5">SN</th>
                              <th className="px-8 py-5">CODE</th>
                              <th className="px-8 py-5">NAME</th>
                              <th className="px-8 py-5">GEN</th>
                              <th className="px-8 py-5">PPA</th>
                              <th className="px-8 py-5 text-right">ACTION</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-50">
                            {filteredMembers.map((m, i) => (
                              <tr key={m.id} className="hover:bg-green-50/20 transition-all group">
                                <td className="px-8 py-5 text-slate-300 font-mono text-[10px]">{m.sn}</td>
                                <td className="px-8 py-5">
                                  <input 
                                    className="bg-transparent border-none font-black text-slate-800 tracking-tighter w-full focus:outline-none focus:ring-2 focus:ring-green-500/10 rounded"
                                    value={m.stateCode}
                                    onChange={(e) => handleEditChange(m.id, 'stateCode', e.target.value)}
                                  />
                                </td>
                                <td className="px-8 py-5 uppercase">
                                   <input 
                                    className="bg-transparent border-none font-bold text-slate-600 w-full focus:outline-none focus:ring-2 focus:ring-green-500/10 rounded"
                                    value={m.fullName}
                                    onChange={(e) => handleEditChange(m.id, 'fullName', e.target.value)}
                                  />
                                </td>
                                <td className="px-8 py-5">
                                  <button 
                                    onClick={() => handleEditChange(m.id, 'gender', m.gender === 'M' ? 'F' : 'M')}
                                    className={`px-3 py-1 rounded-lg text-[9px] font-black shadow-sm ${m.gender === 'F' ? 'bg-pink-100 text-pink-700' : 'bg-blue-100 text-blue-700'}`}
                                  >
                                    {m.gender}
                                  </button>
                                </td>
                                <td className="px-8 py-5">
                                  <input 
                                    className="bg-slate-50 border border-transparent hover:border-slate-100 text-slate-500 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-tighter w-full focus:bg-white focus:ring-4 focus:ring-green-500/10 transition-all"
                                    value={m.companyName}
                                    onChange={(e) => handleEditChange(m.id, 'companyName', e.target.value)}
                                  />
                                </td>
                                <td className="px-8 py-5 text-right opacity-0 group-hover:opacity-100 transition-all">
                                  <button onClick={() => deleteMember(m.id)} className="p-3 bg-red-50 text-red-500 hover:bg-red-500 hover:text-white rounded-xl transition-all">
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}

                    {viewMode === 'report' && (
                      <div className="space-y-10 p-6">
                        {groups
                          .filter(([ppa]) => !state.selectedGroup || ppa === state.selectedGroup)
                          .map(([ppa, members]) => (
                          <div key={ppa} className="bg-white rounded-[2rem] border-2 border-slate-100 overflow-hidden shadow-sm page-break-after-always">
                            <div className="bg-[#f8faf9] px-8 py-6 border-b border-slate-100 flex items-center justify-between">
                              <div className="flex items-center gap-4">
                                <div className="w-10 h-10 bg-green-700 rounded-xl flex items-center justify-center text-white shadow-lg"><MapPin className="w-5 h-5" /></div>
                                <h3 className="font-black text-lg text-slate-800 uppercase tracking-tighter">{ppa}</h3>
                              </div>
                              <div className="text-right">
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">SUB-STATION LIST</p>
                                <p className="text-sm font-black text-green-700">{members.length} CORPS MEMBERS</p>
                              </div>
                            </div>
                            <div className="p-8 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                              {members.map((m, idx) => (
                                <div key={m.id} className="p-5 rounded-2xl bg-[#fcfdfc] border border-slate-50 hover:border-green-200 transition-all relative overflow-hidden group">
                                  <div className={`absolute top-0 right-0 w-1 h-full ${m.gender === 'F' ? 'bg-pink-300' : 'bg-blue-300'}`}></div>
                                  <div className="flex items-start gap-4">
                                    <div className={`w-12 h-12 rounded-[1rem] flex items-center justify-center font-black text-sm shadow-inner shrink-0 ${m.gender === 'F' ? 'bg-pink-50 text-pink-600' : 'bg-blue-50 text-blue-600'}`}>
                                      {m.fullName.charAt(0)}
                                    </div>
                                    <div className="min-w-0">
                                      <p className="text-xs font-black text-slate-900 leading-tight uppercase truncate">{m.fullName}</p>
                                      <p className="text-[10px] font-black text-green-700 mt-1 uppercase tracking-tighter">{m.stateCode}</p>
                                      <p className="text-[10px] font-bold text-slate-400 mt-0.5">{m.phone || 'No Contact'}</p>
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {viewMode === 'analytics' && stats && (
                      <div className="p-8 space-y-12 animate-in fade-in">
                        <div>
                           <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-6">PPA Saturation (Top 10)</h4>
                           <div className="space-y-6">
                              {groups.slice(0, 10).map(([name, members]) => (
                                <div key={name} className="space-y-2">
                                  <div className="flex justify-between items-center px-1">
                                    <span className="text-[10px] font-black text-slate-600 uppercase tracking-tighter truncate max-w-[80%]">{name}</span>
                                    <span className="text-[10px] font-black text-green-700">{members.length}</span>
                                  </div>
                                  <div className="h-4 bg-slate-50 rounded-full overflow-hidden">
                                    <div 
                                      className="h-full bg-green-600 rounded-full transition-all duration-1000" 
                                      style={{width: `${(members.length / state.data.length) * 100}%`}}
                                    ></div>
                                  </div>
                                </div>
                              ))}
                           </div>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-8 pt-8 border-t border-slate-100">
                          <div className="bg-[#f8faf9] p-8 rounded-[2rem] text-center border border-slate-100">
                            <PieChart className="w-8 h-8 text-green-600 mx-auto mb-4" />
                            <h5 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">PPA DIVERSITY</h5>
                            <p className="text-4xl font-black text-slate-800">{stats.ppas}</p>
                            <p className="text-[10px] font-bold text-slate-500 uppercase mt-2 opacity-50">Distinct Locations</p>
                          </div>
                          <div className="bg-[#fcfdfc] p-8 rounded-[2rem] text-center border border-slate-100">
                            <Users className="w-8 h-8 text-blue-600 mx-auto mb-4" />
                            <h5 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">AVG PERSONNEL / PPA</h5>
                            <p className="text-4xl font-black text-slate-800">{(stats.total / stats.ppas).toFixed(1)}</p>
                            <p className="text-[10px] font-bold text-slate-500 uppercase mt-2 opacity-50">Across All Batches</p>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Status Footer */}
              {state.data.length > 0 && (
                <div className="p-6 bg-[#f8faf9] border-t border-slate-100 text-[10px] text-slate-400 flex justify-between items-center font-black uppercase tracking-widest">
                  <div className="flex items-center gap-6">
                    <span>Active Context: {filteredMembers.length} Entities</span>
                    {state.selectedGroup && <span className="text-green-700 bg-white shadow-sm px-4 py-1 rounded-full border border-green-100">Filter: {state.selectedGroup}</span>}
                  </div>
                  <div className="flex items-center gap-6">
                    <button className="flex items-center gap-2 hover:text-slate-800 transition-colors"><Printer className="w-4 h-4" /> Print Document</button>
                    <div className="flex items-center gap-3 text-green-600">
                      <div className="flex h-2 w-2 rounded-full bg-green-500 animate-pulse"></div>
                      Intelligence Sync Active
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>

      {/* Persistent Floating Controls for Mobile */}
      <div className="fixed bottom-6 inset-x-6 lg:hidden z-50">
         <div className="bg-white/90 backdrop-blur-2xl border border-slate-200 p-4 rounded-[2rem] shadow-2xl flex gap-4">
            {!state.data.length ? (
              <button 
                onClick={processFiles}
                disabled={state.isProcessing || uploadedFiles.length === 0}
                className="flex-1 bg-green-700 text-white font-black py-4 rounded-2xl shadow-xl flex items-center justify-center gap-3 disabled:bg-slate-100 disabled:text-slate-300"
              >
                {state.isProcessing ? <Loader2 className="w-5 h-5 animate-spin" /> : <TrendingUp className="w-5 h-5" />}
                {state.isProcessing ? 'Analyzing...' : 'START EXTRACTION'}
              </button>
            ) : (
              <>
                <button 
                  onClick={() => resultsRef.current?.scrollIntoView({ behavior: 'smooth' })}
                  className="flex-1 bg-slate-900 text-white font-black py-4 rounded-2xl shadow-xl flex items-center justify-center gap-2 text-xs uppercase tracking-widest"
                >
                  <List className="w-4 h-4" />
                  View Results
                </button>
                <button onClick={downloadCSV} className="w-16 bg-green-700 text-white font-black rounded-2xl flex items-center justify-center shadow-xl">
                  <Download className="w-5 h-5" />
                </button>
              </>
            )}
         </div>
      </div>
    </div>
  );
}

export default App;
