
import React, { useState, useMemo, useEffect } from 'react';
import { 
  Upload, Users, MapPin, Trash2, Search, 
  Loader2, AlertCircle, FileSpreadsheet, File as FileIcon, 
  TrendingUp, List, LayoutGrid, ChevronRight,
  Printer, X, BarChart3, PieChart, Download, Info,
  CheckCircle2, Scan, Database, ShieldCheck
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
  const [processLogs, setProcessLogs] = useState<string[]>([]);
  
  useEffect(() => {
    if (state.isProcessing) {
      const logs = [
        "Initializing secure vision engine...",
        "Scanning document boundaries...",
        "Detecting table structures...",
        "OCR extraction in progress...",
        "Identifying Organization (PPA) headers...",
        "Normalizing personnel records...",
        "Cross-referencing state codes...",
        "Validating data integrity..."
      ];
      
      let i = 0;
      const interval = setInterval(() => {
        if (i < logs.length) {
          setProcessLogs(prev => [logs[i], ...prev].slice(0, 5));
          i++;
        }
      }, 1500);
      
      return () => clearInterval(interval);
    } else {
      setProcessLogs([]);
    }
  }, [state.isProcessing]);

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
    setState(prev => ({ ...prev, isProcessing: true, processingStep: 'scanning', error: null }));
    try {
      setState(prev => ({ ...prev, processingStep: 'extracting' }));
      const result = await extractCorpsData(uploadedFiles);
      setState(prev => ({ ...prev, data: result.members, isProcessing: false, processingStep: 'idle' }));
      setUploadedFiles([]);
    } catch (err: any) {
      setState(prev => ({ ...prev, isProcessing: false, processingStep: 'idle', error: err.message }));
    }
  };

  const filteredData = useMemo(() => {
    return state.data.filter(m => 
      m.fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      m.companyName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      m.stateCode.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [state.data, searchTerm]);

  const filteredStats = useMemo(() => {
    const total = filteredData.length;
    const uniquePPAs = new Set(filteredData.map(m => m.companyName)).size;
    const males = filteredData.filter(m => m.gender === 'M').length;
    return { total, uniquePPAs, males, females: total - males };
  }, [filteredData]);

  const filteredSortedPPAs = useMemo(() => {
    const groups: Record<string, CorpsMember[]> = {};
    filteredData.forEach(m => {
      if (!groups[m.companyName]) groups[m.companyName] = [];
      groups[m.companyName].push(m);
    });
    return Object.entries(groups).sort((a, b) => a[0].localeCompare(b[0]));
  }, [filteredData]);

  const exportToCSV = () => {
    if (filteredData.length === 0) return;
    const headers = ['SN', 'State Code', 'Full Name', 'Gender', 'Phone', 'PPA'];
    const csvContent = [headers.join(','), ...filteredData.map(m => [m.sn, m.stateCode, `"${m.fullName}"`, m.gender, m.phone, `"${m.companyName}"`].join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `NYSC_Filtered_Data_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans">
      {/* SEARCH-SPECIFIC PRINT REPORT */}
      <div className="print-only p-12 bg-white text-black">
        <div className="flex justify-between items-start border-b-2 border-black pb-4 mb-8">
          <div>
            <h1 className="text-2xl font-black uppercase">
              {searchTerm ? `Search Results: "${searchTerm}"` : 'NYSC Personnel Record'}
            </h1>
            <p className="text-xs uppercase tracking-widest font-bold text-slate-500 mt-1">Generated via CorpsScan Pro Intelligence</p>
          </div>
          <div className="text-right">
            <p className="text-sm font-bold">{new Date().toLocaleDateString()}</p>
            <p className="text-[10px] text-slate-500 font-mono">COUNT: {filteredStats.total} RECORDS</p>
          </div>
        </div>

        <div className="grid grid-cols-4 gap-4 mb-10">
          <div className="border border-black p-2 text-center">
            <p className="text-[8px] font-black uppercase">Total Records</p>
            <p className="text-lg font-black">{filteredStats.total}</p>
          </div>
          <div className="border border-black p-2 text-center">
            <p className="text-[8px] font-black uppercase">Unique PPAs</p>
            <p className="text-lg font-black">{filteredStats.uniquePPAs}</p>
          </div>
          <div className="border border-black p-2 text-center">
            <p className="text-[8px] font-black uppercase">Male Count</p>
            <p className="text-lg font-black">{filteredStats.males}</p>
          </div>
          <div className="border border-black p-2 text-center">
            <p className="text-[8px] font-black uppercase">Female Count</p>
            <p className="text-lg font-black">{filteredStats.females}</p>
          </div>
        </div>

        {filteredSortedPPAs.map(([ppa, members]) => (
          <div key={ppa} className="mb-10 no-break">
            <div className="flex justify-between items-center bg-slate-100 border border-black px-4 py-2 mb-2">
              <h2 className="text-md font-black uppercase">{ppa}</h2>
              <span className="text-xs font-bold">STRENGTH: {members.length}</span>
            </div>
            <table className="w-full border-collapse border border-black text-[10pt]">
              <thead>
                <tr className="bg-slate-50">
                  <th className="border border-black p-1.5 text-left w-12">SN</th>
                  <th className="border border-black p-1.5 text-left w-32">STATE CODE</th>
                  <th className="border border-black p-1.5 text-left">FULL NAME</th>
                  <th className="border border-black p-1.5 text-center w-12">GDR</th>
                  <th className="border border-black p-1.5 text-left w-32">PHONE</th>
                </tr>
              </thead>
              <tbody>
                {members.map(m => (
                  <tr key={m.id}>
                    <td className="border border-black p-1.5 font-mono">{m.sn}</td>
                    <td className="border border-black p-1.5 font-bold">{m.stateCode}</td>
                    <td className="border border-black p-1.5 uppercase font-black">{m.fullName}</td>
                    <td className="border border-black p-1.5 text-center">{m.gender}</td>
                    <td className="border border-black p-1.5 text-[9pt]">{m.phone}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}

        <div className="mt-20 flex justify-between">
          <div className="w-48 border-t border-black pt-2">
            <p className="text-[8px] font-black uppercase">Extraction Officer</p>
          </div>
          <div className="w-48 border-t border-black pt-2">
            <p className="text-[8px] font-black uppercase">Authorized Stamp</p>
          </div>
        </div>
      </div>

      <header className="bg-white border-b border-slate-200 sticky top-0 z-20 no-print">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="bg-emerald-600 p-2 rounded-lg shadow-lg shadow-emerald-600/20">
              <Users className="text-white h-5 w-5" />
            </div>
            <h1 className="font-bold text-xl tracking-tight text-slate-800">CorpsScan <span className="text-emerald-600">Pro</span></h1>
          </div>
          {state.data.length > 0 && (
            <div className="flex gap-2">
              <button onClick={() => setViewMode('table')} className={`p-2 rounded-lg ${viewMode === 'table' ? 'bg-emerald-50 text-emerald-600' : 'text-slate-400'}`}><List size={20}/></button>
              <button onClick={() => setViewMode('report')} className={`p-2 rounded-lg ${viewMode === 'report' ? 'bg-emerald-50 text-emerald-600' : 'text-slate-400'}`}><LayoutGrid size={20}/></button>
              <button onClick={() => setViewMode('analytics')} className={`p-2 rounded-lg ${viewMode === 'analytics' ? 'bg-emerald-50 text-emerald-600' : 'text-slate-400'}`}><BarChart3 size={20}/></button>
              <div className="w-px h-8 bg-slate-200 mx-2"/>
              <button onClick={exportToCSV} className="bg-slate-100 px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2"><Download size={16}/> CSV</button>
              <button 
                onClick={() => window.print()} 
                className="bg-emerald-600 text-white px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 shadow-lg shadow-emerald-600/20 active:scale-95 transition-all"
                title="Print current searched results"
              >
                <Printer size={16}/> Export PDF
              </button>
            </div>
          )}
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8 no-print">
        {state.error && (
          <div className="mb-6 bg-red-50 border border-red-200 text-red-700 p-4 rounded-2xl flex items-center justify-between animate-in fade-in slide-in-from-top-4">
            <div className="flex items-center gap-3">
              <AlertCircle size={20} />
              <p className="text-sm font-bold">{state.error}</p>
            </div>
            <button onClick={() => setState(s => ({...s, error: null}))}><X size={20}/></button>
          </div>
        )}

        {state.data.length === 0 && !state.isProcessing ? (
          <div className="max-w-xl mx-auto py-12">
            <div className="bg-white rounded-[2.5rem] border border-slate-200 p-12 text-center shadow-xl shadow-slate-200/50">
              <div className="bg-emerald-50 w-20 h-20 rounded-3xl flex items-center justify-center mx-auto mb-8 rotate-3">
                <Upload className="text-emerald-600 w-10 h-10" />
              </div>
              <h2 className="text-3xl font-black text-slate-900 mb-3">Personnel Extractor</h2>
              <p className="text-slate-500 mb-10 text-lg">Drop your scanned deployment lists here.</p>
              
              <label className="block w-full cursor-pointer group">
                <input type="file" multiple className="hidden" onChange={handleFileUpload} accept="image/*,application/pdf,.csv,.txt" />
                <div className="border-2 border-dashed border-slate-200 rounded-[2rem] py-16 bg-slate-50 group-hover:border-emerald-400 group-hover:bg-emerald-50/50 transition-all">
                  <FileIcon className="text-slate-300 mx-auto mb-4 group-hover:text-emerald-500 transition-colors" size={48} />
                  <span className="text-slate-600 font-bold">Browse or Drop Files</span>
                </div>
              </label>

              {uploadedFiles.length > 0 && (
                <div className="mt-8 text-left animate-in fade-in zoom-in-95">
                  <div className="space-y-2 mb-8">
                    {uploadedFiles.map((f, i) => (
                      <div key={i} className="flex items-center justify-between bg-white border border-slate-100 p-3 rounded-xl shadow-sm">
                        <div className="flex items-center gap-3 truncate">
                          <FileIcon size={16} className="text-emerald-600 shrink-0"/>
                          <span className="text-sm font-bold truncate">{f.name}</span>
                        </div>
                        <button onClick={() => setUploadedFiles(prev => prev.filter((_, idx) => idx !== i))} className="text-slate-300 hover:text-red-500"><Trash2 size={16}/></button>
                      </div>
                    ))}
                  </div>
                  <button onClick={processData} className="w-full bg-slate-900 hover:bg-black text-white py-5 rounded-2xl font-black text-lg flex items-center justify-center gap-3 shadow-2xl transition-all">
                    Process Records <ChevronRight size={24}/>
                  </button>
                </div>
              )}
            </div>
          </div>
        ) : state.isProcessing ? (
          <div className="max-w-3xl mx-auto py-20 flex flex-col items-center">
            <div className="relative w-40 h-40 mb-12">
              <div className="absolute inset-0 border-4 border-emerald-100 rounded-full animate-pulse" />
              <div className="absolute inset-0 border-t-4 border-emerald-600 rounded-full animate-spin" />
              <div className="absolute inset-0 flex items-center justify-center">
                <Scan className="text-emerald-600 animate-bounce" size={48} />
              </div>
            </div>

            <h2 className="text-2xl font-black text-slate-900 mb-2">Analyzing Personnel Documents</h2>
            <p className="text-slate-400 font-medium mb-12 italic">Gemini Intelligence is reading {uploadedFiles.length} files...</p>

            <div className="w-full max-w-lg bg-slate-900 rounded-3xl p-6 shadow-2xl border border-slate-800 overflow-hidden">
              <div className="flex items-center gap-2 mb-4 pb-3 border-b border-slate-800">
                <div className="flex gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full bg-red-500/50" />
                  <div className="w-2.5 h-2.5 rounded-full bg-amber-500/50" />
                  <div className="w-2.5 h-2.5 rounded-full bg-emerald-500/50" />
                </div>
                <span className="text-[10px] font-mono text-slate-500 uppercase ml-2 tracking-widest">Intelligence Stream</span>
              </div>
              <div className="space-y-3 font-mono text-xs">
                {processLogs.map((log, i) => (
                  <div key={i} className={`flex items-start gap-3 transition-all duration-500 ${i === 0 ? 'text-emerald-400' : 'text-slate-500'}`}>
                    <span className="shrink-0">{i === 0 ? '>' : ' '}</span>
                    <span>{log}</span>
                  </div>
                ))}
                {processLogs.length === 0 && <div className="text-slate-600 animate-pulse">Establishing neural connection...</div>}
              </div>
            </div>

            <button 
              onClick={() => setState(s => ({...s, isProcessing: false}))}
              className="mt-12 text-slate-400 font-bold hover:text-red-500 text-sm flex items-center gap-2 transition-colors"
            >
              <X size={16}/> Cancel Extraction
            </button>
          </div>
        ) : (
          <div className="space-y-8 animate-in fade-in duration-700">
            {/* STATS */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              {[
                { label: 'Total Filtered', val: filteredStats.total, icon: Users, color: 'emerald' },
                { label: 'Active PPAs', val: filteredStats.uniquePPAs, icon: MapPin, color: 'blue' },
                { label: 'Males', val: filteredStats.males, icon: TrendingUp, color: 'indigo' },
                { label: 'Females', val: filteredStats.females, icon: TrendingUp, color: 'pink' }
              ].map((s, i) => (
                <div key={i} className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex items-center gap-5">
                  <div className={`bg-${s.color}-50 text-${s.color}-600 p-4 rounded-2xl`}>
                    <s.icon size={24}/>
                  </div>
                  <div>
                    <p className="text-xs font-black text-slate-400 uppercase tracking-widest">{s.label}</p>
                    <h3 className="text-3xl font-black text-slate-900">{s.val}</h3>
                  </div>
                </div>
              ))}
            </div>

            {/* SEARCH */}
            <div className="relative group">
              <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-emerald-500 transition-colors" size={24}/>
              <input 
                type="text" 
                placeholder="Search by name, state code, or organization..." 
                className="w-full pl-16 pr-8 py-6 bg-white border border-slate-200 rounded-[2rem] shadow-sm outline-none focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 transition-all text-lg font-medium"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
              />
              {searchTerm && (
                <button 
                  onClick={() => setSearchTerm('')}
                  className="absolute right-6 top-1/2 -translate-y-1/2 text-slate-300 hover:text-slate-500"
                >
                  <X size={20}/>
                </button>
              )}
            </div>

            {/* DATA VIEW */}
            <div className="bg-white rounded-[2rem] border border-slate-200 shadow-xl overflow-hidden min-h-[500px]">
              {filteredData.length === 0 ? (
                <div className="p-20 text-center flex flex-col items-center">
                  <div className="bg-slate-50 p-6 rounded-full mb-4">
                    <Search className="text-slate-300" size={40} />
                  </div>
                  <p className="text-slate-500 font-bold text-lg">No records found matching "{searchTerm}"</p>
                  <button onClick={() => setSearchTerm('')} className="mt-4 text-emerald-600 font-bold hover:underline">Clear Search</button>
                </div>
              ) : viewMode === 'table' ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead><tr className="bg-slate-50 border-b border-slate-100">
                      <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">SN</th>
                      <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Code</th>
                      <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Full Name</th>
                      <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Gender</th>
                      <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Assigned PPA</th>
                    </tr></thead>
                    <tbody className="divide-y divide-slate-50">
                      {filteredData.map(m => (
                        <tr key={m.id} className="hover:bg-slate-50/50 transition-colors">
                          <td className="px-8 py-5 text-sm font-mono text-slate-400">{m.sn}</td>
                          <td className="px-8 py-5 text-sm font-black text-emerald-700">{m.stateCode}</td>
                          <td className="px-8 py-5 text-sm font-black text-slate-900 uppercase">{m.fullName}</td>
                          <td className="px-8 py-5"><span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase ${m.gender === 'M' ? 'bg-blue-50 text-blue-600' : 'bg-pink-50 text-pink-600'}`}>{m.gender}</span></td>
                          <td className="px-8 py-5 text-xs font-bold text-slate-500 uppercase truncate max-w-[200px]">{m.companyName}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : viewMode === 'report' ? (
                <div className="p-8 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {filteredSortedPPAs.map(([ppa, members]) => (
                    <div key={ppa} className="bg-white rounded-3xl border border-slate-100 shadow-sm flex flex-col group hover:shadow-lg transition-all border-2 border-transparent hover:border-emerald-100 overflow-hidden">
                      <div className="p-5 bg-slate-900 text-white flex justify-between items-center">
                        <h3 className="font-black text-[10px] uppercase truncate pr-4">{ppa}</h3>
                        <span className="bg-emerald-500 text-[10px] font-black px-2 py-1 rounded-md">{members.length}</span>
                      </div>
                      <div className="p-5 space-y-3 max-h-60 overflow-y-auto custom-scrollbar">
                        {members.map(m => (
                          <div key={m.id} className="flex items-center gap-3">
                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-[10px] font-black ${m.gender === 'M' ? 'bg-indigo-50 text-indigo-600' : 'bg-pink-50 text-pink-600'}`}>{m.fullName.charAt(0)}</div>
                            <p className="text-[11px] font-black text-slate-800 uppercase truncate">{m.fullName}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-12 grid grid-cols-1 lg:grid-cols-2 gap-12">
                   <div className="space-y-8">
                     <h3 className="font-black text-xl flex items-center gap-3"><PieChart className="text-emerald-600"/> Demographics (Filtered)</h3>
                     <div className="flex items-center justify-around">
                       <div className="text-center">
                         <p className="text-5xl font-black text-indigo-600 mb-2">{filteredStats.total ? Math.round((filteredStats.males/filteredStats.total)*100) : 0}%</p>
                         <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Male Personnel</p>
                       </div>
                       <div className="w-px h-20 bg-slate-100"/>
                       <div className="text-center">
                         <p className="text-5xl font-black text-pink-600 mb-2">{filteredStats.total ? Math.round((filteredStats.females/filteredStats.total)*100) : 0}%</p>
                         <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Female Personnel</p>
                       </div>
                     </div>
                   </div>
                   <div className="space-y-8">
                     <h3 className="font-black text-xl flex items-center gap-3"><Database className="text-emerald-600"/> Filtered PPA Distribution</h3>
                     <div className="space-y-4 max-h-[300px] overflow-y-auto pr-4 custom-scrollbar">
                        {filteredSortedPPAs.sort((a,b) => b[1].length - a[1].length).map(([ppa, members]) => (
                          <div key={ppa}>
                            <div className="flex justify-between text-[10px] font-black uppercase text-slate-400 mb-1">
                              <span className="truncate pr-4">{ppa}</span>
                              <span>{members.length}</span>
                            </div>
                            <div className="w-full h-2 bg-slate-50 rounded-full overflow-hidden">
                              <div className="h-full bg-emerald-500 rounded-full" style={{width: `${(members.length/filteredStats.total)*100}%`}}/>
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

      <footer className="max-w-7xl mx-auto px-4 py-12 text-center text-slate-300 no-print">
        <div className="flex items-center justify-center gap-6 mb-4">
          <ShieldCheck size={20}/>
          <Database size={20}/>
          <Scan size={20}/>
        </div>
        <p className="text-[10px] font-black uppercase tracking-[0.3em]">Encrypted Extraction Engine • AI Integrated</p>
      </footer>
    </div>
  );
};

export default App;
