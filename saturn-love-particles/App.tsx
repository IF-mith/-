import React, { useEffect, useRef, useState, useCallback } from 'react';
import { HandTracker } from './services/handTrackingService';
import { HandGesture } from './types';
import { Experience } from './components/Experience';
import { INITIAL_PHRASES } from './constants';
import { generateRomanticPhrases } from './services/geminiService';

const App: React.FC = () => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [gesture, setGesture] = useState<HandGesture>(HandGesture.UNKNOWN);
  const [expansionLevel, setExpansionLevel] = useState(0); // 0 = Closed, 1 = Open
  const [phrases, setPhrases] = useState<string[]>(INITIAL_PHRASES);
  const [currentPhrase, setCurrentPhrase] = useState<string>("");
  const [isCameraReady, setIsCameraReady] = useState(false);
  const [isDebug, setIsDebug] = useState(false);
  const [loadingPhrase, setLoadingPhrase] = useState(false);

  // Animation Loop for Smooth Expansion
  useEffect(() => {
    let animationFrameId: number;

    const animate = () => {
      setExpansionLevel((prev) => {
        let target = 0;
        
        if (gesture === HandGesture.OPEN) target = 1;
        else if (gesture === HandGesture.CLOSED) target = 0;
        else if (gesture === HandGesture.NONE) target = 0.1; // Idle state

        // Smooth Lerp
        const speed = 0.05;
        const diff = target - prev;
        
        if (Math.abs(diff) < 0.001) return target;
        return prev + diff * speed;
      });

      animationFrameId = requestAnimationFrame(animate);
    };

    animate();
    return () => cancelAnimationFrame(animationFrameId);
  }, [gesture]);

  // Phrase Rotation Logic
  useEffect(() => {
    // Only show phrase when fully expanded
    if (expansionLevel > 0.8 && !currentPhrase) {
      const randomIdx = Math.floor(Math.random() * phrases.length);
      setCurrentPhrase(phrases[randomIdx]);
    } else if (expansionLevel < 0.3) {
      setCurrentPhrase("");
    }
  }, [expansionLevel, phrases, currentPhrase]);

  // Initialize Hand Tracker
  useEffect(() => {
    let tracker: HandTracker | null = null;

    if (videoRef.current) {
      tracker = new HandTracker(videoRef.current, (detectedGesture) => {
        setGesture(detectedGesture);
      });
      tracker.start().then(() => setIsCameraReady(true));
    }

    return () => {
      tracker?.stop();
    };
  }, []);

  // Gemini Integration: Load new phrases
  const loadMorePhrases = useCallback(async () => {
    if(!process.env.API_KEY) return;
    setLoadingPhrase(true);
    const newPhrases = await generateRomanticPhrases(phrases);
    if (newPhrases.length > 0) {
      setPhrases(prev => [...prev, ...newPhrases]);
    }
    setLoadingPhrase(false);
  }, [phrases]);

  // Handle Fullscreen
  const toggleFullScreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen();
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      }
    }
  };

  return (
    <div className="relative w-full h-screen bg-black text-white overflow-hidden font-sans">
      
      {/* Hidden Video for MediaPipe */}
      <video
        ref={videoRef}
        className={`absolute bottom-4 right-4 w-32 h-24 object-cover border-2 border-white/20 rounded-lg z-50 ${isDebug ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
        playsInline
        muted // Muted required for autoplay
      />

      {/* 3D Scene Layer */}
      <Experience expansionLevel={expansionLevel} />

      {/* UI Overlay Layer */}
      <div className="absolute inset-0 z-10 pointer-events-none flex flex-col items-center justify-center">
        
        {/* Main Romantic Phrase */}
        <div 
          className={`transition-all duration-1000 ease-in-out transform ${currentPhrase ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 translate-y-10 scale-95'}`}
        >
          <h1 className="text-3xl md:text-5xl font-serif italic text-center text-transparent bg-clip-text bg-gradient-to-r from-gray-200 via-white to-gray-200 drop-shadow-[0_0_15px_rgba(255,255,255,0.6)] px-4">
            "{currentPhrase}"
          </h1>
        </div>
      </div>

      {/* Controls / HUD */}
      <div className="absolute top-0 left-0 w-full p-6 flex justify-between items-start z-20 pointer-events-auto bg-gradient-to-b from-black/50 to-transparent">
        <div>
           <h2 className="text-xl font-bold tracking-widest text-gray-100 uppercase">Saturn Live</h2>
           <p className="text-xs text-white/50 mt-1">
             {isCameraReady ? "摄像头已就绪 (Camera Active)" : "正在初始化... (Initializing...)"}
           </p>
           <div className="flex items-center gap-2 mt-2">
              <span className={`w-2 h-2 rounded-full ${gesture === HandGesture.OPEN ? 'bg-green-400 shadow-[0_0_8px_rgba(74,222,128,0.8)]' : 'bg-gray-600'}`}></span>
              <span className="text-xs text-white/60">张开 (Expand)</span>
              
              <span className={`w-2 h-2 rounded-full ml-2 ${gesture === HandGesture.CLOSED ? 'bg-red-400 shadow-[0_0_8px_rgba(248,113,113,0.8)]' : 'bg-gray-600'}`}></span>
              <span className="text-xs text-white/60">握拳 (Contract)</span>
           </div>
        </div>

        <div className="flex flex-col gap-2 items-end">
           <button 
             onClick={toggleFullScreen}
             className="bg-white/10 hover:bg-white/20 backdrop-blur-sm border border-white/10 rounded-full p-3 transition-all active:scale-95"
             title="Toggle Fullscreen"
           >
             <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3.75v4.5m0-4.5h4.5m-4.5 0L9 9M3.75 20.25v-4.5m0 4.5h4.5m-4.5 0L9 15M20.25 3.75h-4.5m4.5 0v4.5m0-4.5L15 9m5.25 11.25h-4.5m4.5 0v-4.5m0 4.5L15 15" />
            </svg>
           </button>

           {process.env.API_KEY && (
             <button
               onClick={loadMorePhrases}
               disabled={loadingPhrase}
               className="bg-purple-500/20 hover:bg-purple-500/40 backdrop-blur-sm border border-purple-500/30 text-xs px-4 py-2 rounded-full transition-all flex items-center gap-2 text-white/80"
             >
               {loadingPhrase ? (
                 <span className="animate-spin h-3 w-3 border-2 border-white rounded-full border-t-transparent"></span>
               ) : (
                 <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-3 h-3">
                   <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
                 </svg>
               )}
               生成更多 (AI)
             </button>
           )}

           <button
             onClick={() => setIsDebug(!isDebug)}
             className="text-[10px] text-white/30 hover:text-white mt-4 underline"
           >
             {isDebug ? "隐藏摄像头" : "调试摄像头"}
           </button>
        </div>
      </div>
    </div>
  );
};

export default App;