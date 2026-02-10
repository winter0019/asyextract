
import React, { useState, useMemo } from 'react';
import { 
  Upload, Users, MapPin, Trash2, Search, 
  Loader2, AlertCircle, FileSpreadsheet, File as FileIcon, 
  TrendingUp, List, LayoutGrid, ChevronRight,
  Printer, X, BarChart3, PieChart
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
      {/* Printable Report (Hidden in Browser) */}
      <div className="print-only p-8 bg-white text-black">
        <div className="text-center mb-8 border-b-2 border-slate-900 pb-6">
          <h1 className="text-3xl font-black uppercase tracking-tighter mb-1">National Youth Service Corps</h1>
          <h2 className="text-xl font-bold text-slate-700 uppercase">Personnel Distribution Report</h2>
          <p className="text-sm text-slate-500 mt-2 font-mono">Generated on: {new Date().toLocaleDateString()} {new Date().toLocaleTimeString()}</p>
        </div>

        <div className="grid grid-cols-3 gap-4 mb-8">
          <div className="border border-slate-900 p-4 text-center">
            <p className="text-xs uppercase font-bold text-slate-600 mb-1">Total Strength</p>
            <p className="text-2xl font-black">{stats.total}</p>
          </div>
          <div className="border border-slate-900 p-4 text-center">
            <p className="text-xs uppercase font-bold text-slate-600 mb-1">Gender Distribution</p>
            <p className="text-lg font-bold">M: {stats.males} | F: {stats.females}</p>
          </div>
          <div className="border border-slate-900 p-4 text-center">
            <p className="text-xs uppercase font-bold text-slate-600 mb-1">Total PPA Count</p>
            <p className="text-2xl font-black">{stats.uniquePPAs}</p>
          </div>
        </div>

        {sortedPPAs.map(([ppa, members], index) => (
          <div key={ppa} className={`${index > 0 ? 'page-break' : ''} mb-8`}>
            <div className="bg-slate-100 p-3 border border-slate-900 mb-4">
              <h3 className="text-lg font-bold uppercase tracking-tight">{ppa}</h3>
              <p className="text-xs font-medium text-slate-600">Deployment Count: {members.length}</p>
            </div>
            <table className="w-full">
              <thead>
                <tr>
                  <th className="text-left w-12">SN</th>
                  <th className="text-left w-32">State Code</th>
                  <th className="text-left">Full Name</th>
                  <th className="text-left w-20">Gender</th>
                  <th className="text-left w-32">Phone</th>
                </tr>
              </thead>
              <tbody>
                {members.sort((a,b) => a.sn - b.sn).map(m => (
                  <tr key={m.id}>
                    <td>{m.sn}</td>
                    <td className="font-mono">{m.stateCode}</td>
                    <td className="font-bold">{m.fullName}</td>
                    <td>{m.gender}</td>
                    <td>{m.phone}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}
      </div>

      {/* Main UI Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10 no-print">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="bg-emerald-600 p-2 rounded-lg">
              <Users className="text-white h-5 w-5" />
            </div>
            <h1 className="font-bold text-xl tracking-tight text-slate-800">CorpsScan <span className="text-emerald-600">Pro</span></h1>
          </div>
          
          <div className="flex items-center gap-4">
            {state.data.length > 0 && (
              <div className="flex bg-slate-100 p-1 rounded-lg">
                <button 
                  onClick={() => setViewMode('table')}
                  className={`p-1.5 rounded-md transition-all ${viewMode === 'table' ? 'bg-white shadow-sm text-emerald-600' : 'text-slate-500 hover:text-slate-700'}`}
                >
                  <List size={18} />
                </button>
                <button 
                  onClick={() => setViewMode('report')}
                  className={`p-1.5 rounded-md transition-all ${viewMode === 'report' ? 'bg-white shadow-sm text-emerald-600' : 'text-slate-500 hover:text-slate-700'}`}
                >
                  <LayoutGrid size={18} />
                </button>
                <button 
                  onClick={() => setViewMode('analytics')}
                  className={`p-1.5 rounded-md transition-all ${viewMode === 'analytics' ? 'bg-white shadow-sm text-emerald-600' : 'text-slate-500 hover:text-slate-700'}`}
                >
                  <BarChart3 size={18} />
                </button>
              </div>
            )}
            {state.data.length > 0 && (
              <button 
                className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg font-medium text-sm flex items-center gap-2 transition-colors shadow-sm"
                onClick={() => window.print()}
              >
                <Printer size={16} />
                Export PDF
              </button>
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
          <div className="max-w-2xl mx-auto">
            <div className="bg-white rounded-3xl border border-slate-200 p-12 text-center shadow-sm">
              <div className="bg-emerald-50 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6">
                <Upload className="text-emerald-600 w-10 h-10" />
              </div>
              <h2 className="text-2xl font-bold text-slate-800 mb-2">Extract Personnel Data</h2>
              <p className="text-slate-500 mb-8 max-w-md mx-auto">
                Upload scanned clearance forms, lists, or photos of NYSC documents. 
                Our AI will automatically extract and categorize Corps member details.
              </p>
              
              <div className="space-y-4">
                <label className="block w-full cursor-pointer">
                  <input 
                    type="file" 
                    multiple 
                    className="hidden" 
                    onChange={handleFileUpload}
                    accept="image/*,application/pdf,.csv,.txt"
                  />
                  <div className="border-2 border-dashed border-slate-200 rounded-2xl py-10 px-6 hover:border-emerald-400 hover:bg-emerald-50/30 transition-all group">
                    <div className="flex flex-col items-center">
                      <FileSpreadsheet className="text-slate-400 group-hover:text-emerald-500 transition-colors mb-2" />
                      <span className="text-slate-600 font-medium">Click to browse or drag and drop</span>
                      <span className="text-slate-400 text-xs mt-1">PNG, JPG, PDF, CSV, TXT</span>
                    </div>
                  </div>
                </label>

                {uploadedFiles.length > 0 && (
                  <div className="mt-6 text-left animate-in fade-in slide-in-from-bottom-2">
                    <h3 className="text-sm font-semibold text-slate-700 mb-3 px-1">Selected Files ({uploadedFiles.length})</h3>
                    <div className="space-y-2">
                      {uploadedFiles.map((file, i) => (
                        <div key={i} className="flex items-center justify-between bg-slate-50 border border-slate-200 p-3 rounded-xl">
                          <div className="flex items-center gap-3">
                            <div className="bg-white p-2 rounded-lg shadow-xs">
                              <FileIcon size={16} className="text-slate-400" />
                            </div>
                            <span className="text-sm font-medium text-slate-700 truncate max-w-[200px]">{file.name}</span>
                          </div>
                          <button 
                            onClick={() => removeFile(i)}
                            className="p-1.5 hover:bg-red-100 hover:text-red-600 rounded-lg text-slate-400 transition-all"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      ))}
                    </div>
                    
                    <button 
                      onClick={processData}
                      className="w-full mt-6 bg-emerald-600 hover:bg-emerald-700 text-white py-4 rounded-xl font-bold flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/20 transition-all active:scale-[0.98]"
                    >
                      Process Documents
                      <ChevronRight size={18} />
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : state.isProcessing ? (
          <div className="flex flex-col items-center justify-center py-20 text-center animate-in fade-in duration-500">
            <div className="relative mb-8">
              <div className="w-24 h-24 rounded-full border-4 border-emerald-100 border-t-emerald-600 animate-spin" />
              <div className="absolute inset-0 flex items-center justify-center">
                <Loader2 className="text-emerald-600 animate-pulse" size={32} />
              </div>
            </div>
            <h2 className="text-2xl font-bold text-slate-800 mb-2">
              {state.processingStep === 'scanning' ? 'Scanning Documents...' : 
               state.processingStep === 'extracting' ? 'Analyzing Text with Gemini AI...' : 
               'Finalizing Data...'}
            </h2>
          </div>
        ) : (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
            {/* Dashboard summary omitted for brevity but present in original file logic */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
                <p className="text-slate-500 text-sm font-medium mb-1">Total Strength</p>
                <div className="flex items-end justify-between">
                  <h3 className="text-3xl font-bold text-slate-900">{stats.total}</h3>
                  <div className="bg-emerald-50 text-emerald-700 p-1.5 rounded-lg">
                    <Users size={18} />
                  </div>
                </div>
              </div>
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
                <p className="text-slate-500 text-sm font-medium mb-1">Organizations</p>
                <div className="flex items-end justify-between">
                  <h3 className="text-3xl font-bold text-slate-900">{stats.uniquePPAs}</h3>
                  <div className="bg-blue-50 text-blue-700 p-1.5 rounded-lg">
                    <MapPin size={18} />
                  </div>
                </div>
              </div>
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
                <p className="text-slate-500 text-sm font-medium mb-1">Male</p>
                <div className="flex items-end justify-between">
                  <h3 className="text-3xl font-bold text-slate-900">{stats.males}</h3>
                  <div className="bg-indigo-50 text-indigo-700 p-1.5 rounded-lg">
                    <TrendingUp size={18} />
                  </div>
                </div>
              </div>
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
                <p className="text-slate-500 text-sm font-medium mb-1">Female</p>
                <div className="flex items-end justify-between">
                  <h3 className="text-3xl font-bold text-slate-900">{stats.females}</h3>
                  <div className="bg-pink-50 text-pink-700 p-1.5 rounded-lg">
                    <TrendingUp size={18} className="rotate-180" />
                  </div>
                </div>
              </div>
            </div>

            <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
              <div className="relative w-full md:w-96">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <input 
                  type="text" 
                  placeholder="Search..."
                  className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all shadow-sm"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              
              <button 
                onClick={() => setState(prev => ({ ...prev, data: [] }))}
                className="px-4 py-2.5 border border-slate-200 rounded-xl text-slate-600 font-medium hover:bg-slate-50 transition-colors flex items-center gap-2 whitespace-nowrap"
              >
                <Trash2 size={18} />
                Clear All
              </button>
            </div>

            {viewMode === 'table' ? (
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200">
                        <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">SN</th>
                        <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">State Code</th>
                        <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Full Name</th>
                        <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Gender</th>
                        <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Phone</th>
                        <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">PPA</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filteredData.map((member) => (
                        <tr key={member.id} className="hover:bg-slate-50/50 transition-colors">
                          <td className="px-6 py-4 text-sm text-slate-500">{member.sn}</td>
                          <td className="px-6 py-4 text-sm font-mono font-medium text-emerald-700">{member.stateCode}</td>
                          <td className="px-6 py-4 text-sm font-bold text-slate-800">{member.fullName}</td>
                          <td className="px-6 py-4 text-sm">
                            <span className={`px-2 py-1 rounded-md text-[10px] font-bold uppercase ${member.gender === 'M' ? 'bg-indigo-50 text-indigo-600' : 'bg-pink-50 text-pink-600'}`}>
                              {member.gender === 'M' ? 'Male' : 'Female'}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-sm text-slate-600">{member.phone}</td>
                          <td className="px-6 py-4 text-sm font-medium text-slate-700 uppercase">{member.companyName}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : viewMode === 'report' ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {sortedPPAs.map(([ppa, members]) => (
                  <div key={ppa} className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
                    <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                      <h3 className="font-bold text-slate-800 text-xs truncate uppercase">{ppa}</h3>
                      <span className="bg-emerald-100 text-emerald-700 text-[10px] font-bold px-2 py-1 rounded-full shrink-0 ml-2">{members.length}</span>
                    </div>
                    <div className="p-4 space-y-3 max-h-96 overflow-y-auto custom-scrollbar flex-grow">
                      {members.map(m => (
                        <div key={m.id} className="flex items-start gap-3">
                          <div className={`w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center text-[10px] font-bold ${m.gender === 'M' ? 'bg-indigo-100 text-indigo-600' : 'bg-pink-100 text-pink-600'}`}>
                            {m.fullName.charAt(0)}
                          </div>
                          <div className="overflow-hidden">
                            <p className="text-sm font-bold text-slate-800 truncate">{m.fullName}</p>
                            <p className="text-xs text-slate-500 font-mono">{m.stateCode}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                  <div className="flex items-center gap-2 mb-6">
                    <PieChart className="text-emerald-600" size={20} />
                    <h3 className="font-bold text-slate-800">Gender Balance</h3>
                  </div>
                  <div className="flex items-center justify-around py-8">
                    <div className="text-center">
                      <div className="text-4xl font-black text-indigo-600">{Math.round((stats.males / stats.total) * 100 || 0)}%</div>
                      <p className="text-sm font-bold text-slate-500 uppercase tracking-widest mt-1">Male</p>
                    </div>
                    <div className="text-center">
                      <div className="text-4xl font-black text-pink-600">{Math.round((stats.females / stats.total) * 100 || 0)}%</div>
                      <p className="text-sm font-bold text-slate-500 uppercase tracking-widest mt-1">Female</p>
                    </div>
                  </div>
                </div>
                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                  <div className="flex items-center gap-2 mb-6">
                    <BarChart3 className="text-emerald-600" size={20} />
                    <h3 className="font-bold text-slate-800">PPA Distribution</h3>
                  </div>
                  <div className="space-y-4 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                    {sortedPPAs
                      .sort((a, b) => b[1].length - a[1].length)
                      .map(([ppa, members]) => (
                        <div key={ppa}>
                          <div className="flex justify-between text-[10px] font-bold mb-1 uppercase text-slate-600">
                            <span className="truncate mr-2">{ppa}</span>
                            <span>{members.length}</span>
                          </div>
                          <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                            <div 
                              className="bg-emerald-500 h-full rounded-full transition-all duration-1000" 
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
        )}
      </main>
    </div>
  );
};

export default App;
