import React, { useState, useMemo, useCallback, useRef } from 'react';
import { 
  Upload, FileText, Users, MapPin, Download, Trash2, Search, 
  Loader2, AlertCircle, FileSpreadsheet, File as FileIcon, 
  CheckCircle2, TrendingUp, List, LayoutGrid, ChevronRight,
  Printer, Share2, Plus, X, BarChart3, PieChart
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
    setShowSuccess(false);
    
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
      setShowSuccess(true);
      
      setTimeout(() => {
        resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 300);
    } catch (err: any) {
      console.error("Extraction error:", err);
      let userFriendlyError = "An unexpected error occurred during extraction. Please check your connection and try again.";
      if (err.message && err.message.includes("API_KEY")) {
        userFriendlyError = "Configuration error: AI service access is restricted.";
      }
      setState(prev => ({ 
        ...prev, 
        error: userFriendlyError, 
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
      companyName: (formData.get('ppa') as string) || 'Unassigned',
    };
    setState(prev => ({ ...prev, data: [...prev.data, newMember] }));
    setShowAddForm(false);
  };

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
    if (!state.data || state.data.length === 0) return null;
    const males = state.data.filter(m => m.gender && m.gender.toUpperCase().startsWith('M')).length;
    const females = state.data.filter(m => m.gender && m.gender.toUpperCase().startsWith('F')).length;
    const totalCount = state.data.length;
    return {
      total: totalCount,
      ppas: groups.length,
      males,
      females,
      malePercent: totalCount > 0 ? Math.round((males / totalCount) * 100) : 0,
      femalePercent: totalCount > 0 ? Math.round((females / totalCount) * 100) : 0,
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
    URL.revokeObjectURL(url);
  }, [filteredMembers]);

  return (
    <div className="min-h-screen bg-[#f0f4f2] font-sans text-slate-900 pb-20">
      <header className="sticky top-0 z-50 bg-[#006837] text-white border-b-4 border-[#FFD700] shadow-xl">
        <div className="container mx-auto px-4 h-20 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 bg-[#FFD700] rounded-xl flex items-center justify-center text-green-900 font-black shadow-lg">NY</div>
            <div>
              <h1 className="text-xl font-black tracking-tighter leading-none">NYSC EXTRACTOR</h1>
              <p className="text-[10px] text-green-100 font-bold tracking-widest uppercase mt-1 opacity-80">Digital PPA Organizer</p>
            </div>
          </div>
          <div className="hidden lg:flex items-center gap-6">
            <div className="px-4 py-2 bg-green-900/40 rounded-xl border border-green-700/50 flex items-center gap-3">
              <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse"></div>
              <span className="text-xs font-black uppercase tracking-widest">AI Agent Ready</span>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-10 max-w-7xl">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
          
          <div className="lg:col-span-4 space-y-8">
            <section className="bg-white rounded-[2rem] shadow-xl shadow-green-900/5 border border-slate-100 overflow-hidden group">
              <div className="p-6 bg-[#f8faf9] border-b border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-green-100 rounded-lg"><Upload className="w-5 h-5 text-green-700" /></div>
                  <h2 className="font-black text-slate-800 uppercase text-sm tracking-tight">Source Material</h2>
                </div>
              </div>
              <div className="p-8">
                <label className="group relative flex flex-col items-center justify-center w-full min-h-[160px] border-4 border-dashed border-slate-100 rounded-[2rem] cursor-pointer bg-[#fcfdfc] hover:bg-green-50/30 hover:border-green-400 transition-all duration-500">
                  <div className="flex flex-col items-center justify-center p-6 text-center">
                    <FileIcon className="w-10 h-10 text-slate-300 mb-4" />
                    <p className="mb-1 text-sm text-slate-500 font-bold uppercase tracking-widest">Select Files</p>
                    <p className="text-[10px] text-slate-400">PDF, Images, CSV</p>
                  </div>
                  <input type="file" className="hidden" multiple accept="image/*,application/pdf,.csv" onChange={handleFileUpload} />
                </label>

                {uploadedFiles.length > 0 && (
                  <div className="mt-8 space-y-4">
                    <div className="flex items-center justify-between px-2">
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Queue ({uploadedFiles.length})</span>
                      <button onClick={() => setUploadedFiles([])} className="text-[10px] text-red-500 font-black hover:underline uppercase">Clear</button>
                    </div>
                    <div className="max-h-52 overflow-y-auto space-y-2 pr-2 custom-scrollbar">
                      {uploadedFiles.map((f, i) => (
                        <div key={i} className="flex items-center justify-between p-3 bg-[#f8faf9] rounded-xl border border-slate-100">
                          <span className="text-xs font-black truncate max-w-[180px] text-slate-600 uppercase tracking-tighter">{f.name}</span>
                          <button onClick={() => setUploadedFiles(prev => prev.filter((_, idx) => idx !== i))} className="p-1 text-slate-300 hover:text-red-500"><X className="w-4 h-4" /></button>
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
                          <span className="text-sm font-black uppercase tracking-tight">Extracting...</span>
                        </>
                      ) : (
                        <>
                          <TrendingUp className="w-5 h-5" />
                          <span className="uppercase tracking-widest text-sm">Analyze Data</span>
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
                <p className="text-xs font-bold text-red-800 leading-tight uppercase">{state.error}</p>
              </div>
            )}

            {groups.length > 0 && (
              <section className="bg-white rounded-[2rem] shadow-xl shadow-green-900/5 border border-slate-100 overflow-hidden">
                <div className="p-6 bg-[#f8faf9] border-b border-slate-100 flex items-center gap-3">
                  <div className="p-2 bg-green-100 rounded-lg"><MapPin className="w-5 h-5 text-green-700" /></div>
                  <h2 className="font-black text-slate-800 uppercase text-sm tracking-tight">Grouping</h2>
                </div>
                <div className="p-4 max-h-[400px] overflow-y-auto custom-scrollbar space-y-1">
                  <button
                    onClick={() => setState(s => ({ ...s, selectedGroup: null }))}
                    className={`w-full flex items-center justify-between p-3 rounded-xl text-left transition-all ${!state.selectedGroup ? 'bg-green-600 text-white shadow-lg' : 'hover:bg-slate-50 text-slate-600'}`}
                  >
                    <span className="font-black text-xs uppercase">All Members</span>
                    <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-black/10">{state.data.length}</span>
                  </button>
                  {groups.map(([name, members]) => (
                    <button
                      key={name}
                      onClick={() => setState(s => ({ ...s, selectedGroup: name }))}
                      className={`w-full flex items-center justify-between p-3 rounded-xl text-left transition-all ${state.selectedGroup === name ? 'bg-green-600 text-white shadow-lg' : 'hover:bg-[#fcfdfc] text-slate-600'}`}
                    >
                      <span className="text-xs font-black truncate max-w-[200px] uppercase tracking-tighter">{name}</span>
                      <span className="text-[10px] px-2 py-0.5 rounded-full font-black bg-black/5">{members.length}</span>
                    </button>
                  ))}
                </div>
              </section>
            )}
          </div>

          <div className="lg:col-span-8 space-y-8" ref={resultsRef}>
            {stats && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Total</p>
                  <p className="text-3xl font-black text-slate-900">{stats.total}</p>
                </div>
                <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">PPAs</p>
                  <p className="text-3xl font-black text-green-700">{stats.ppas}</p>
                </div>
                <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Gender</p>
                  <div className="flex items-center gap-2 mt-2">
                    <span className="text-xs font-black text-blue-600">{stats.malePercent}% M</span>
                    <span className="text-xs font-black text-pink-600">{stats.femalePercent}% F</span>
                  </div>
                </div>
                <div className="bg-green-700 p-6 rounded-[2rem] text-white">
                  <p className="text-[10px] font-black text-green-100 uppercase tracking-widest">Success</p>
                  <p className="text-3xl font-black">100%</p>
                </div>
              </div>
            )}

            <div className="bg-white rounded-[2rem] shadow-2xl shadow-green-900/5 border border-slate-100 min-h-[600px] flex flex-col overflow-hidden">
              <div className="p-6 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-4 flex-1">
                   <div className="flex bg-slate-100 p-1 rounded-xl">
                      <button onClick={() => setViewMode('table')} className={`p-2 rounded-lg transition-all ${viewMode === 'table' ? 'bg-white shadow text-green-700' : 'text-slate-400'}`}><List className="w-4 h-4" /></button>
                      <button onClick={() => setViewMode('report')} className={`p-2 rounded-lg transition-all ${viewMode === 'report' ? 'bg-white shadow text-green-700' : 'text-slate-400'}`}><LayoutGrid className="w-4 h-4" /></button>
                      <button onClick={() => setViewMode('analytics')} className={`p-2 rounded-lg transition-all ${viewMode === 'analytics' ? 'bg-white shadow text-green-700' : 'text-slate-400'}`}><BarChart3 className="w-4 h-4" /></button>
                   </div>
                   <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" />
                    <input 
                      type="text" placeholder="Search records..."
                      className="w-full pl-10 pr-4 py-2.5 border border-slate-100 rounded-xl focus:outline-none focus:border-green-500 text-sm bg-slate-50 font-medium"
                      value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
                    />
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => setShowAddForm(true)} className="p-2.5 bg-green-50 text-green-700 rounded-xl border border-green-100 hover:bg-green-100 transition-colors"><Plus className="w-5 h-5" /></button>
                  <button onClick={downloadCSV} className="flex-1 md:flex-none flex items-center justify-center gap-2 px-6 py-2.5 bg-[#006837] text-white text-[10px] font-black uppercase tracking-widest rounded-xl transition-all hover:bg-green-800">
                    <Download className="w-4 h-4" /> Export
                  </button>
                </div>
              </div>

              <div className="flex-1 relative">
                {showAddForm && (
                  <div className="absolute inset-0 z-40 bg-white p-10 overflow-y-auto">
                    <div className="max-w-md mx-auto space-y-6">
                      <div className="flex items-center justify-between">
                        <h3 className="text-xl font-black text-slate-900 uppercase">Manual Entry</h3>
                        <button onClick={() => setShowAddForm(false)}><X className="w-6 h-6 text-slate-400" /></button>
                      </div>
                      <form onSubmit={addNewMember} className="grid grid-cols-1 gap-4">
                        <div>
                          <label className="text-[10px] font-black text-slate-400 uppercase mb-1 block">Full Name</label>
                          <input required name="fullName" className="w-full px-4 py-3 border border-slate-100 rounded-xl bg-slate-50 focus:outline-none" placeholder="DOE JOHN EBONY" />
                        </div>
                        <div>
                          <label className="text-[10px] font-black text-slate-400 uppercase mb-1 block">State Code</label>
                          <input required name="stateCode" className="w-full px-4 py-3 border border-slate-100 rounded-xl bg-slate-50 focus:outline-none" placeholder="NY/24B/1234" />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="text-[10px] font-black text-slate-400 uppercase mb-1 block">Gender</label>
                            <select name="gender" className="w-full px-4 py-3 border border-slate-100 rounded-xl bg-slate-50 focus:outline-none">
                              <option value="M">Male</option>
                              <option value="F">Female</option>
                            </select>
                          </div>
                          <div>
                            <label className="text-[10px] font-black text-slate-400 uppercase mb-1 block">Phone</label>
                            <input name="phone" className="w-full px-4 py-3 border border-slate-100 rounded-xl bg-slate-50 focus:outline-none" placeholder="080..." />
                          </div>
                        </div>
                        <div>
                          <label className="text-[10px] font-black text-slate-400 uppercase mb-1 block">PPA / Organization</label>
                          <input required name="ppa" className="w-full px-4 py-3 border border-slate-100 rounded-xl bg-slate-50 focus:outline-none" placeholder="MINISTRY OF EDUCATION" />
                        </div>
                        <button type="submit" className="py-4 bg-green-700 text-white font-black rounded-xl uppercase mt-4 hover:bg-green-800 transition-colors shadow-lg">Save Record</button>
                      </form>
                    </div>
                  </div>
                )}

                {state.data.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full min-h-[500px] text-center p-10">
                    <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mb-6">
                      <FileText className="w-10 h-10 text-slate-200" />
                    </div>
                    <h3 className="text-lg font-black uppercase tracking-widest text-slate-300">Workspace Empty</h3>
                    <p className="text-xs font-bold text-slate-400 mt-2 uppercase max-w-xs">Upload scanned lists or clearace documents to begin intelligent extraction</p>
                  </div>
                ) : (
                  <div className="p-4 h-full">
                    {viewMode === 'table' && (
                      <div className="overflow-x-auto rounded-2xl border border-slate-50">
                        <table className="w-full text-xs text-left border-collapse">
                          <thead className="bg-[#f8faf9] text-slate-400 uppercase text-[9px] font-black border-b border-slate-100">
                            <tr>
                              <th className="px-6 py-4">SN</th>
                              <th className="px-6 py-4">CODE</th>
                              <th className="px-6 py-4">NAME</th>
                              <th className="px-6 py-4">GEN</th>
                              <th className="px-6 py-4">PPA</th>
                              <th className="px-6 py-4 text-right">ACTION</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-50">
                            {filteredMembers.map((m) => (
                              <tr key={m.id} className="hover:bg-green-50/20 group transition-colors">
                                <td className="px-6 py-4 text-slate-300 font-mono text-[10px]">{m.sn}</td>
                                <td className="px-6 py-4 font-black text-slate-800 uppercase tracking-tighter">{m.stateCode}</td>
                                <td className="px-6 py-4 font-bold text-slate-600 uppercase">{m.fullName}</td>
                                <td className="px-6 py-4">
                                  <span className={`px-2 py-0.5 rounded text-[9px] font-black ${(m.gender || 'M').charAt(0) === 'F' ? 'bg-pink-100 text-pink-700' : 'bg-blue-100 text-blue-700'}`}>
                                    {(m.gender || 'M').charAt(0)}
                                  </span>
                                </td>
                                <td className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-tighter truncate max-w-[150px]">{m.companyName}</td>
                                <td className="px-6 py-4 text-right opacity-0 group-hover:opacity-100 transition-opacity">
                                  <button onClick={() => deleteMember(m.id)} className="text-red-400 hover:text-red-600 p-1"><Trash2 className="w-4 h-4" /></button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}

                    {viewMode === 'report' && (
                      <div className="space-y-6 p-4">
                        {groups.filter(([ppa]) => !state.selectedGroup || ppa === state.selectedGroup).map(([ppa, members]) => (
                          <div key={ppa} className="bg-white rounded-2xl border-2 border-slate-50 p-8 page-break-after-always shadow-sm">
                            <div className="flex justify-between items-end border-b-2 border-slate-100 pb-4 mb-6">
                               <div>
                                 <p className="text-[9px] font-black text-slate-400 uppercase mb-1">Place of Primary Assignment</p>
                                 <h3 className="font-black text-green-800 text-xl uppercase tracking-tighter">{ppa}</h3>
                               </div>
                               <div className="text-right">
                                 <p className="text-[9px] font-black text-slate-400 uppercase mb-1">Corps Population</p>
                                 <span className="text-sm font-black text-slate-800">{members.length} Members</span>
                               </div>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              {members.map((m) => (
                                <div key={m.id} className="flex gap-4 p-4 bg-slate-50 rounded-xl border border-slate-100">
                                  <div className={`w-10 h-10 shrink-0 rounded-xl flex items-center justify-center font-black text-sm ${(m.gender || 'M').charAt(0) === 'F' ? 'bg-pink-100 text-pink-500' : 'bg-blue-100 text-blue-500'}`}>
                                    {(m.fullName || 'U').charAt(0)}
                                  </div>
                                  <div className="min-w-0">
                                    <p className="text-xs font-black text-slate-800 uppercase truncate">{m.fullName}</p>
                                    <p className="text-[10px] font-bold text-green-600">{m.stateCode}</p>
                                    <p className="text-[9px] font-medium text-slate-400 mt-1">{m.phone || 'No Phone recorded'}</p>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {viewMode === 'analytics' && stats && (
                      <div className="p-8 space-y-12">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                          <div>
                             <h4 className="text-[10px] font-black text-slate-400 uppercase mb-6 tracking-widest">Top PPA Distribution</h4>
                             <div className="space-y-5">
                                {groups.slice(0, 8).map(([name, members]) => (
                                  <div key={name} className="space-y-1.5">
                                    <div className="flex justify-between text-[10px] font-black text-slate-600 uppercase">
                                      <span className="truncate max-w-[80%]">{name}</span>
                                      <span>{members.length}</span>
                                    </div>
                                    <div className="h-2.5 bg-slate-50 rounded-full overflow-hidden border border-slate-100">
                                      <div className="h-full bg-green-500 transition-all duration-1000" style={{width: `${(members.length / stats.total) * 100}%`}}></div>
                                    </div>
                                  </div>
                                ))}
                             </div>
                          </div>
                          <div className="bg-slate-50 rounded-[2rem] p-8 flex flex-col items-center justify-center border border-slate-100">
                             <div className="relative w-48 h-48 mb-8">
                                <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                                  <circle className="text-blue-500" strokeWidth="12" stroke="currentColor" fill="transparent" r="40" cx="50" cy="50" strokeDasharray={`${stats.malePercent * 2.51} 251`} />
                                  <circle className="text-pink-500" strokeWidth="12" stroke="currentColor" fill="transparent" r="40" cx="50" cy="50" strokeDasharray={`${stats.femalePercent * 2.51} 251`} strokeDashoffset={`${-stats.malePercent * 2.51}`} />
                                </svg>
                                <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                                  <p className="text-2xl font-black text-slate-800">{stats.total}</p>
                                  <p className="text-[8px] font-black text-slate-400 uppercase">Total Corps</p>
                                </div>
                             </div>
                             <div className="flex gap-8 w-full">
                               <div className="flex-1 text-center">
                                 <p className="text-lg font-black text-blue-600">{stats.males}</p>
                                 <p className="text-[9px] font-black text-slate-400 uppercase">Males</p>
                               </div>
                               <div className="flex-1 text-center">
                                 <p className="text-lg font-black text-pink-600">{stats.females}</p>
                                 <p className="text-[9px] font-black text-slate-400 uppercase">Females</p>
                               </div>
                             </div>
                          </div>
                        </div>
                        
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 pt-10 border-t border-slate-100">
                           <div className="text-center p-6 bg-slate-50 rounded-2xl border border-slate-100">
                              <Users className="w-5 h-5 text-slate-300 mx-auto mb-3" />
                              <p className="text-[9px] font-black text-slate-400 uppercase">PPA Density</p>
                              <p className="text-2xl font-black text-slate-800">{(stats.total / (stats.ppas || 1)).toFixed(1)}</p>
                           </div>
                           <div className="text-center p-6 bg-slate-50 rounded-2xl border border-slate-100">
                              <MapPin className="w-5 h-5 text-slate-300 mx-auto mb-3" />
                              <p className="text-[9px] font-black text-slate-400 uppercase">Locations</p>
                              <p className="text-2xl font-black text-slate-800">{stats.ppas}</p>
                           </div>
                           <div className="text-center p-6 bg-slate-50 rounded-2xl border border-slate-100">
                              <TrendingUp className="w-5 h-5 text-slate-300 mx-auto mb-3" />
                              <p className="text-[9px] font-black text-slate-400 uppercase">Growth</p>
                              <p className="text-2xl font-black text-green-600">+0.0%</p>
                           </div>
                           <div className="text-center p-6 bg-[#006837] rounded-2xl">
                              <CheckCircle2 className="w-5 h-5 text-green-100 mx-auto mb-3" />
                              <p className="text-[9px] font-black text-green-100 uppercase">Ready</p>
                              <p className="text-2xl font-black text-white">True</p>
                           </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {state.data.length > 0 && (
                <div className="px-6 py-4 bg-[#f8faf9] border-t border-slate-100 flex justify-between items-center text-[10px] font-black text-slate-400 uppercase tracking-widest">
                  <div className="flex items-center gap-4">
                    <span>Displaying {filteredMembers.length} records</span>
                    {state.selectedGroup && (
                      <span className="px-2 py-0.5 bg-green-100 text-green-700 rounded-full text-[8px] flex items-center gap-1 cursor-pointer" onClick={() => setState(s => ({...s, selectedGroup: null}))}>
                        Filtered by PPA <X className="w-2 h-2" />
                      </span>
                    )}
                  </div>
                  <div className="flex gap-6">
                    <button onClick={() => window.print()} className="flex items-center gap-1 hover:text-slate-800 transition-colors"><Printer className="w-3.5 h-3.5" /> Print Report</button>
                    <div className="flex items-center gap-1 text-green-600"><CheckCircle2 className="w-3.5 h-3.5" /> Database Sync Ready</div>
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