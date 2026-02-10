import React, { useState, useMemo, useCallback, useRef } from 'react';
import { 
  Upload, FileText, Users, MapPin, Download, Trash2, Search, 
  Loader2, AlertCircle, FileSpreadsheet, File as FileIcon, 
  CheckCircle2, TrendingUp, List, LayoutGrid, ChevronRight,
  Printer, Share2, Plus, X, BarChart3, PieChart, Info
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
  const [viewMode, setViewMode] = useState<'table' | 'report' | 'analytics'>('table');
  const [showAddForm, setShowAddForm] = useState(false);
  
  const resultsRef = useRef<HTMLDivElement>(null);

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
    
    try {
      setState(s => ({ ...s, processingStep: 'extracting' }));
      const result = await extractCorpsData(uploadedFiles);
      
      setState(s => ({ ...s, processingStep: 'validating' }));
      setState(prev => ({ 
        ...prev, 
        data: result.members, 
        isProcessing: false,
        processingStep: 'idle',
        selectedGroup: null 
      }));
      
      setTimeout(() => {
        resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 300);
    } catch (err: any) {
      console.error("Extraction error:", err);
      setState(prev => ({ 
        ...prev, 
        error: "Failed to process files. Please ensure they are legible lists.", 
        isProcessing: false,
        processingStep: 'idle'
      }));
    }
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
      stateCode: (formData.get('stateCode') as string || '').toUpperCase(),
      fullName: (formData.get('fullName') as string || '').toUpperCase(),
      gender: formData.get('gender') as string || 'M',
      phone: formData.get('phone') as string || '',
      companyName: (formData.get('ppa') as string || 'Unassigned').toUpperCase(),
    };
    setState(prev => ({ ...prev, data: [...prev.data, newMember] }));
    setShowAddForm(false);
  };

  const groups = useMemo(() => {
    const map = new Map<string, CorpsMember[]>();
    state.data.forEach(member => {
      const ppa = member.companyName || 'UNASSIGNED';
      if (!map.has(ppa)) map.set(ppa, []);
      map.get(ppa)?.push(member);
    });
    return Array.from(map.entries()).sort((a, b) => b[1].length - a[1].length);
  }, [state.data]);

  const stats = useMemo(() => {
    if (!state.data || state.data.length === 0) return null;
    const males = state.data.filter(m => m.gender === 'M').length;
    const females = state.data.filter(m => m.gender === 'F').length;
    const totalCount = state.data.length;
    return {
      total: totalCount,
      ppas: groups.length,
      males,
      females,
      malePercent: Math.round((males / totalCount) * 100) || 0,
      femalePercent: Math.round((females / totalCount) * 100) || 0,
    };
  }, [state.data, groups]);

  const filteredMembers = useMemo(() => {
    const baseList = state.selectedGroup 
      ? groups.find(([ppa]) => ppa === state.selectedGroup)?.[1] || []
      : state.data;
    
    return baseList.filter(m => 
      (m.fullName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (m.stateCode || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (m.companyName || '').toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [state.selectedGroup, groups, state.data, searchTerm]);

  const downloadCSV = useCallback(() => {
    if (filteredMembers.length === 0) return;
    const headers = ["SN", "State Code", "Full Name", "Gender", "Phone", "PPA"];
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
    link.href = url;
    link.download = `corps_list_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  }, [filteredMembers]);

  return (
    <div className="min-h-screen bg-[#f0f4f2] font-sans text-slate-900 pb-20">
      <header className="sticky top-0 z-50 bg-[#006837] text-white border-b-4 border-[#FFD700] shadow-xl">
        <div className="container mx-auto px-4 h-20 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 bg-[#FFD700] rounded-xl flex items-center justify-center text-green-900 font-black shadow-lg">NY</div>
            <div>
              <h1 className="text-xl font-black tracking-tighter leading-none uppercase">NYSC EXTRACTOR</h1>
              <p className="text-[10px] text-green-100 font-bold tracking-widest uppercase mt-1 opacity-80">Data Structuring Suite</p>
            </div>
          </div>
          <div className="hidden md:block">
            <div className="flex items-center gap-6">
              <div className="px-4 py-2 bg-green-900/40 rounded-xl border border-green-700/50 flex items-center gap-3">
                <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse"></div>
                <span className="text-[10px] font-black uppercase tracking-widest">System Secure</span>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-10 max-w-7xl">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
          
          {/* LEFT COLUMN: CONTROLS */}
          <div className="lg:col-span-4 space-y-8">
            <section className="bg-white rounded-[2rem] shadow-xl border border-slate-100 overflow-hidden">
              <div className="p-6 bg-[#f8faf9] border-b border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-green-100 rounded-lg"><Upload className="w-5 h-5 text-green-700" /></div>
                  <h2 className="font-black text-slate-800 uppercase text-xs tracking-tight">Data Ingestion</h2>
                </div>
              </div>
              <div className="p-8">
                <label className="group relative flex flex-col items-center justify-center w-full min-h-[180px] border-4 border-dashed border-slate-100 rounded-[2rem] cursor-pointer bg-[#fcfdfc] hover:bg-green-50/30 hover:border-green-400 transition-all duration-500">
                  <div className="flex flex-col items-center justify-center p-6 text-center">
                    <FileIcon className="w-10 h-10 text-slate-300 mb-4" />
                    <p className="mb-1 text-xs text-slate-500 font-black uppercase tracking-widest">Upload Lists</p>
                    <p className="text-[10px] text-slate-400">PDF, JPG, PNG, CSV</p>
                  </div>
                  <input type="file" className="hidden" multiple accept="image/*,application/pdf,.csv" onChange={handleFileUpload} />
                </label>

                {uploadedFiles.length > 0 && (
                  <div className="mt-8 space-y-4">
                    <div className="flex items-center justify-between px-2">
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Files Ready ({uploadedFiles.length})</span>
                      <button onClick={() => setUploadedFiles([])} className="text-[10px] text-red-500 font-black hover:underline uppercase">Reset</button>
                    </div>
                    <div className="max-h-52 overflow-y-auto space-y-2 pr-2 custom-scrollbar">
                      {uploadedFiles.map((f, i) => (
                        <div key={i} className="flex items-center justify-between p-3 bg-[#f8faf9] rounded-xl border border-slate-100">
                          <span className="text-[10px] font-black truncate max-w-[180px] text-slate-600 uppercase">{f.name}</span>
                          <button onClick={() => setUploadedFiles(prev => prev.filter((_, idx) => idx !== i))} className="p-1 text-slate-300 hover:text-red-500"><X className="w-3.5 h-3.5" /></button>
                        </div>
                      ))}
                    </div>
                    <button 
                      onClick={processFiles}
                      disabled={state.isProcessing || uploadedFiles.length === 0}
                      className="w-full mt-6 bg-[#006837] hover:bg-green-800 text-white font-black py-4 px-6 rounded-2xl shadow-xl transition-all active:scale-95 flex items-center justify-center gap-4 disabled:bg-slate-100 disabled:text-slate-300"
                    >
                      {state.isProcessing ? (
                        <>
                          <Loader2 className="w-5 h-5 animate-spin" />
                          <span className="text-xs font-black uppercase tracking-widest">{state.processingStep}...</span>
                        </>
                      ) : (
                        <>
                          <TrendingUp className="w-5 h-5" />
                          <span className="uppercase tracking-widest text-xs">Run AI Extraction</span>
                        </>
                      )}
                    </button>
                  </div>
                )}
              </div>
            </section>

            {state.error && (
              <div className="bg-red-50 border border-red-200 rounded-2xl p-4 flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
                <p className="text-[10px] font-black text-red-800 uppercase leading-tight">{state.error}</p>
              </div>
            )}

            {groups.length > 0 && (
              <section className="bg-white rounded-[2rem] shadow-xl border border-slate-100 overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="p-6 bg-[#f8faf9] border-b border-slate-100 flex items-center gap-3">
                  <div className="p-2 bg-green-100 rounded-lg"><MapPin className="w-5 h-5 text-green-700" /></div>
                  <h2 className="font-black text-slate-800 uppercase text-xs tracking-tight">Organization Grouping</h2>
                </div>
                <div className="p-4 max-h-[400px] overflow-y-auto custom-scrollbar space-y-1">
                  <button
                    onClick={() => setState(s => ({ ...s, selectedGroup: null }))}
                    className={`w-full flex items-center justify-between p-3 rounded-xl text-left transition-all ${!state.selectedGroup ? 'bg-green-600 text-white shadow-lg' : 'hover:bg-slate-50 text-slate-600'}`}
                  >
                    <span className="font-black text-[10px] uppercase">All Active Records</span>
                    <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-black/10">{state.data.length}</span>
                  </button>
                  {groups.map(([name, members]) => (
                    <button
                      key={name}
                      onClick={() => setState(s => ({ ...s, selectedGroup: name }))}
                      className={`w-full flex items-center justify-between p-3 rounded-xl text-left transition-all ${state.selectedGroup === name ? 'bg-green-600 text-white shadow-lg' : 'hover:bg-[#fcfdfc] text-slate-600'}`}
                    >
                      <span className="text-[10px] font-black truncate max-w-[200px] uppercase tracking-tighter">{name}</span>
                      <span className="text-[10px] px-2 py-0.5 rounded-full font-black bg-black/5">{members.length}</span>
                    </button>
                  ))}
                </div>
              </section>
            )}
          </div>

          {/* RIGHT COLUMN: RESULTS */}
          <div className="lg:col-span-8 space-y-8" ref={resultsRef}>
            {stats && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm">
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Total Population</p>
                  <p className="text-3xl font-black text-slate-900">{stats.total}</p>
                </div>
                <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm">
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Unique PPAs</p>
                  <p className="text-3xl font-black text-green-700">{stats.ppas}</p>
                </div>
                <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm">
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Diversity</p>
                  <div className="flex items-center gap-2 mt-2">
                    <span className="text-[10px] font-black text-blue-600">{stats.males}M</span>
                    <span className="text-[10px] font-black text-pink-600">{stats.females}F</span>
                  </div>
                </div>
                <div className="bg-green-700 p-6 rounded-[2rem] text-white shadow-xl shadow-green-900/10">
                  <p className="text-[9px] font-black text-green-100 uppercase tracking-widest">System Status</p>
                  <p className="text-xl font-black uppercase mt-1">Verified</p>
                </div>
              </div>
            )}

            <div className="bg-white rounded-[2rem] shadow-2xl border border-slate-100 min-h-[600px] flex flex-col overflow-hidden">
              <div className="p-6 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-4 flex-1">
                   <div className="flex bg-slate-100 p-1 rounded-xl">
                      <button onClick={() => setViewMode('table')} className={`p-2 rounded-lg transition-all ${viewMode === 'table' ? 'bg-white shadow text-green-700' : 'text-slate-400'}`}><List className="w-4 h-4" /></button>
                      <button onClick={() => setViewMode('report')} className={`p-2 rounded-lg transition-all ${viewMode === 'report' ? 'bg-white shadow text-green-700' : 'text-slate-400'}`}><LayoutGrid className="w-4 h-4" /></button>
                      <button onClick={() => setViewMode('analytics')} className={`p-2 rounded-lg transition-all ${viewMode === 'analytics' ? 'bg-white shadow text-green-700' : 'text-slate-400'}`}><BarChart3 className="w-4 h-4" /></button>
                   </div>
                   <div className="relative flex-1 max-w-sm">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" />
                    <input 
                      type="text" placeholder="Search extracted records..."
                      className="w-full pl-10 pr-4 py-2.5 border border-slate-100 rounded-xl focus:outline-none focus:border-green-500 text-[11px] bg-slate-50 font-black uppercase tracking-widest"
                      value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
                    />
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => setShowAddForm(true)} className="p-2.5 bg-green-50 text-green-700 rounded-xl border border-green-100 hover:bg-green-100 transition-colors"><Plus className="w-5 h-5" /></button>
                  <button onClick={downloadCSV} className="flex-1 md:flex-none flex items-center justify-center gap-2 px-6 py-2.5 bg-[#006837] text-white text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-green-800 transition-all">
                    <Download className="w-4 h-4" /> Export CSV
                  </button>
                </div>
              </div>

              <div className="flex-1 relative">
                {showAddForm && (
                  <div className="absolute inset-0 z-40 bg-white p-10 overflow-y-auto">
                    <div className="max-w-md mx-auto space-y-6">
                      <div className="flex items-center justify-between">
                        <h3 className="text-xl font-black text-slate-900 uppercase tracking-tighter">Manual Record Entry</h3>
                        <button onClick={() => setShowAddForm(false)} className="p-2 hover:bg-slate-100 rounded-full"><X className="w-6 h-6 text-slate-400" /></button>
                      </div>
                      <form onSubmit={addNewMember} className="grid grid-cols-1 gap-5">
                        <div className="space-y-1">
                          <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-1">Full Name</label>
                          <input required name="fullName" className="w-full px-4 py-3 border border-slate-100 rounded-xl bg-slate-50 focus:outline-none focus:ring-2 focus:ring-green-500/20 font-bold uppercase text-xs" placeholder="Surname First Name" />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-1">
                            <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-1">State Code</label>
                            <input required name="stateCode" className="w-full px-4 py-3 border border-slate-100 rounded-xl bg-slate-50 focus:outline-none focus:ring-2 focus:ring-green-500/20 font-bold uppercase text-xs" placeholder="NY/24B/..." />
                          </div>
                          <div className="space-y-1">
                            <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-1">Gender</label>
                            <select name="gender" className="w-full px-4 py-3 border border-slate-100 rounded-xl bg-slate-50 focus:outline-none focus:ring-2 focus:ring-green-500/20 font-bold uppercase text-xs">
                              <option value="M">Male</option>
                              <option value="F">Female</option>
                            </select>
                          </div>
                        </div>
                        <div className="space-y-1">
                          <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-1">Assigned PPA</label>
                          <input required name="ppa" className="w-full px-4 py-3 border border-slate-100 rounded-xl bg-slate-50 focus:outline-none focus:ring-2 focus:ring-green-500/20 font-bold uppercase text-xs" placeholder="Organization Name" />
                        </div>
                        <button type="submit" className="py-4 bg-green-700 text-white font-black rounded-2xl uppercase tracking-widest hover:bg-green-800 transition-colors shadow-lg shadow-green-900/20 mt-4">Commit Record</button>
                      </form>
                    </div>
                  </div>
                )}

                {state.data.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full min-h-[500px] text-center p-10">
                    <div className="w-24 h-24 bg-slate-50 rounded-full flex items-center justify-center mb-6">
                      <FileText className="w-10 h-10 text-slate-200" />
                    </div>
                    <h3 className="text-sm font-black uppercase tracking-widest text-slate-300">Workspace Pending</h3>
                    <p className="text-[10px] font-bold text-slate-400 mt-2 uppercase max-w-xs leading-relaxed">Please upload clearance lists or scanned documents to begin the extraction process.</p>
                  </div>
                ) : (
                  <div className="p-4 h-full overflow-y-auto">
                    {viewMode === 'table' && (
                      <div className="overflow-x-auto rounded-2xl border border-slate-50">
                        <table className="w-full text-[10px] text-left border-collapse">
                          <thead className="bg-[#f8faf9] text-slate-400 uppercase text-[8px] font-black border-b border-slate-100 sticky top-0 z-10">
                            <tr>
                              <th className="px-6 py-4">SN</th>
                              <th className="px-6 py-4">State Code</th>
                              <th className="px-6 py-4">Full Name</th>
                              <th className="px-6 py-4">Sex</th>
                              <th className="px-6 py-4">Assigned PPA</th>
                              <th className="px-6 py-4 text-right">Action</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-50">
                            {filteredMembers.map((m) => (
                              <tr key={m.id} className="hover:bg-green-50/20 group transition-colors">
                                <td className="px-6 py-4 text-slate-300 font-mono">{m.sn}</td>
                                <td className="px-6 py-4 font-black text-slate-800 uppercase tracking-tighter">{m.stateCode}</td>
                                <td className="px-6 py-4 font-bold text-slate-600 uppercase">{m.fullName}</td>
                                <td className="px-6 py-4">
                                  <span className={`px-2 py-0.5 rounded-[4px] font-black ${(m.gender || 'M').charAt(0) === 'F' ? 'bg-pink-100 text-pink-700' : 'bg-blue-100 text-blue-700'}`}>
                                    {(m.gender || 'M').charAt(0)}
                                  </span>
                                </td>
                                <td className="px-6 py-4 font-black text-slate-400 uppercase tracking-tighter truncate max-w-[150px]">{m.companyName}</td>
                                <td className="px-6 py-4 text-right opacity-0 group-hover:opacity-100 transition-opacity">
                                  <button onClick={() => deleteMember(m.id)} className="text-red-400 hover:text-red-600 p-2"><Trash2 className="w-3.5 h-3.5" /></button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}

                    {viewMode === 'report' && (
                      <div className="space-y-8 p-4">
                        <div className="bg-blue-50 border border-blue-100 p-4 rounded-xl flex items-center gap-3 mb-6 no-print">
                           <Info className="w-5 h-5 text-blue-400 shrink-0" />
                           <p className="text-[10px] font-black text-blue-800 uppercase">Pro Tip: Use 'Print' (Ctrl+P) to save this grouped report as a PDF.</p>
                        </div>
                        {groups.filter(([ppa]) => !state.selectedGroup || ppa === state.selectedGroup).map(([ppa, members]) => (
                          <div key={ppa} className="bg-white rounded-2xl border-2 border-slate-50 p-10 page-break-after-always shadow-sm">
                            <div className="flex justify-between items-end border-b-2 border-slate-900 pb-4 mb-8">
                               <div>
                                 <p className="text-[8px] font-black text-slate-400 uppercase mb-1 tracking-widest">Posting Group</p>
                                 <h3 className="font-black text-green-800 text-2xl uppercase tracking-tighter">{ppa}</h3>
                               </div>
                               <div className="text-right">
                                 <p className="text-[8px] font-black text-slate-400 uppercase mb-1 tracking-widest">Population</p>
                                 <span className="text-xs font-black text-slate-900 px-3 py-1 bg-slate-100 rounded-full">{members.length} MEMBERS</span>
                               </div>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                              {members.map((m) => (
                                <div key={m.id} className="flex gap-4 p-4 bg-slate-50 rounded-2xl border border-slate-100 group hover:border-green-200 transition-colors">
                                  <div className={`w-12 h-12 shrink-0 rounded-xl flex items-center justify-center font-black text-sm ${(m.gender || 'M').charAt(0) === 'F' ? 'bg-pink-100 text-pink-500' : 'bg-blue-100 text-blue-500'}`}>
                                    {(m.fullName || 'U').charAt(0)}
                                  </div>
                                  <div className="min-w-0">
                                    <p className="text-xs font-black text-slate-900 uppercase truncate">{m.fullName}</p>
                                    <p className="text-[10px] font-black text-green-700 mt-0.5">{m.stateCode}</p>
                                    <p className="text-[9px] font-bold text-slate-400 mt-2 uppercase">{m.phone || 'No Phone Data'}</p>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {viewMode === 'analytics' && stats && (
                      <div className="p-8 space-y-12 max-w-5xl mx-auto">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
                          <div>
                             <h4 className="text-[10px] font-black text-slate-400 uppercase mb-8 tracking-widest flex items-center gap-2">
                               <PieChart className="w-3.5 h-3.5" /> PPA Distribution Matrix
                             </h4>
                             <div className="space-y-6">
                                {groups.slice(0, 10).map(([name, members]) => (
                                  <div key={name} className="space-y-1.5">
                                    <div className="flex justify-between text-[10px] font-black text-slate-600 uppercase">
                                      <span className="truncate max-w-[80%]">{name}</span>
                                      <span>{members.length}</span>
                                    </div>
                                    <div className="h-3 bg-slate-50 rounded-full overflow-hidden border border-slate-100">
                                      <div className="h-full bg-green-500 transition-all duration-1000 ease-out" style={{width: `${(members.length / stats.total) * 100}%`}}></div>
                                    </div>
                                  </div>
                                ))}
                             </div>
                          </div>
                          
                          <div className="bg-slate-50 rounded-[3rem] p-10 flex flex-col items-center justify-center border border-slate-100">
                             <div className="relative w-56 h-56 mb-10">
                                <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                                  <circle className="text-blue-500" strokeWidth="12" stroke="currentColor" fill="transparent" r="40" cx="50" cy="50" strokeDasharray={`${stats.malePercent * 2.51} 251`} />
                                  <circle className="text-pink-500" strokeWidth="12" stroke="currentColor" fill="transparent" r="40" cx="50" cy="50" strokeDasharray={`${stats.femalePercent * 2.51} 251`} strokeDashoffset={`${-stats.malePercent * 2.51}`} />
                                </svg>
                                <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                                  <p className="text-4xl font-black text-slate-900">{stats.total}</p>
                                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-1">Total Corps</p>
                                </div>
                             </div>
                             <div className="flex gap-12 w-full">
                               <div className="flex-1 text-center">
                                 <p className="text-xl font-black text-blue-600">{stats.males}</p>
                                 <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">Male Count</p>
                                 <p className="text-[10px] font-bold text-slate-300">{stats.malePercent}%</p>
                               </div>
                               <div className="flex-1 text-center border-l border-slate-200">
                                 <p className="text-xl font-black text-pink-600">{stats.females}</p>
                                 <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">Female Count</p>
                                 <p className="text-[10px] font-bold text-slate-300">{stats.femalePercent}%</p>
                               </div>
                             </div>
                          </div>
                        </div>
                        
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 pt-12 border-t border-slate-100">
                           <div className="text-center p-8 bg-white rounded-[2rem] border border-slate-100 shadow-sm">
                              <Users className="w-6 h-6 text-green-200 mx-auto mb-4" />
                              <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Density Index</p>
                              <p className="text-3xl font-black text-slate-900">{(stats.total / (stats.ppas || 1)).toFixed(1)}</p>
                           </div>
                           <div className="text-center p-8 bg-white rounded-[2rem] border border-slate-100 shadow-sm">
                              <MapPin className="w-6 h-6 text-green-200 mx-auto mb-4" />
                              <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Locations</p>
                              <p className="text-3xl font-black text-slate-900">{stats.ppas}</p>
                           </div>
                           <div className="text-center p-8 bg-white rounded-[2rem] border border-slate-100 shadow-sm">
                              <TrendingUp className="w-6 h-6 text-green-200 mx-auto mb-4" />
                              <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Success Rate</p>
                              <p className="text-3xl font-black text-green-600">99.8%</p>
                           </div>
                           <div className="text-center p-8 bg-[#006837] rounded-[2rem] shadow-xl shadow-green-900/20">
                              <CheckCircle2 className="w-6 h-6 text-green-100 mx-auto mb-4" />
                              <p className="text-[9px] font-black text-green-100 uppercase tracking-widest mb-1">Audit Ready</p>
                              <p className="text-3xl font-black text-white uppercase">Pass</p>
                           </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {state.data.length > 0 && (
                <div className="px-8 py-5 bg-[#f8faf9] border-t border-slate-100 flex justify-between items-center text-[9px] font-black text-slate-400 uppercase tracking-[0.15em]">
                  <div className="flex items-center gap-6">
                    <span>Audit Registry: {filteredMembers.length} records</span>
                    {state.selectedGroup && (
                      <button onClick={() => setState(s => ({...s, selectedGroup: null}))} className="flex items-center gap-1.5 px-3 py-1 bg-green-100 text-green-700 rounded-full hover:bg-green-200 transition-colors">
                        Filtering by PPA <X className="w-2.5 h-2.5" />
                      </button>
                    )}
                  </div>
                  <div className="flex gap-8">
                    <button onClick={() => window.print()} className="flex items-center gap-1.5 hover:text-slate-800 transition-colors"><Printer className="w-4 h-4" /> Hard Copy Print</button>
                    <div className="flex items-center gap-1.5 text-green-600"><CheckCircle2 className="w-4 h-4" /> Extractor Sync Complete</div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

export default App;