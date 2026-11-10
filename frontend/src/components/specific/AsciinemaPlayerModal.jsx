import React, { useState, useEffect, useRef } from 'react';
import axiosClient from '../../api/axiosClient';

export default function AsciinemaPlayerModal({ session, isOpen, onClose }) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [totalDuration, setTotalDuration] = useState(0);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [events, setEvents] = useState([]);
  const [terminalOutput, setTerminalOutput] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isCopied, setIsCopied] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isFullscreen, setIsFullscreen] = useState(false);

  const terminalRef = useRef(null);
  const animFrameRef = useRef(null);
  const lastTickRef = useRef(null);

  const sid = session?.session_id || session?.id;

  const fetchRecording = async () => {
    if (!sid) {
      setError('No session ID associated with this audit log event.');
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);
    setCurrentTime(0);
    setIsPlaying(false);
    setTerminalOutput('');

    try {
      const res = await axiosClient.get(`/audit/sessions/${sid}/recording`);
      const text = typeof res.data === 'string' ? res.data : JSON.stringify(res.data);
      const lines = text.trim().split('\n');

      const parsedEvents = [];
      for (let i = 1; i < lines.length; i++) {
        try {
          const ev = JSON.parse(lines[i]);
          if (Array.isArray(ev) && ev.length >= 3) {
            parsedEvents.push(ev);
          }
        } catch {
          // Skip malformed line
        }
      }

      if (parsedEvents.length > 0) {
        setEvents(parsedEvents);
        const maxT = parsedEvents[parsedEvents.length - 1][0];
        setTotalDuration(Math.max(maxT, 1));
        setIsLoading(false);
        setIsPlaying(true);
      } else {
        setError(`Recording for session ${String(sid).slice(0, 8)} contains no keystroke events.`);
        setIsLoading(false);
      }
    } catch (err) {
      console.warn('Failed to load recording file from backend:', err);
      setError(`Recording for session "${String(sid).slice(0, 8)}..." is not yet ready or was not found.`);
      setIsLoading(false);
    }
  };

  // Load session recording when modal opens
  useEffect(() => {
    if (!isOpen || !session) return;
    fetchRecording();
  }, [isOpen, session]);

  // Clean ANSI colors and control codes for clean rendering
  const parseAnsiToText = (rawStr) => {
    let clean = rawStr.replace(/\x1b(?:[@-Z\\-_]|\[[0-?]*[ -/]*[@-~])/g, '');
    clean = clean.replace(/\r\n/g, '\n');
    return clean;
  };

  // Render terminal output up to target time
  const renderUpToTime = (targetTime) => {
    let output = '';
    for (const [t, type, data] of events) {
      if (t <= targetTime) {
        if (type === 'o') {
          output += data;
        }
      } else {
        break;
      }
    }
    setTerminalOutput(parseAnsiToText(output));
  };

  // Animation frame ticker for smooth playback
  useEffect(() => {
    if (!isPlaying) {
      lastTickRef.current = null;
      return;
    }

    const tick = (now) => {
      if (lastTickRef.current !== null) {
        const delta = (now - lastTickRef.current) / 1000;
        setCurrentTime((prevTime) => {
          const nextTime = prevTime + delta * playbackSpeed;
          if (nextTime >= totalDuration) {
            setIsPlaying(false);
            renderUpToTime(totalDuration);
            return totalDuration;
          }
          renderUpToTime(nextTime);
          return nextTime;
        });
      }
      lastTickRef.current = now;
      animFrameRef.current = requestAnimationFrame(tick);
    };

    animFrameRef.current = requestAnimationFrame(tick);

    return () => {
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
      }
    };
  }, [isPlaying, totalDuration, playbackSpeed, events]);

  // Auto scroll terminal to bottom
  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  }, [terminalOutput]);

  const handleSeek = (e) => {
    const seekTime = parseFloat(e.target.value);
    setCurrentTime(seekTime);
    renderUpToTime(seekTime);
  };

  const handleJump = (delta) => {
    const newT = Math.max(0, Math.min(totalDuration, currentTime + delta));
    setCurrentTime(newT);
    renderUpToTime(newT);
  };

  const handleTogglePlay = () => {
    if (currentTime >= totalDuration) {
      setCurrentTime(0);
      renderUpToTime(0);
      setIsPlaying(true);
    } else {
      setIsPlaying(!isPlaying);
    }
  };

  const handleRestart = () => {
    setCurrentTime(0);
    renderUpToTime(0);
    setIsPlaying(true);
  };

  const handleCopyOutput = () => {
    if (!terminalOutput) return;
    navigator.clipboard.writeText(terminalOutput);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  const formatTime = (secs) => {
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m < 10 ? '0' : ''}${m}:${s < 10 ? '0' : ''}${s}`;
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md transition-all">
      <div
        className={`relative w-full bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl overflow-hidden flex flex-col transition-all ${
          isFullscreen ? 'max-w-6xl h-[90vh]' : 'max-w-4xl max-h-[85vh]'
        }`}
      >
        {/* Terminal Header */}
        <div className="flex items-center justify-between px-4 py-3 bg-slate-950 border-b border-slate-800 select-none">
          <div className="flex items-center space-x-2">
            <span className="w-3 h-3 rounded-full bg-red-500/80 inline-block"></span>
            <span className="w-3 h-3 rounded-full bg-amber-500/80 inline-block"></span>
            <span className="w-3 h-3 rounded-full bg-emerald-500/80 inline-block"></span>
            <span className="ml-3 font-mono text-xs text-slate-300">
              Terminal Replay: <span className="text-emerald-400 font-semibold">{session?.user_id || session?.userName || 'Employee'}</span>
              <span className="text-slate-500 mx-1.5">@</span>
              <span className="text-cyan-400 font-semibold">{session?.server_id || session?.serverName || 'target'}</span>
            </span>
            <span className="text-[11px] font-mono text-slate-500 ml-2 hidden sm:inline">
              ({String(sid).slice(0, 8)}...)
            </span>
          </div>

          <div className="flex items-center space-x-2">
            {/* Copy Output Button */}
            <button
              type="button"
              onClick={handleCopyOutput}
              disabled={!terminalOutput}
              className="px-2.5 py-1 rounded text-xs font-mono bg-slate-800 hover:bg-slate-750 disabled:opacity-50 text-slate-300 hover:text-white border border-slate-700 transition cursor-pointer flex items-center gap-1"
              title="Copy terminal session buffer"
            >
              <span>{isCopied ? '✓' : '📋'}</span>
              <span className="hidden sm:inline">{isCopied ? 'Copied' : 'Copy'}</span>
            </button>

            {/* Fullscreen Toggle */}
            <button
              type="button"
              onClick={() => setIsFullscreen(!isFullscreen)}
              className="p-1 text-slate-400 hover:text-white hover:bg-slate-800 rounded transition cursor-pointer"
              title={isFullscreen ? 'Exit Fullscreen' : 'Expand Fullscreen'}
            >
              <span className="text-xs">{isFullscreen ? '🗗' : '🗖'}</span>
            </button>

            <span className="px-2 py-0.5 rounded text-[10px] font-mono uppercase bg-blue-500/10 text-blue-400 border border-blue-500/20 hidden md:inline">
              Asciicast v2
            </span>

            {/* Close Button */}
            <button
              type="button"
              onClick={onClose}
              className="text-slate-400 hover:text-white transition p-1 hover:bg-slate-800 rounded cursor-pointer"
              title="Close Player"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Search in Terminal Filter Bar */}
        <div className="flex items-center justify-between px-4 py-2 bg-slate-950/60 border-b border-slate-800 text-xs">
          <div className="flex items-center gap-2">
            <span className="text-slate-500 text-[11px]">Filter buffer:</span>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="e.g. sudo, cat, docker..."
              className="bg-slate-900 border border-slate-800 rounded px-2 py-0.5 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-blue-500 w-36 sm:w-48"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="text-slate-500 hover:text-white cursor-pointer text-xs"
              >
                ✕
              </button>
            )}
          </div>
          <span className="text-[11px] font-mono text-slate-500">
            {events.length} Keystroke Event{events.length === 1 ? '' : 's'}
          </span>
        </div>

        {/* Terminal Screen */}
        <div
          ref={terminalRef}
          className={`p-5 font-mono text-sm leading-relaxed text-emerald-400 bg-black/95 overflow-y-auto whitespace-pre-wrap select-text scrollbar-thin scrollbar-thumb-slate-700 flex-1 ${
            isFullscreen ? 'min-h-[500px]' : 'min-h-[380px] max-h-[460px]'
          }`}
        >
          {isLoading ? (
            <div className="flex items-center justify-center h-64 text-slate-500">
              <span className="animate-spin inline-block mr-3">⟳</span>
              Loading keystroke playback stream...
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center h-64 text-slate-400 space-y-3 px-6 text-center">
              <div className="text-amber-400 text-sm font-semibold flex items-center gap-2">
                <span>⚠️</span>
                <span>{error}</span>
              </div>
              <p className="text-xs text-slate-400 max-w-md">
                Keystroke recordings are written when the SSH session closes. If this session is still active or was just severed, please wait a moment or click Retry.
              </p>
              <button
                type="button"
                onClick={fetchRecording}
                className="mt-2 px-3.5 py-1.5 bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white text-xs font-medium rounded-lg shadow transition flex items-center gap-1.5 cursor-pointer"
              >
                <span>🔄</span>
                <span>Retry Loading Recording</span>
              </button>
            </div>
          ) : terminalOutput ? (
            <>
              {searchQuery.trim() ? (
                // Highlight search query in output
                terminalOutput.split(new RegExp(`(${searchQuery})`, 'gi')).map((chunk, idx) =>
                  chunk.toLowerCase() === searchQuery.toLowerCase() ? (
                    <mark key={idx} className="bg-amber-400 text-black px-0.5 rounded font-bold">
                      {chunk}
                    </mark>
                  ) : (
                    <span key={idx}>{chunk}</span>
                  )
                )
              ) : (
                terminalOutput
              )}
              {isPlaying && (
                <span className="inline-block w-2 h-4 bg-emerald-400 ml-0.5 align-middle animate-pulse"></span>
              )}
            </>
          ) : (
            <div className="text-slate-600 italic">Ready to play terminal stream. Press Play to begin.</div>
          )}
        </div>

        {/* Player Controls Bar */}
        <div className="p-4 bg-slate-950/90 border-t border-slate-800 space-y-3">
          {/* Progress Timeline Scrubber */}
          <div className="flex items-center space-x-3">
            <span className="font-mono text-xs text-slate-400 min-w-[42px]">{formatTime(currentTime)}</span>
            <input
              type="range"
              min="0"
              max={totalDuration || 1}
              step="0.05"
              value={currentTime}
              onChange={handleSeek}
              className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-blue-500"
            />
            <span className="font-mono text-xs text-slate-400 min-w-[42px]">{formatTime(totalDuration)}</span>
          </div>

          {/* Action Buttons & Speed Toggle */}
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center space-x-2">
              <button
                type="button"
                onClick={handleTogglePlay}
                className="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white font-semibold text-xs rounded-lg shadow-md shadow-blue-900/30 flex items-center space-x-1.5 transition cursor-pointer"
              >
                {isPlaying ? (
                  <>
                    <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" />
                    </svg>
                    <span>Pause</span>
                  </>
                ) : (
                  <>
                    <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M8 5v14l11-7z" />
                    </svg>
                    <span>Play</span>
                  </>
                )}
              </button>

              {/* Jump -5s */}
              <button
                type="button"
                onClick={() => handleJump(-5)}
                className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs rounded-lg border border-slate-700 transition cursor-pointer"
                title="Rewind 5 seconds"
              >
                -5s
              </button>

              {/* Jump +5s */}
              <button
                type="button"
                onClick={() => handleJump(5)}
                className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs rounded-lg border border-slate-700 transition cursor-pointer"
                title="Forward 5 seconds"
              >
                +5s
              </button>

              {/* Replay */}
              <button
                type="button"
                onClick={handleRestart}
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs rounded-lg border border-slate-700 flex items-center space-x-1 transition cursor-pointer"
                title="Restart from beginning"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                <span>Replay</span>
              </button>
            </div>

            {/* Speed Presets */}
            <div className="flex items-center space-x-1.5">
              <span className="text-xs text-slate-400 mr-1">Speed:</span>
              {[0.5, 1, 2, 4].map((spd) => (
                <button
                  key={spd}
                  type="button"
                  onClick={() => setPlaybackSpeed(spd)}
                  className={`px-2 py-0.5 rounded text-xs font-mono font-medium transition cursor-pointer ${
                    playbackSpeed === spd
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'bg-slate-800 text-slate-400 hover:text-white border border-slate-700/60'
                  }`}
                >
                  {spd}x
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
