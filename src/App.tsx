import React, { useState, useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { motion, AnimatePresence } from 'motion/react';
import { Music, Send, Users, Play, RotateCcw, Loader2, Smile, MessageSquare } from 'lucide-react';

interface MoodEntry {
  id: string;
  user: string;
  mood: string;
}

interface AppState {
  moods: MoodEntry[];
  isDone: boolean;
  suggestedSong: {
    title: string;
    artist: string;
    reason: string;
    youtubeId: string;
  } | null;
}

export default function App() {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [state, setState] = useState<AppState>({ moods: [], isDone: false, suggestedSong: null });
  const [userName, setUserName] = useState('');
  const [moodInput, setMoodInput] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [hasJoined, setHasJoined] = useState(false);
  
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const newSocket = io({
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 5
    });
    setSocket(newSocket);

    newSocket.on('state-update', (newState: AppState) => {
      setState(newState);
    });

    return () => {
      newSocket.close();
    };
  }, []);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [state.moods]);

  const handleJoin = (e: React.FormEvent) => {
    e.preventDefault();
    if (userName.trim()) {
      setHasJoined(true);
    }
  };

  const submitMood = (e: React.FormEvent) => {
    e.preventDefault();
    if (moodInput.trim() && socket) {
      socket.emit('add-mood', { user: userName, mood: moodInput });
      setMoodInput('');
    }
  };

  const generateSong = async () => {
    if (state.moods.length === 0) return;
    
    setIsGenerating(true);
    try {
      const response = await fetch('/api/generate-song', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ moods: state.moods }),
      });

      if (!response.ok) {
        throw new Error('Failed to generate song');
      }

      const songData = await response.json();
      if (socket) {
        socket.emit('set-done', songData);
      }
    } catch (error) {
      console.error("Error generating song:", error);
      // Fallback in case of error
      if (socket) {
        socket.emit('set-done', {
          title: "Happy",
          artist: "Pharrell Williams",
          reason: "Something went wrong, but let's stay happy!",
          youtubeId: "ZbZSe6N_BXs"
        });
      }
    } finally {
      setIsGenerating(false);
    }
  };

  const resetSession = () => {
    if (socket) {
      socket.emit('reset');
    }
  };

  if (!hasJoined) {
    return (
      <div className="min-h-screen bg-[#E4E3E0] flex items-center justify-center p-6 font-sans">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md bg-white p-8 rounded-2xl shadow-xl border border-black/5"
        >
          <div className="flex flex-col items-center mb-8">
            <div className="w-16 h-16 bg-black rounded-full flex items-center justify-center mb-4">
              <Users className="text-white w-8 h-8" />
            </div>
            <h1 className="text-3xl font-bold tracking-tight text-gray-900 italic serif">Team Mood Jukebox</h1>
            <p className="text-gray-500 text-center mt-2">Connect with your team and find your collective rhythm.</p>
          </div>

          <form onSubmit={handleJoin} className="space-y-4">
            <div>
              <label className="block text-xs font-mono uppercase tracking-widest text-gray-400 mb-1 ml-1">Your Name</label>
              <input
                type="text"
                value={userName}
                onChange={(e) => setUserName(e.target.value)}
                placeholder="Enter your name..."
                className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-black focus:border-transparent transition-all outline-none"
                required
              />
            </div>
            <button
              type="submit"
              className="w-full bg-black text-white py-3 rounded-xl font-medium hover:bg-gray-800 transition-colors flex items-center justify-center gap-2"
            >
              Join Session
            </button>
          </form>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#E4E3E0] font-sans text-gray-900">
      <div className="max-w-4xl mx-auto p-4 md:p-8">
        <header className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
          <div>
            <h1 className="text-4xl font-bold tracking-tighter italic serif">Team Mood Jukebox</h1>
            <div className="flex items-center gap-2 mt-1">
              <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
              <span className="text-xs font-mono text-gray-500 uppercase tracking-widest">Live Session • {userName}</span>
            </div>
          </div>
          
          <div className="flex gap-2">
            <button 
              onClick={resetSession}
              className="p-2 rounded-full hover:bg-white/50 transition-colors text-gray-500"
              title="Reset Session"
            >
              <RotateCcw size={20} />
            </button>
          </div>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column: Mood Feed */}
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white rounded-3xl shadow-sm border border-black/5 overflow-hidden flex flex-col h-[500px]">
              <div className="p-4 border-bottom border-gray-100 flex items-center justify-between bg-gray-50/50">
                <span className="text-xs font-mono uppercase tracking-widest text-gray-400">Mood Stream</span>
                <span className="text-xs font-mono text-gray-400">{state.moods.length} entries</span>
              </div>
              
              <div ref={scrollRef} className="flex-1 overflow-y-auto p-6 space-y-4">
                <AnimatePresence initial={false}>
                  {state.moods.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-gray-400 space-y-2 opacity-50">
                      <MessageSquare size={48} strokeWidth={1} />
                      <p className="text-sm italic">Waiting for the first mood...</p>
                    </div>
                  ) : (
                    state.moods.map((entry) => (
                      <motion.div
                        key={entry.id}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        className={`flex flex-col ${entry.user === userName ? 'items-end' : 'items-start'}`}
                      >
                        <span className="text-[10px] font-mono uppercase text-gray-400 mb-1 px-2">
                          {entry.user}
                        </span>
                        <div className={`max-w-[80%] px-4 py-2 rounded-2xl ${
                          entry.user === userName 
                            ? 'bg-black text-white rounded-tr-none' 
                            : 'bg-gray-100 text-gray-800 rounded-tl-none'
                        }`}>
                          {entry.mood}
                        </div>
                      </motion.div>
                    ))
                  )}
                </AnimatePresence>
              </div>

              {!state.isDone && (
                <form onSubmit={submitMood} className="p-4 bg-white border-t border-gray-100 flex gap-2">
                  <input
                    type="text"
                    value={moodInput}
                    onChange={(e) => setMoodInput(e.target.value)}
                    placeholder="How are you feeling?"
                    className="flex-1 px-4 py-2 rounded-xl bg-gray-50 border-transparent focus:bg-white focus:ring-2 focus:ring-black transition-all outline-none text-sm"
                  />
                  <button
                    type="submit"
                    disabled={!moodInput.trim()}
                    className="p-2 bg-black text-white rounded-xl disabled:opacity-30 transition-opacity"
                  >
                    <Send size={18} />
                  </button>
                </form>
              )}
            </div>
          </div>

          {/* Right Column: Controls & Result */}
          <div className="space-y-6">
            <div className="bg-white p-6 rounded-3xl shadow-sm border border-black/5">
              <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
                <Music size={20} />
                Team Jukebox
              </h2>
              
              {!state.isDone ? (
                <div className="space-y-4">
                  <p className="text-sm text-gray-500 leading-relaxed">
                    Once everyone has shared their mood, click the button below to let the AI find a song that represents the team.
                  </p>
                  <button
                    onClick={generateSong}
                    disabled={state.moods.length === 0 || isGenerating}
                    className="w-full bg-black text-white py-4 rounded-2xl font-bold tracking-tight hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 disabled:hover:scale-100 flex items-center justify-center gap-2"
                  >
                    {isGenerating ? (
                      <>
                        <Loader2 className="animate-spin" size={20} />
                        Analyzing Vibes...
                      </>
                    ) : (
                      <>
                        <Play size={20} fill="currentColor" />
                        Find Our Song
                      </>
                    )}
                  </button>
                </div>
              ) : (
                <motion.div 
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="space-y-4"
                >
                  <div className="aspect-video bg-gray-900 rounded-2xl overflow-hidden relative group">
                    <iframe
                      width="100%"
                      height="100%"
                      src={`https://www.youtube.com/embed/${state.suggestedSong?.youtubeId}?autoplay=1&mute=0&origin=${window.location.origin}&enablejsapi=1`}
                      title="YouTube video player"
                      frameBorder="0"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                      allowFullScreen
                      referrerPolicy="no-referrer-when-downgrade"
                    ></iframe>
                  </div>
                  
                  <div className="pt-2">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <h3 className="text-xl font-bold italic serif leading-tight">{state.suggestedSong?.title}</h3>
                      <a 
                        href={`https://www.youtube.com/watch?v=${state.suggestedSong?.youtubeId}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[10px] font-mono uppercase tracking-widest text-gray-400 hover:text-black flex items-center gap-1 shrink-0"
                      >
                        Open on YouTube <Play size={8} />
                      </a>
                    </div>
                    <p className="text-gray-500 font-medium">{state.suggestedSong?.artist}</p>
                    <div className="mt-4 p-4 bg-gray-50 rounded-2xl border border-gray-100">
                      <p className="text-xs text-gray-400 font-mono uppercase tracking-widest mb-2">Why this song?</p>
                      <p className="text-sm text-gray-600 italic leading-relaxed">
                        "{state.suggestedSong?.reason}"
                      </p>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={generateSong}
                      disabled={isGenerating}
                      className="flex-1 py-3 rounded-2xl bg-black text-white text-sm font-bold hover:bg-gray-800 transition-colors flex items-center justify-center gap-2"
                    >
                      {isGenerating ? <Loader2 className="animate-spin" size={16} /> : <RotateCcw size={16} />}
                      Try Another Song
                    </button>
                    <button
                      onClick={resetSession}
                      className="px-6 py-3 rounded-2xl border border-gray-200 text-gray-500 text-sm font-medium hover:bg-gray-50 transition-colors"
                    >
                      Reset
                    </button>
                  </div>
                </motion.div>
              )}
            </div>

            <div className="bg-black text-white p-6 rounded-3xl shadow-xl">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-white/10 rounded-full flex items-center justify-center">
                  <Smile className="text-emerald-400" size={20} />
                </div>
                <div>
                  <p className="text-xs font-mono uppercase tracking-widest text-white/40">Active Team</p>
                  <p className="text-sm font-bold">{Array.from(new Set(state.moods.map(m => m.user))).length} Members</p>
                </div>
              </div>
              <div className="flex -space-x-2 overflow-hidden">
                {(Array.from(new Set(state.moods.map(m => m.user))) as string[]).slice(0, 5).map((user, i) => (
                  <div key={i} className="inline-block h-8 w-8 rounded-full ring-2 ring-black bg-gray-800 flex items-center justify-center text-[10px] font-bold">
                    {user.charAt(0).toUpperCase()}
                  </div>
                ))}
                {Array.from(new Set(state.moods.map(m => m.user))).length > 5 && (
                  <div className="inline-block h-8 w-8 rounded-full ring-2 ring-black bg-gray-700 flex items-center justify-center text-[10px] font-bold">
                    +{Array.from(new Set(state.moods.map(m => m.user))).length - 5}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
