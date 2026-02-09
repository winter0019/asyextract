
import React, { useState, useMemo, useCallback, useRef } from 'react';
import { 
  Upload, FileText, Users, MapPin, Download, Trash2, Search, 
  Loader2, AlertCircle, FileSpreadsheet, File as FileIcon, 
  CheckCircle2, TrendingUp, Info, List, LayoutGrid, ChevronRight,
  Printer, Share2
} from 'lucide-react';
import { extractCorpsData, FileData } from './services/geminiService.ts';
import { CorpsMember, AppState } from './types.ts';

const App: React.FC = () => {
  const [state, setState] = useState<AppState>({
    isProcessing: false,
    data: [],
    error: null,
    selectedGroup: null,
  });
  const [uploadedFiles, setUploadedFiles] = useState<FileData[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [showSuccess, setShowSuccess] = useState(false);
  const [viewMode, setViewMode] = useState<'table' | 'report'>('table');
  
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

  const removeFile = (index: number) => {
    setUploadedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const processFiles = async () => {
    if (uploadedFiles.length === 0) return;

    setState(prev => ({ ...prev, isProcessing: true, error: null }));
    setShowSuccess(false);
    
    try {
      const result = await extractCorpsData(uploadedFiles);
      
      if (!result.members || result.members.length === 0) {
        setState(prev => ({ 
          ...prev, 
          error: "AI could not find any corps member data in the uploaded files. Please check file clarity.", 
          isProcessing: false 
        }));
        return;
      }

      setState(prev => ({ 
        ...prev, 
        data: result.members, 
        isProcessing: false,
        selectedGroup: null 
      }));
      setShowSuccess(true);
      
      // Auto-scroll to results
      setTimeout(() => {
        resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 300);
    } catch (err) {
      setState(prev => ({ 
        ...prev, 
        error: "Failed to extract data. The AI might be busy or the files were unreadable.", 
        isProcessing: false 
      }));
    }
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
    if (state.data.length === 0) return null;
    const males = state.data.filter(m => m.gender === 'M' || m.gender === 'Male').length;
    const females = state.data.filter(m => m.gender === 'F' || m.gender === 'Female').length;
    return {
      total: state.data.length,
      ppas: groups.length,
      males,
      females
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
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `nysc_ppa_list_${state.selectedGroup || 'all'}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }, [filteredMembers, state.selectedGroup]);

  const getFileIcon = (mime: string, name: string) => {
    if (mime.includes('image')) return <FileText className="w-4 h-4 text-blue-500" />;
    if (mime.includes('pdf')) return <FileIcon className="w-4 h-4 text-red-500" />;
    if (mime.includes('csv') || name.endsWith('.csv')) return <FileSpreadsheet className="w-4 h-4 text-green-600" />;
    return <FileIcon className="w-4 h-4 text-slate-400" />;
  };

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900 pb-24 lg:pb-8">
      <header className="sticky top-0 z-50 bg-[#006837] text-white shadow-xl">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-[#FFD700] rounded-full flex items-center justify-center text-green-900 font-black shadow-inner">NY</div>
            <div>
              <h1 className="text-lg font-black tracking-tight leading-none">NYSC DATA EXTRACTOR</h1>
              <p className="text-[10px] text-green-100 font-bold tracking-widest uppercase mt-0.5">Automated PPA Organizer</p>
            </div>
          </div>
          <div className="hidden md:flex items-center gap-4">
            <div className="flex -space-x-2">
              <div className="w-8 h-8 rounded-full border-2 border-green-800 bg-white flex items-center justify-center"><CheckCircle2 className="w-4 h-4 text-green-600" /></div>
              <div className="w-8 h-8 rounded-full border-2 border-green-800 bg-white flex items-center justify-center"><Share2 className="w-4 h-4 text-blue-500" /></div>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          {/* LEFT COLUMN: Controls & Upload */}
          <div className="lg:col-span-4 space-y-6">
            <section className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Upload className="w-5 h-5 text-green-700" />
                  <h2 className="font-bold text-slate-800">1. Upload Documents</h2>
                </div>
              </div>
              <div className="p-6">
                <label className="group relative flex flex-col items-center justify-center w-full min-h-[160px] border-2 border-dashed border-slate-300 rounded-2xl cursor-pointer bg-slate-50 hover:bg-slate-100 hover:border-green-500 transition-all">
                  <div className="flex flex-col items-center justify-center p-4">
                    <div className="w-14 h-14 bg-white rounded-full shadow-sm flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                      <Upload className="w-7 h-7 text-slate-400 group-hover:text-green-600" />
                    </div>
                    <p className="mb-2 text-sm text-slate-600 text-center font-medium">
                      Drop images, PDFs or CSVs here
                    </p>
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-tight">Clear photos work best</p>
                  </div>
                  <input type="file" className="hidden" multiple accept="image/jpeg,image/png,application/pdf,.csv,text/csv" onChange={handleFileUpload} />
                </label>

                {uploadedFiles.length > 0 && (
                  <div className="mt-6 space-y-3">
                    <div className="flex items-center justify-between">
                      <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Selected Files ({uploadedFiles.length})</h3>
                      <button onClick={() => setUploadedFiles([])} className="text-[10px] text-red-500 font-black hover:underline uppercase tracking-tighter">
                        Clear All
                      </button>
                    </div>
                    <div className="max-h-60 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
                      {uploadedFiles.map((file, i) => (
                        <div key={i} className="flex items-center justify-between p-3 bg-white rounded-xl border border-slate-200 group animate-in slide-in-from-left-2">
                          <div className="flex items-center gap-3 truncate">
                            <div className="p-2 bg-slate-50 rounded-lg">{getFileIcon(file.mimeType, file.name)}</div>
                            <span className="text-xs font-bold truncate text-slate-700">{file.name}</span>
                          </div>
                          <button onClick={() => removeFile(i)} className="p-2 text-slate-300 hover:text-red-500 transition-colors">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                    <button 
                      onClick={processFiles}
                      disabled={state.isProcessing || uploadedFiles.length === 0}
                      className={`w-full mt-4 bg-[#006837] hover:bg-green-800 text-white font-black py-4 px-4 rounded-xl shadow-lg shadow-green-900/10 transition-all flex items-center justify-center gap-3 disabled:bg-slate-200 disabled:text-slate-400 disabled:shadow-none`}
                    >
                      {state.isProcessing ? (
                        <>
                          <Loader2 className="w-5 h-5 animate-spin" />
                          <span className="animate-pulse">Analyzing & Extracting...</span>
                        </>
                      ) : (
                        <>
                          <TrendingUp className="w-5 h-5" />
                          Process & Organize
                        </>
                      )}
                    </button>
                  </div>
                )}
              </div>
            </section>

            {state.error && (
              <div className="p-4 bg-red-50 border border-red-200 rounded-2xl flex items-start gap-3 text-red-700 shadow-sm animate-in shake duration-500">
                <AlertCircle className="w-5 h-5 mt-0.5 flex-shrink-0" />
                <p className="text-xs font-bold uppercase tracking-tight">{state.error}</p>
              </div>
            )}

            {groups.length > 0 && (
              <section className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden animate-in fade-in duration-500">
                <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center gap-2">
                  <MapPin className="w-5 h-5 text-green-700" />
                  <h2 className="font-bold text-slate-800 uppercase text-xs tracking-widest">Browse by PPA</h2>
                </div>
                <div className="p-2 max-h-[400px] overflow-y-auto custom-scrollbar">
                  <button
                    onClick={() => setState(s => ({ ...s, selectedGroup: null }))}
                    className={`w-full flex items-center justify-between p-3 rounded-xl text-left transition-all mb-1 ${!state.selectedGroup ? 'bg-green-50 text-green-800 ring-2 ring-green-200 shadow-sm' : 'hover:bg-slate-50 text-slate-600'}`}
                  >
                    <span className="font-bold text-xs">All Records</span>
                    <span className="text-[10px] bg-slate-200 text-slate-700 font-black px-2 py-0.5 rounded-md">{state.data.length}</span>
                  </button>
                  <div className="h-px bg-slate-100 my-2 mx-2"></div>
                  {groups.map(([name, members]) => (
                    <button
                      key={name}
                      onClick={() => setState(s => ({ ...s, selectedGroup: name }))}
                      className={`w-full flex items-center justify-between p-3 rounded-xl text-left transition-all mb-1 group ${state.selectedGroup === name ? 'bg-green-50 text-green-800 ring-2 ring-green-200 shadow-sm' : 'hover:bg-slate-50 text-slate-600'}`}
                    >
                      <div className="flex flex-col">
                        <span className="text-xs font-black truncate max-w-[180px] uppercase tracking-tighter">{name}</span>
                        <span className="text-[9px] font-bold text-slate-400">Sample SN: {members[0].sn}</span>
                      </div>
                      <span className={`text-[10px] px-2 py-0.5 rounded-md font-black transition-colors ${state.selectedGroup === name ? 'bg-green-600 text-white' : 'bg-slate-100 text-slate-500'}`}>
                        {members.length}
                      </span>
                    </button>
                  ))}
                </div>
              </section>
            )}
          </div>

          {/* RIGHT COLUMN: Results Display */}
          <div className="lg:col-span-8 space-y-6" ref={resultsRef}>
            {/* Summary Dashboard */}
            {stats && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 animate-in slide-in-from-top-4 duration-700">
                <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm group hover:border-green-300 transition-colors">
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">TOTAL CORPS</p>
                  <p className="text-2xl font-black text-green-800">{stats.total}</p>
                </div>
                <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm group hover:border-blue-300 transition-colors">
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">UNIQUE PPAS</p>
                  <p className="text-2xl font-black text-blue-700">{stats.ppas}</p>
                </div>
                <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm group hover:border-slate-400 transition-colors">
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">MALES</p>
                  <p className="text-2xl font-black text-slate-700">{stats.males}</p>
                </div>
                <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm group hover:border-pink-300 transition-colors">
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">FEMALES</p>
                  <p className="text-2xl font-black text-pink-600">{stats.females}</p>
                </div>
              </div>
            )}

            <div className="bg-white rounded-3xl shadow-sm border border-slate-200 flex flex-col min-h-[650px] overflow-hidden">
              {/* Header Toolbar */}
              <div className="p-4 border-b border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white sticky top-0 z-20">
                <div className="flex items-center gap-3">
                   <div className="flex bg-slate-100 p-1 rounded-xl">
                      <button 
                        onClick={() => setViewMode('table')}
                        className={`p-2 rounded-lg transition-all ${viewMode === 'table' ? 'bg-white shadow-sm text-green-700' : 'text-slate-400 hover:text-slate-600'}`}
                      >
                        <List className="w-4 h-4" />
                      </button>
                      <button 
                        onClick={() => setViewMode('report')}
                        className={`p-2 rounded-lg transition-all ${viewMode === 'report' ? 'bg-white shadow-sm text-green-700' : 'text-slate-400 hover:text-slate-600'}`}
                      >
                        <LayoutGrid className="w-4 h-4" />
                      </button>
                   </div>
                   <div className="h-6 w-px bg-slate-200 mx-1 hidden md:block"></div>
                   <div className="relative flex-1 min-w-[200px]">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input 
                      type="text" 
                      placeholder="Filter records..."
                      className="w-full pl-10 pr-4 py-2 border border-slate-100 rounded-xl focus:outline-none focus:ring-4 focus:ring-green-500/10 focus:border-green-500 text-sm transition-all bg-slate-50/50"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                    />
                  </div>
                </div>
                
                <div className="flex items-center gap-2">
                  <button 
                    onClick={downloadCSV}
                    disabled={filteredMembers.length === 0}
                    className="flex-1 md:flex-none flex items-center justify-center gap-2 px-6 py-2 bg-[#006837] hover:bg-green-800 text-white text-xs font-black uppercase tracking-widest rounded-xl transition-all disabled:opacity-50"
                  >
                    <Download className="w-3.5 h-3.5" />
                    Export CSV
                  </button>
                </div>
              </div>

              {/* Data Display Content */}
              <div className="flex-1 overflow-x-auto relative">
                {showSuccess && stats && (
                  <div className="mx-4 mt-4 p-4 bg-green-50 border border-green-100 rounded-2xl flex items-center justify-between animate-in zoom-in duration-300">
                    <div className="flex items-center gap-3 text-green-800 font-bold text-xs uppercase tracking-tight">
                      <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                        <CheckCircle2 className="w-5 h-5 text-green-600" />
                      </div>
                      Successfully extracted {stats.total} corps members across {stats.ppas} PPAs.
                    </div>
                    <button onClick={() => setShowSuccess(false)} className="text-green-600/50 hover:text-green-800 p-2">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                )}

                {state.data.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full min-h-[500px] px-8 text-center">
                    <div className="w-24 h-24 bg-slate-50 rounded-full flex items-center justify-center mb-8 relative">
                      <FileText className="w-12 h-12 text-slate-200" />
                      <div className="absolute -right-2 -bottom-2 w-10 h-10 bg-white shadow-xl rounded-full flex items-center justify-center border border-slate-100">
                        <Search className="w-5 h-5 text-green-600" />
                      </div>
                    </div>
                    <h3 className="text-2xl font-black text-slate-800 tracking-tight">WAITING FOR DOCUMENTS</h3>
                    <p className="text-sm text-slate-400 max-w-sm mt-4 font-medium leading-relaxed">
                      Upload your <b>Monthly Clearance</b> or <b>Posting Lists</b>. Our AI will automatically extract and group everyone by their PPA.
                    </p>
                    
                    <div className="mt-12 grid grid-cols-1 sm:grid-cols-2 gap-4 text-left max-w-2xl">
                      <div className="p-5 rounded-2xl bg-white border border-slate-100 shadow-sm flex gap-4">
                        <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center shrink-0">
                          <Users className="w-5 h-5 text-blue-500" />
                        </div>
                        <div>
                          <p className="text-[10px] font-black text-blue-400 uppercase tracking-widest mb-1">SMART DETECTION</p>
                          <p className="text-xs text-slate-600 leading-relaxed font-bold uppercase tracking-tighter">Recognizes names, state codes, and PPA associations instantly.</p>
                        </div>
                      </div>
                      <div className="p-5 rounded-2xl bg-white border border-slate-100 shadow-sm flex gap-4">
                        <div className="w-10 h-10 bg-green-50 rounded-xl flex items-center justify-center shrink-0">
                          <LayoutGrid className="w-5 h-5 text-green-500" />
                        </div>
                        <div>
                          <p className="text-[10px] font-black text-green-400 uppercase tracking-widest mb-1">AUTO ORGANIZATION</p>
                          <p className="text-xs text-slate-600 leading-relaxed font-bold uppercase tracking-tighter">Automatically groups corps members into PPA departments.</p>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="p-4">
                    {viewMode === 'table' ? (
                      <div className="overflow-hidden rounded-2xl border border-slate-100">
                        <table className="w-full text-xs text-left border-collapse">
                          <thead className="bg-slate-50 text-slate-400 uppercase text-[9px] font-black tracking-widest sticky top-0 z-10">
                            <tr>
                              <th className="px-6 py-4 border-b border-slate-100">SN</th>
                              <th className="px-6 py-4 border-b border-slate-100">STATE CODE</th>
                              <th className="px-6 py-4 border-b border-slate-100">FULL NAME</th>
                              <th className="px-6 py-4 border-b border-slate-100 text-center">GEN</th>
                              <th className="px-6 py-4 border-b border-slate-100">GSM NO</th>
                              <th className="px-6 py-4 border-b border-slate-100">ASSIGNED PPA</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-50">
                            {filteredMembers.map((member, i) => (
                              <tr key={i} className="hover:bg-green-50/30 transition-colors group">
                                <td className="px-6 py-4 text-slate-400 font-mono text-[10px] font-bold">{member.sn}</td>
                                <td className="px-6 py-4 font-black text-slate-800 tracking-tighter">{member.stateCode}</td>
                                <td className="px-6 py-4 font-bold text-slate-700 uppercase">{member.fullName}</td>
                                <td className="px-6 py-4 text-center">
                                  <span className={`px-2 py-0.5 rounded text-[9px] font-black ${member.gender === 'F' || member.gender === 'Female' ? 'bg-pink-100 text-pink-700' : 'bg-blue-100 text-blue-700'}`}>
                                    {member.gender.charAt(0)}
                                  </span>
                                </td>
                                <td className="px-6 py-4 font-mono text-[10px] text-slate-500">{member.phone}</td>
                                <td className="px-6 py-4">
                                  <span className="bg-slate-50 text-slate-700 px-3 py-1 rounded-lg text-[10px] font-black border border-slate-100 block truncate max-w-[200px] uppercase tracking-tighter" title={member.companyName}>
                                    {member.companyName}
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4">
                        {groups
                          .filter(([ppa]) => !state.selectedGroup || ppa === state.selectedGroup)
                          .map(([ppa, members]) => (
                          <div key={ppa} className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
                            <div className="bg-slate-50 px-6 py-4 border-b border-slate-200 flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <div className="w-8 h-8 bg-green-600 rounded-lg flex items-center justify-center text-white shadow-sm">
                                  <MapPin className="w-4 h-4" />
                                </div>
                                <h3 className="font-black text-sm text-slate-800 uppercase tracking-tighter">{ppa}</h3>
                              </div>
                              <span className="text-[10px] font-black bg-slate-200 text-slate-600 px-3 py-1 rounded-full uppercase tracking-widest">
                                {members.length} Members
                              </span>
                            </div>
                            <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                              {members.map((m, idx) => (
                                <div key={idx} className="flex items-center gap-4 p-3 bg-slate-50/50 rounded-xl border border-slate-100 hover:border-green-200 transition-colors">
                                  <div className={`w-10 h-10 rounded-full flex items-center justify-center font-black text-xs ${m.gender === 'F' || m.gender === 'Female' ? 'bg-pink-100 text-pink-600' : 'bg-blue-100 text-blue-600'}`}>
                                    {m.fullName.charAt(0)}
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <p className="text-xs font-black text-slate-800 truncate uppercase tracking-tighter">{m.fullName}</p>
                                    <div className="flex items-center gap-2 mt-0.5">
                                      <span className="text-[9px] font-bold text-green-700 bg-green-100 px-1.5 py-0.5 rounded">{m.stateCode}</span>
                                      <span className="text-[9px] font-medium text-slate-400">{m.phone}</span>
                                    </div>
                                  </div>
                                  <ChevronRight className="w-4 h-4 text-slate-300" />
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {state.data.length > 0 && filteredMembers.length === 0 && (
                  <div className="flex flex-col items-center justify-center py-32 text-slate-400">
                    <Search className="w-16 h-16 mb-4 opacity-5" />
                    <p className="font-black uppercase tracking-widest text-xs">No records matching search</p>
                  </div>
                )}
              </div>

              {/* Status Footer */}
              {state.data.length > 0 && (
                <div className="p-4 bg-slate-50 border-t border-slate-200 text-[10px] text-slate-500 flex justify-between items-center font-black uppercase tracking-widest">
                  <div className="flex items-center gap-4">
                    <span>Showing {filteredMembers.length} of {state.data.length} records</span>
                    {state.selectedGroup && <span className="text-green-600 bg-green-100 px-2 py-0.5 rounded-full ring-1 ring-green-200">{state.selectedGroup}</span>}
                  </div>
                  <div className="flex items-center gap-4">
                    <button className="flex items-center gap-1 hover:text-slate-800 transition-colors"><Printer className="w-3 h-3" /> Print List</button>
                    <div className="flex items-center gap-2 text-green-600">
                      <div className="flex h-2 w-2 rounded-full bg-green-500 animate-pulse"></div>
                      AI-Extracted
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>

      {/* Mobile Actions Drawer (Hidden on Desktop) */}
      <div className="fixed bottom-0 inset-x-0 p-4 bg-white/95 backdrop-blur-xl border-t border-slate-200 lg:hidden z-40 shadow-[0_-10px_40px_rgba(0,0,0,0.05)]">
        {!state.data.length ? (
          <button 
            onClick={processFiles}
            disabled={state.isProcessing || uploadedFiles.length === 0}
            className="w-full bg-[#006837] text-white font-black py-4 rounded-2xl shadow-xl flex items-center justify-center gap-3 disabled:bg-slate-200 disabled:text-slate-400 active:scale-95 transition-all"
          >
            {state.isProcessing ? <Loader2 className="w-5 h-5 animate-spin" /> : <TrendingUp className="w-5 h-5" />}
            {state.isProcessing ? 'Analyzing Documents...' : 'START EXTRACTION'}
          </button>
        ) : (
          <div className="flex gap-3">
            <button 
              onClick={() => {
                resultsRef.current?.scrollIntoView({ behavior: 'smooth' });
              }}
              className="flex-1 bg-slate-900 text-white font-black py-4 rounded-2xl shadow-xl flex items-center justify-center gap-2 uppercase text-xs tracking-widest"
            >
              <LayoutGrid className="w-4 h-4" />
              View List
            </button>
            <button 
              onClick={downloadCSV}
              className="w-16 bg-[#006837] text-white font-black py-4 rounded-2xl shadow-xl flex items-center justify-center active:scale-95 transition-all"
            >
              <Download className="w-5 h-5" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
