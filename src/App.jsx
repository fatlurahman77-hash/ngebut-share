import React, { useState, useEffect, useRef } from 'react';
import { UploadCloud, DownloadCloud, Server, HardDrive, Smartphone, File, Folder as FolderIcon, X, CheckCircle, Clock, ChevronRight, Download, Zap, Search, Home, ArrowLeft } from 'lucide-react';
import { Peer } from 'peerjs';

// --- Komponen Tombol 3D ---
const Button3D = ({ children, onClick, color = 'blue', className = '', disabled = false }) => {
  const colorVariants = {
    blue: 'bg-blue-500 hover:bg-blue-400 border-blue-700 text-white shadow-blue-500/50',
    purple: 'bg-purple-500 hover:bg-purple-400 border-purple-700 text-white shadow-purple-500/50',
    amber: 'bg-amber-500 hover:bg-amber-400 border-amber-700 text-white shadow-amber-500/50',
    emerald: 'bg-emerald-500 hover:bg-emerald-400 border-emerald-700 text-white shadow-emerald-500/50',
    gray: 'bg-slate-700 hover:bg-slate-600 border-slate-900 text-white shadow-slate-900/50',
    red: 'bg-rose-500 hover:bg-rose-400 border-rose-700 text-white shadow-rose-500/50',
  };

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`
        relative font-bold py-3 px-6 rounded-2xl border-b-[6px] 
        active:border-b-0 active:translate-y-[6px] transition-all duration-150
        flex items-center justify-center gap-2 shadow-lg
        ${colorVariants[color]}
        ${disabled ? 'opacity-50 cursor-not-allowed active:border-b-[6px] active:translate-y-0' : ''}
        ${className}
      `}
    >
      {children}
    </button>
  );
};

