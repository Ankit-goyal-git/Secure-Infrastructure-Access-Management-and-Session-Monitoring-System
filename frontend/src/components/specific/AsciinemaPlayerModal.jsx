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

  const terminalRef = useRef(null);
  const animFrameRef = useRef(null);
  const lastTickRef = useRef(null);

  // Generate fallback demo events if session recording is not yet uploaded
  const generateSampleEvents = (sess) => {
    const userStr = sess?.user_id || 'employee';
    const srvStr = sess?.server_id || 'demo-server';
    return [
      [0.0, 'o', `\x1b[32mAntigravity Secure Infrastructure Gateway\x1b[0m\r\n`],
      [0.3, 'o', `Connecting to target server: \x1b[36m${srvStr}\x1b[0m as \x1b[33m${userStr}\x1b[0m...\r\n`],
      [0.8, 'o', `Authenticated via dynamic Zero-Trust JIT grant.\r\n\r\n`],
      [1.2, 'o', `${userStr}@${srvStr}:~$ `],
      [1.8, 'i', 'u'],
      [1.9, 'o', 'u'],
      [2.0, 'i', 'n'],
      [2.1, 'o', 'n'],
      [2.2, 'i', 'a'],
      [2.3, 'o', 'a'],
      [2.4, 'i', 'm'],
      [2.5, 'o', 'm'],
      [2.6, 'i', 'e'],
      [2.7, 'o', 'e'],
      [2.8, 'i', ' '],
      [2.9, 'o', ' '],
      [3.0, 'i', '-'],
      [3.1, 'o', '-'],
      [3.2, 'i', 'a'],
      [3.3, 'o', 'a'],
      [3.6, 'i', '\r'],
      [3.7, 'o', '\r\nLinux demo-target 5.15.0-generic #72-Ubuntu SMP x86_64 GNU/Linux\r\n'],
      [4.2, 'o', `${userStr}@${srvStr}:~$ `],
      [5.0, 'i', 'l'],
      [5.1, 'o', 'l'],
      [5.2, 'i', 's'],
      [5.3, 'o', 's'],
      [5.4, 'i', ' '],
      [5.5, 'o', ' '],
      [5.6, 'i', '-'],
      [5.7, 'o', '-'],
      [5.8, 'i', 'l'],
      [5.9, 'o', 'l'],
      [6.0, 'i', 'a'],
      [6.1, 'o', 'a'],
      [6.4, 'i', '\r'],
      [6.5, 'o', '\r\ntotal 28\r\ndrwxr-xr-x 4 employee employee 4096 Oct 22 13:45 .\r\ndrwxr-xr-x 3 root     root     4096 Oct 22 13:30 ..\r\n-rw-r--r-- 1 employee employee  220 Oct 22 13:30 .bash_logout\r\n-rw-r--r-- 1 employee employee 3771 Oct 22 13:30 .bashrc\r\n-rw-r--r-- 1 employee employee  807 Oct 22 13:30 .profile\r\ndrwx------ 2 employee employee 4096 Oct 22 13:45 .ssh\r\n-rw-rw-r-- 1 employee employee  142 Oct 22 13:50 deployment.log\r\n'],
      [7.2, 'o', `${userStr}@${srvStr}:~$ `],
      [8.0, 'i', 'c'],
      [8.1, 'o', 'c'],
      [8.2, 'i', 'a'],
      [8.3, 'o', 'a'],
      [8.4, 'i', 't'],
      [8.5, 'o', 't'],
      [8.6, 'i', ' '],
      [8.7, 'o', ' '],
      [8.8, 'i', 'd'],
      [8.9, 'o', 'd'],
      [9.0, 'i', 'e'],
      [9.1, 'o', 'e'],
      [9.2, 'i', 'p'],
      [9.3, 'o', 'p'],
      [9.4, 'i', 'l'],
      [9.5, 'o', 'l'],
      [9.6, 'i', 'o'],
      [9.7, 'o', 'o'],
      [9.8, 'i', 'y'],
      [9.9, 'o', 'y'],
      [10.0, 'i', 'm'],
      [10.1, 'o', 'm'],
      [10.2, 'i', 'e'],
      [10.3, 'o', 'e'],
      [10.4, 'i', 'n'],
      [10.5, 'o', 'n'],
      [10.6, 'i', 't'],
      [10.7, 'o', 't'],
      [10.8, 'i', '.'],
      [10.9, 'o', '.'],
      [11.0, 'i', 'l'],
      [11.1, 'o', 'l'],
      [11.2, 'i', 'o'],
      [11.3, 'o', 'o'],
      [11.4, 'i', 'g'],
      [11.5, 'o', 'g'],
      [11.8, 'i', '\r'],
      [11.9, 'o', '\r\n[2026-10-22 13:50:01] Service status: HEALTHY\r\n[2026-10-22 13:50:02] Database connection pool: ACTIVE\r\n[2026-10-22 13:50:03] JIT session established with gateway audit enabled.\r\n'],
      [12.8, 'o', `${userStr}@${srvStr}:~$ `],
      [13.5, 'i', 'e'],
      [13.6, 'o', 'e'],
      [13.7, 'i', 'x'],
      [13.8, 'o', 'x'],
      [13.9, 'i', 'i'],
      [14.0, 'o', 'i'],
      [14.1, 'i', 't'],
      [14.2, 'o', 't'],
      [14.5, 'i', '\r'],
      [14.6, 'o', '\r\nlogout\r\nConnection to target server closed.\r\n'],
    ];
  };

  // Load session recording
  useEffect(() => {
    if (!isOpen || !session) return;

    setIsLoading(true);
    setError(null);
    setCurrentTime(0);
    setIsPlaying(false);
    setTerminalOutput('');

    const sid = session.session_id || session.id;

    const fetchRecording = async () => {
      try {
        if (sid) {
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
            } catch (pErr) {
              // Skip malformed line
            }
          }

          if (parsedEvents.length > 0) {
            setEvents(parsedEvents);
            const maxT = parsedEvents[parsedEvents.length - 1][0];
            setTotalDuration(Math.max(maxT, 1));
            setIsLoading(false);
            setIsPlaying(true);
            return;
          } else {
            setError(`Recording file for session ${sid} contains no keystroke events.`);
            setIsLoading(false);
            return;
          }
        } else {
          setError('No session ID associated with this audit log event.');
          setIsLoading(false);
          return;
        }
      } catch (err) {
        console.warn('Failed to load recording file from backend:', err);
        setError(`Recording for session "${sid}" was not found on the server.`);
        setIsLoading(false);
      }
    };

    fetchRecording();
  }, [isOpen, session]);

  // Clean ANSI colors and control codes for clean rendering
  const parseAnsiToText = (rawStr) => {
    // Strip standard ANSI sequences for plain rendering
    return rawStr.replace(/\x1b\[[0-9;]*[a-zA-Z]/g, '');
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

  const formatTime = (secs) => {
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m < 10 ? '0' : ''}${m}:${s < 10 ? '0' : ''}${s}`;
  };

  if (!isOpen) return null;

  const sid = session?.session_id || session?.id || 'Unknown';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md transition-all">
      <div className="relative w-full max-w-4xl bg-slate-900 border border-slate-700 rounded-xl shadow-2xl overflow-hidden flex flex-col">
        {/* Terminal Header */}
        <div className="flex items-center justify-between px-4 py-3 bg-slate-950 border-b border-slate-800 select-none">
          <div className="flex items-center space-x-2">
            <span className="w-3 h-3 rounded-full bg-red-500/80 inline-block"></span>
            <span className="w-3 h-3 rounded-full bg-amber-500/80 inline-block"></span>
            <span className="w-3 h-3 rounded-full bg-emerald-500/80 inline-block"></span>
            <span className="ml-3 font-mono text-xs text-slate-400">
              Session Replay: <span className="text-slate-200 font-semibold">{String(sid).slice(0, 12)}...</span>
            </span>
          </div>

          <div className="flex items-center space-x-3">
            <span className="px-2 py-0.5 rounded text-[11px] font-mono uppercase bg-blue-500/10 text-blue-400 border border-blue-500/20">
              Asciicast v2
            </span>
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-white transition p-1 hover:bg-slate-800 rounded"
              title="Close Player"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Terminal Screen */}
        <div
          ref={terminalRef}
          className="p-5 font-mono text-sm leading-relaxed text-emerald-400 bg-black/95 min-h-[380px] max-h-[460px] overflow-y-auto whitespace-pre-wrap select-text scrollbar-thin scrollbar-thumb-slate-700"
        >
          {isLoading ? (
            <div className="flex items-center justify-center h-64 text-slate-500">
              <span className="animate-spin inline-block mr-3">⟳</span>
              Loading keystroke playback...
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center h-64 text-slate-400 space-y-3">
              <div className="text-amber-400 text-sm font-semibold flex items-center gap-2">
                <span>⚠️</span>
                <span>{error}</span>
              </div>
              <p className="text-xs text-slate-500 max-w-md text-center">
                Keystroke recordings are created when an employee connects via SSH, executes commands, and closes the session.
              </p>
              <button
                type="button"
                onClick={() => {
                  setError(null);
                  const sample = generateSampleEvents(session);
                  setEvents(sample);
                  setTotalDuration(sample[sample.length - 1][0]);
                  setIsPlaying(true);
                }}
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs rounded border border-slate-700 transition"
              >
                Preview Simulated Demo (14s)
              </button>
            </div>
          ) : terminalOutput ? (
            <>
              {terminalOutput}
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
              className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
            />
            <span className="font-mono text-xs text-slate-400 min-w-[42px]">{formatTime(totalDuration)}</span>
          </div>

          {/* Action Buttons & Speed Toggle */}
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <button
                onClick={handleTogglePlay}
                className="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white font-medium text-xs rounded-md shadow-md shadow-blue-900/30 flex items-center space-x-1.5 transition"
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

              <button
                onClick={handleRestart}
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs rounded-md border border-slate-700 flex items-center space-x-1 transition"
                title="Restart from beginning"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                <span>Replay</span>
              </button>
            </div>

            <div className="flex items-center space-x-2">
              <span className="text-xs text-slate-400">Speed:</span>
              {[1, 2, 4].map((spd) => (
                <button
                  key={spd}
                  onClick={() => setPlaybackSpeed(spd)}
                  className={`px-2 py-0.5 rounded text-xs font-mono font-medium transition ${
                    playbackSpeed === spd
                      ? 'bg-blue-600 text-white'
                      : 'bg-slate-800 text-slate-400 hover:text-white'
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