export default function App() {
  const [currentScreen, setCurrentScreen] = useState('home'); 
  const [toast, setToast] = useState('');
  
  // PeerJS Core
  const [peer, setPeer] = useState(null);
  const [myId, setMyId] = useState('');

  // === STATE HOST ===
  const [hostedFiles, setHostedFiles] = useState([]);
  const [hostStatus, setHostStatus] = useState('idle'); 
  const fileInputRef = useRef(null);

  // === STATE REMOTE (CLIENT) ===
  const [remoteId, setRemoteId] = useState('');
  const [conn, setConn] = useState(null);
  const [remoteFiles, setRemoteFiles] = useState([]);
  const [remoteStatus, setRemoteStatus] = useState('disconnected');
  const [searchQuery, setSearchQuery] = useState('');

  // === STATE DIRECT TRANSFER (KIRIM/TERIMA) ===
  const [sendStatus, setSendStatus] = useState('idle'); 
  const [sentFilesCount, setSentFilesCount] = useState(0);
  const [receiveStatus, setReceiveStatus] = useState('idle');
  const [receivedFiles, setReceivedFiles] = useState([]);
  const directFileInputRef = useRef(null);

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(''), 3000);
  };

  // Bersihkan Peer saat ganti layar
  useEffect(() => {
    return () => {
      if (peer) peer.destroy();
    };
  }, [peer]);

  // ==========================================
  // LOGIKA HOST (SERVER LOKAL)
  // ==========================================
  const startHosting = () => setCurrentScreen('host');

  const handleFolderSelect = (e) => {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;

    const newPeer = new Peer(Math.random().toString(36).substring(2, 8).toUpperCase());
    
    newPeer.on('open', (id) => {
      setMyId(id);
      setHostStatus('ready');
      setPeer(newPeer);
    });

    newPeer.on('connection', (connection) => {
      showToast('Koneksi Client Masuk!');
      
      connection.on('open', () => {
        // Kirim list file tanpa file aslinya
        const fileStructure = files.map(f => ({
            name: f.name,
            path: f.webkitRelativePath,
            size: f.size,
            type: f.type
        }));
        connection.send({ type: 'FILE_LIST', data: fileStructure });
      });

      connection.on('data', (data) => {
         if(data.type === 'REQUEST_FILE') {
             // Klien minta download file, proses baca file lalu kirim
             const requestedFile = files.find(f => f.webkitRelativePath === data.path);
             if(requestedFile) {
                 const reader = new FileReader();
                 // Baca sebagai ArrayBuffer untuk kecepatan & ukuran file besar
                 reader.onload = (e) => {
                     connection.send({ 
                         type: 'FILE_DATA', 
                         fileName: requestedFile.name, 
                         fileData: e.target.result,
                         fileType: requestedFile.type
                     });
                 };
                 reader.readAsArrayBuffer(requestedFile);
             }
         }
      });
    });
    setHostedFiles(files);
  };

  // ==========================================
  // LOGIKA REMOTE (CLIENT)
  // ==========================================
  const startRemoteAccess = () => setCurrentScreen('remote');

  const connectToHost = () => {
    if (!remoteId.trim()) return showToast("Masukkan ID Host!");
    
    setRemoteStatus('connecting');
    const newPeer = new Peer();
    
    newPeer.on('open', () => {
      const connection = newPeer.connect(remoteId.toUpperCase());
      
      connection.on('open', () => {
        setConn(connection);
        setRemoteStatus('connected');
        showToast("Berhasil Terhubung!");
      });

      connection.on('data', (data) => {
        if (data.type === 'FILE_LIST') {
          setRemoteFiles(data.data);
        } else if (data.type === 'FILE_DATA') {
          // Terima ArrayBuffer, ubah jadi file untuk didownload
          const blob = new Blob([data.fileData], { type: data.fileType });
          const url = URL.createObjectURL(blob);
          triggerDownload(url, data.fileName);
          setTimeout(() => URL.revokeObjectURL(url), 10000); // cleanup memory
        }
      });

      connection.on('error', () => {
          setRemoteStatus('disconnected');
          showToast("Gagal terhubung ke Host.");
      });
    });
  };

  const requestFile = (path) => {
      if(conn && remoteStatus === 'connected') {
          showToast(`Sedang menyedot file...`);
          conn.send({ type: 'REQUEST_FILE', path: path });
      }
  };

  const triggerDownload = (url, filename) => {
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      showToast(`Selesai diunduh: ${filename}`);
  };

  const disconnectRemote = () => {
      if(conn) conn.close();
      setRemoteStatus('disconnected');
      setRemoteFiles([]);
      setCurrentScreen('home');
  };

  const formatBytes = (bytes) => {
      if(bytes === 0) return '0 Bytes';
      const k = 1024, dm = 2, sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
      const i = Math.floor(Math.log(bytes) / Math.log(k));
      return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
  };

  // ==========================================
  // LOGIKA DIRECT TRANSFER (KIRIM & TERIMA)
  // ==========================================
  const startSending = () => {
    setCurrentScreen('send');
    setSendStatus('idle');
    setSentFilesCount(0);
    if (peer) peer.destroy();
    
    const newPeer = new Peer(Math.random().toString(36).substring(2, 8).toUpperCase());
    newPeer.on('open', (id) => {
      setMyId(id);
      setSendStatus('ready');
      setPeer(newPeer);
    });

    newPeer.on('connection', (connection) => {
      showToast('Penerima Terhubung!');
      setConn(connection);
      setSendStatus('connected');
    });
  };

  const handleDirectFileSelect = (e) => {
    const files = Array.from(e.target.files);
    if (files.length === 0 || !conn) return;

    files.forEach(file => {
       const reader = new FileReader();
       reader.onload = (e) => {
           conn.send({ 
               type: 'DIRECT_FILE', 
               fileName: file.name, 
               fileData: e.target.result,
               fileType: file.type
           });
           setSentFilesCount(prev => prev + 1);
           showToast(`Terkirim: ${file.name}`);
       };
       reader.readAsArrayBuffer(file);
    });
  };

  const startReceiving = () => {
    setCurrentScreen('receive');
    setReceiveStatus('idle');
    setRemoteId('');
    setReceivedFiles([]);
    if (conn) conn.close();
  };

  const connectToSender = () => {
    if (!remoteId.trim()) return showToast("Masukkan PIN Pengirim!");
    setReceiveStatus('connecting');
    const newPeer = new Peer();
    
    newPeer.on('open', () => {
      const connection = newPeer.connect(remoteId.toUpperCase());
      connection.on('open', () => {
        setConn(connection);
        setReceiveStatus('connected');
        showToast("Berhasil terhubung ke Pengirim!");
      });

      connection.on('data', (data) => {
        if (data.type === 'DIRECT_FILE') {
          const blob = new Blob([data.fileData], { type: data.fileType });
          const url = URL.createObjectURL(blob);
          triggerDownload(url, data.fileName);
          setTimeout(() => URL.revokeObjectURL(url), 10000); // Bersihkan memori otomatis
          setReceivedFiles(prev => [...prev, data.fileName]);
        }
      });

      connection.on('error', () => {
        setReceiveStatus('idle');
        showToast("Gagal terhubung ke Pengirim.");
      });
    });
  };

  // ==========================================
  // RENDER UI
  // ==========================================

  // --- UI: HOME ---
  if (currentScreen === 'home') {
    return (
      <div className="bg-slate-900 text-slate-200 min-h-[100dvh] w-full flex justify-center items-center font-sans">
        <div className="w-full max-w-md z-10 flex flex-col h-full py-8 px-4">
          <div className="flex flex-col items-center mb-8">
            <div className="bg-slate-800/80 backdrop-blur-xl p-3 rounded-3xl mb-4 border border-slate-700 shadow-xl inline-block">
               <Zap className="w-10 h-10 text-yellow-400 fill-yellow-400" />
            </div>
            <h1 className="text-3xl font-black tracking-tight bg-gradient-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent">NgebutShare</h1>
            <p className="text-sm text-slate-400 font-medium tracking-wide mt-1">P2P File & Remote Fetch</p>
          </div>

          <div className="flex-1 overflow-y-auto space-y-6 pb-6 no-scrollbar">
            {/* Kategori 1: Transfer Langsung */}
            <div className="bg-slate-800/60 backdrop-blur-md p-5 rounded-[2rem] border border-slate-700/50 shadow-lg">
              <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                <Zap className="w-4 h-4 text-blue-400" /> Transfer Langsung
              </h2>
              <div className="space-y-3">
                <Button3D color="blue" className="w-full !py-4 justify-start px-4" onClick={startSending}>
                  <div className="bg-blue-600 p-2 rounded-xl"><UploadCloud className="w-5 h-5" /></div>
                  <div className="text-left ml-2">
                    <div className="text-sm font-bold">Kirim File</div>
                    <div className="text-[10px] text-slate-300">Pilih file lalu kirim ke perangkat lain</div>
                  </div>
                </Button3D>
                <Button3D color="purple" className="w-full !py-4 justify-start px-4" onClick={startReceiving}>
                  <div className="bg-purple-600 p-2 rounded-xl"><DownloadCloud className="w-5 h-5" /></div>
                  <div className="text-left ml-2">
                    <div className="text-sm font-bold">Terima File</div>
                    <div className="text-[10px] text-slate-300">Masukkan PIN pengirim untuk menerima</div>
                  </div>
                </Button3D>
              </div>
            </div>

            {/* Kategori 2: Cloud Pribadi */}
            <div className="bg-slate-800/60 backdrop-blur-md p-5 rounded-[2rem] border border-slate-700/50 shadow-lg">
              <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                <Server className="w-4 h-4 text-amber-400" /> Cloud Pribadi
              </h2>
              <div className="space-y-3">
                <Button3D color="amber" className="w-full !py-4 justify-start px-4" onClick={startHosting}>
                  <div className="bg-amber-600 p-2 rounded-xl"><HardDrive className="w-5 h-5 text-white" /></div>
                  <div className="text-left ml-2">
                    <div className="text-sm font-bold text-white">Jadikan Host</div>
                    <div className="text-[10px] text-amber-100">Bagikan isi folder Anda via PIN</div>
                  </div>
                </Button3D>
                <Button3D color="emerald" className="w-full !py-4 justify-start px-4" onClick={startRemoteAccess}>
                  <div className="bg-emerald-600 p-2 rounded-xl"><Smartphone className="w-5 h-5 text-white" /></div>
                  <div className="text-left ml-2">
                    <div className="text-sm font-bold text-white">Akses Remote</div>
                    <div className="text-[10px] text-emerald-100">Masuk ke folder Host via PIN</div>
                  </div>
                </Button3D>
              </div>
            </div>
          </div>
        </div>
        {toast && (
          <div className="fixed bottom-10 left-1/2 transform -translate-x-1/2 bg-slate-800 text-white px-6 py-3 rounded-full shadow-2xl z-50 text-sm font-medium border border-slate-700">
            {toast}
          </div>
        )}
      </div>
    );
  }

  // --- UI: KIRIM FILE (SENDER) ---
  if (currentScreen === 'send') {
    return (
      <div className="bg-slate-900 text-slate-200 min-h-[100dvh] w-full flex flex-col font-sans">
        <header className="bg-slate-800 p-4 flex items-center gap-4 shadow-md border-b border-slate-700">
          <button onClick={() => setCurrentScreen('home')} className="p-2 bg-slate-700 rounded-full hover:bg-slate-600 transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h2 className="font-bold text-blue-400 flex items-center gap-2"><UploadCloud className="w-4 h-4"/> Kirim File Langsung</h2>
            <p className="text-xs text-slate-400">P2P File Transfer</p>
          </div>
        </header>

        <div className="flex-1 p-6 flex flex-col items-center justify-center text-center">
            {sendStatus === 'idle' && (
                <div className="text-slate-400 animate-pulse">Menyiapkan jalur aman...</div>
            )}
            
            {sendStatus === 'ready' && (
                <div className="max-w-xs w-full space-y-6 animate-fade-in-up">
                    <div className="w-20 h-20 bg-blue-500/20 rounded-full flex items-center justify-center mx-auto mb-4 border border-blue-500/50">
                        <UploadCloud className="w-10 h-10 text-blue-400" />
                    </div>
                    <h3 className="text-xl font-bold">Menunggu Penerima</h3>
                    <div className="bg-slate-800 p-6 rounded-3xl border border-slate-700 shadow-xl relative overflow-hidden">
                        <div className="absolute top-0 left-0 w-full h-1 bg-blue-500 animate-pulse"></div>
                        <p className="text-sm text-slate-400 font-medium mb-2 uppercase tracking-widest">PIN PENERIMA</p>
                        <div className="text-5xl font-black text-blue-400 tracking-[0.2em] mb-4 bg-slate-900 py-4 rounded-xl border border-slate-800">
                            {myId}
                        </div>
                        <p className="text-xs text-slate-500">Berikan PIN ini kepada orang yang akan menerima file.</p>
                    </div>
                </div>
            )}

            {sendStatus === 'connected' && (
                <div className="max-w-xs w-full space-y-6 animate-fade-in-up">
                    <div className="w-24 h-24 bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto mb-4 border border-emerald-500/50">
                        <CheckCircle className="w-12 h-12 text-emerald-400" />
                    </div>
                    <h3 className="text-2xl font-bold text-emerald-400">Penerima Siap!</h3>
                    <p className="text-sm text-slate-400">Pilih file yang ingin dikirimkan. File akan langsung meluncur ke perangkat penerima.</p>
                    
                    <input 
                        type="file" 
                        ref={directFileInputRef}
                        multiple
                        className="hidden" 
                        onChange={handleDirectFileSelect}
                    />
                    <Button3D color="blue" className="w-full !py-4" onClick={() => directFileInputRef.current.click()}>
                        Pilih & Kirim File
                    </Button3D>

                    {sentFilesCount > 0 && (
                        <div className="bg-slate-800 p-3 rounded-xl border border-slate-700 flex justify-between items-center text-sm">
                            <span className="text-slate-400">Total terkirim:</span>
                            <span className="font-bold text-white bg-blue-600 px-3 py-1 rounded-lg">{sentFilesCount} File</span>
                        </div>
                    )}
                </div>
            )}
        </div>
        {toast && (
          <div className="fixed bottom-10 left-1/2 transform -translate-x-1/2 bg-slate-800 text-white px-6 py-3 rounded-full shadow-2xl z-50 text-sm">{toast}</div>
        )}
      </div>
    );
  }

  // --- UI: TERIMA FILE (RECEIVER) ---
  if (currentScreen === 'receive') {
    return (
      <div className="bg-slate-900 text-slate-200 min-h-[100dvh] w-full flex flex-col font-sans">
        <header className="bg-slate-800 p-4 flex items-center gap-4 shadow-md border-b border-slate-700">
          <button onClick={() => setCurrentScreen('home')} className="p-2 bg-slate-700 rounded-full hover:bg-slate-600 transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h2 className="font-bold text-purple-400 flex items-center gap-2"><DownloadCloud className="w-4 h-4"/> Terima File Langsung</h2>
            <p className="text-xs text-slate-400">Menerima dari perangkat lain</p>
          </div>
        </header>

        <div className="flex-1 p-6 flex flex-col items-center justify-center">
            {receiveStatus !== 'connected' ? (
                <div className="max-w-xs w-full bg-slate-800 p-8 rounded-3xl border border-slate-700 shadow-2xl">
                    <div className="w-16 h-16 bg-purple-500/20 rounded-2xl flex items-center justify-center mx-auto mb-6 border border-purple-500/50">
                        <DownloadCloud className="w-8 h-8 text-purple-400" />
                    </div>
                    <h3 className="text-xl font-bold text-center mb-6">Hubungkan ke Pengirim</h3>
                    <input
                        type="text"
                        maxLength={6}
                        value={remoteId}
                        onChange={(e) => setRemoteId(e.target.value.toUpperCase())}
                        className="w-full bg-slate-900 border-2 border-slate-700 text-white text-center text-3xl font-black tracking-[0.2em] py-4 rounded-xl focus:border-purple-500 focus:outline-none transition-colors mb-6 uppercase"
                        placeholder="------"
                    />
                    <Button3D color="purple" className="w-full" onClick={connectToSender} disabled={receiveStatus === 'connecting'}>
                        {receiveStatus === 'connecting' ? 'Menghubungkan...' : 'Hubungkan'}
                    </Button3D>
                </div>
            ) : (
                <div className="max-w-xs w-full space-y-6">
                    <div className="bg-slate-800 p-6 rounded-3xl border border-slate-700 shadow-xl text-center">
                        <span className="relative flex h-16 w-16 mx-auto mb-4">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-purple-400 opacity-50"></span>
                            <span className="relative inline-flex rounded-full h-16 w-16 bg-purple-500/20 flex items-center justify-center border border-purple-500/50">
                                <Zap className="w-8 h-8 text-purple-400" />
                            </span>
                        </span>
                        <h3 className="text-lg font-bold text-white mb-1">Menunggu Kiriman...</h3>
                        <p className="text-xs text-slate-400">File yang dikirim akan otomatis diunduh.</p>
                    </div>

                    {receivedFiles.length > 0 && (
                        <div className="bg-slate-800/50 p-4 rounded-2xl border border-slate-700">
                            <h4 className="text-sm font-bold text-slate-300 mb-3 border-b border-slate-700 pb-2">Riwayat Unduhan:</h4>
                            <div className="space-y-2 max-h-40 overflow-y-auto no-scrollbar">
                                {receivedFiles.map((fname, i) => (
                                    <div key={i} className="flex items-center gap-2 text-sm bg-slate-900 p-2 rounded-lg text-emerald-400">
                                        <CheckCircle className="w-4 h-4 flex-shrink-0" />
                                        <span className="truncate">{fname}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
        {toast && (
          <div className="fixed bottom-10 left-1/2 transform -translate-x-1/2 bg-slate-800 text-white px-6 py-3 rounded-full shadow-2xl z-50 text-sm font-medium">{toast}</div>
        )}
      </div>
    );
  }

  return null;
}