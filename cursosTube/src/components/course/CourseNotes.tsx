import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Clock,
  Save,
  Check,
  Copy,
  Download,
  Edit3
} from 'lucide-react';
import { formatSeconds } from '../../services/youtube';

interface CourseNotesProps {
  courseTitle: string;
  videoId: string;
  videoTitle: string;
  videoNotes: string;
  overallCourseNotes: string;
  currentVideoTimeSeconds: number;
  onSaveVideoNotes: (videoId: string, notes: string) => void;
  onSaveCourseNotes: (notes: string) => void;
  onSeekToTime: (seconds: number) => void;
}

export const CourseNotes: React.FC<CourseNotesProps> = ({
  courseTitle,
  videoId,
  videoTitle,
  videoNotes,
  overallCourseNotes,
  currentVideoTimeSeconds,
  onSaveVideoNotes,
  onSaveCourseNotes,
  onSeekToTime,
}) => {
  const [activeTab, setActiveTab] = useState<'video' | 'course'>('video');
  const [currentText, setCurrentText] = useState(videoNotes || '');
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving'>('saved');
  const [copied, setCopied] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Track the context (video/tab) whose notes are being edited + latest text,
  // so we can flush pending text when the user switches context quickly.
  const activeContextRef = useRef({ videoId, activeTab });
  const textRef = useRef(currentText);
  textRef.current = currentText;

  // Sync state when switching video or tab.
  // IMPORTANT: flush any pending (unsaved) text to the PREVIOUS context before
  // loading the new one; otherwise the 500ms debounced save gets cancelled and
  // the text the user just typed would be lost.
  useEffect(() => {
    const prev = activeContextRef.current;
    const isNewContext = prev.videoId !== videoId || prev.activeTab !== activeTab;

    if (isNewContext) {
      const pendingText = textRef.current;
      if (prev.activeTab === 'video') {
        onSaveVideoNotes(prev.videoId, pendingText);
      } else {
        onSaveCourseNotes(pendingText);
      }
      activeContextRef.current = { videoId, activeTab };
    }

    if (activeTab === 'video') {
      setCurrentText(videoNotes || '');
    } else {
      setCurrentText(overallCourseNotes || '');
    }
    setSaveStatus('saved');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [videoId, activeTab]);

  // Debounced auto-save
  useEffect(() => {
    setSaveStatus('saving');
    const timer = setTimeout(() => {
      if (activeTab === 'video') {
        onSaveVideoNotes(videoId, currentText);
      } else {
        onSaveCourseNotes(currentText);
      }
      setSaveStatus('saved');
    }, 500);

    return () => clearTimeout(timer);
  }, [currentText, activeTab, videoId, onSaveVideoNotes, onSaveCourseNotes]);

  // Insert current timestamp into the note at cursor position
  const handleInsertTimestamp = () => {
    const formatted = formatSeconds(Math.floor(currentVideoTimeSeconds));
    const timestampTag = `[${formatted}] `;

    const textarea = textareaRef.current;
    if (textarea) {
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const text = currentText;
      const newText = text.substring(0, start) + timestampTag + text.substring(end);
      setCurrentText(newText);

      setTimeout(() => {
        textarea.focus();
        textarea.setSelectionRange(start + timestampTag.length, start + timestampTag.length);
      }, 0);
    } else {
      setCurrentText((prev) => prev + `\n${timestampTag}`);
    }
  };

  // Find all timestamps in the note to display as quick jump links
  const extractedTimestamps = useMemo(() => {
    const regex = /\[?(\d{1,2}:\d{2}(?::\d{2})?)\]?/g;
    const matches: { text: string; seconds: number }[] = [];
    let match;

    while ((match = regex.exec(currentText)) !== null) {
      const timeStr = match[1];
      const parts = timeStr.split(':').map(Number);
      let secs = 0;
      if (parts.length === 3) {
        secs = parts[0] * 3600 + parts[1] * 60 + parts[2];
      } else if (parts.length === 2) {
        secs = parts[0] * 60 + parts[1];
      }
      if (!matches.some((m) => m.text === timeStr)) {
        matches.push({ text: timeStr, seconds: secs });
      }
    }
    return matches;
  }, [currentText]);

  // Copy notes to clipboard
  const handleCopy = () => {
    navigator.clipboard.writeText(currentText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Download notes file
  const handleDownload = () => {
    const header = `# Notas de: ${activeTab === 'video' ? videoTitle : courseTitle}\nFecha: ${new Date().toLocaleDateString()}\n\n---\n\n`;
    const fullContent = header + currentText;

    const blob = new Blob([fullContent], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `apuntes_${(activeTab === 'video' ? videoTitle : courseTitle).replace(/[^a-zA-Z0-9]/g, '_')}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex flex-col rounded-2xl bg-surface border border-line shadow-sm overflow-hidden h-full">
      {/* Header & Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 border-b border-line bg-surface-2/70">
        {/* Title & Tabs */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 font-bold text-xs text-fg">
            <Edit3 className="w-3.5 h-3.5 text-sky-800" />
            <span>Notas</span>
          </div>

          <div className="inline-flex rounded-lg bg-line p-0.5 text-[11px] font-medium">
            <button
              onClick={() => setActiveTab('video')}
              className={`px-2.5 py-1 rounded-md transition-colors ${
                activeTab === 'video'
                  ? 'bg-btn text-white shadow-xs'
                  : 'text-fg-soft hover:text-fg'
              }`}
            >
              Esta clase
            </button>
            <button
              onClick={() => setActiveTab('course')}
              className={`px-2.5 py-1 rounded-md transition-colors ${
                activeTab === 'course'
                  ? 'bg-btn text-white shadow-xs'
                  : 'text-fg-soft hover:text-fg'
              }`}
            >
              Curso completo
            </button>
          </div>
        </div>

        {/* Action Toolbar */}
        <div className="flex items-center gap-1.5">
          {/* Insert timestamp button */}
          {activeTab === 'video' && (
            <button
              type="button"
              onClick={handleInsertTimestamp}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-btn hover:bg-btn-hover text-white text-[11px] font-semibold transition-all shadow-xs active:scale-95"
              title="Insertar minuto actual del video en los apuntes"
            >
              <Clock className="w-3 h-3 text-sky-300" />
              <span>+ [{formatSeconds(Math.floor(currentVideoTimeSeconds))}]</span>
            </button>
          )}

          {/* Copy button */}
          <button
            onClick={handleCopy}
            className="p-1.5 rounded-lg bg-surface-2 hover:bg-line text-fg transition-colors"
            title="Copiar notas al portapapeles"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
          </button>

          {/* Download button */}
          <button
            onClick={handleDownload}
            className="p-1.5 rounded-lg bg-surface-2 hover:bg-line text-fg transition-colors"
            title="Descargar notas (.md)"
          >
            <Download className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Main Textarea Area */}
      <div className="p-3 flex-1 flex flex-col min-h-[160px] lg:min-h-[180px] gap-2">
        <textarea
          ref={textareaRef}
          value={currentText}
          onChange={(e) => setCurrentText(e.target.value)}
          placeholder={
            activeTab === 'video'
              ? `Escribe tus apuntes de "${videoTitle}"...\nUsa '+ [00:00]' para guardar minutos clave.`
              : `Notas generales y resumen de todo el curso "${courseTitle}"...`
          }
          className="w-full flex-1 p-3 rounded-xl bg-page border border-line focus:border-fg focus:ring-1 focus:ring-fg text-xs sm:text-sm text-fg placeholder-fg-muted font-mono leading-relaxed outline-none transition-all resize-none min-h-[120px]"
        />

        {/* Quick Timestamps Pill Bar */}
        {extractedTimestamps.length > 0 && activeTab === 'video' && (
          <div className="flex flex-wrap items-center gap-1">
            <span className="text-[10px] font-semibold text-fg-muted mr-1 flex items-center gap-1">
              <Clock className="w-2.5 h-2.5 text-sky-800" />
              Saltar:
            </span>
            {extractedTimestamps.map((ts, idx) => (
              <button
                key={idx}
                onClick={() => onSeekToTime(ts.seconds)}
                className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-md bg-line hover:bg-btn hover:text-white text-fg text-[10px] font-mono font-semibold transition-colors"
                title={`Saltar a ${ts.text}`}
              >
                <span>{ts.text}</span>
              </button>
            ))}
          </div>
        )}

        {/* Footer Status */}
        <div className="flex items-center justify-between text-[11px] text-fg-muted pt-1 border-t border-line/60">
          <span className="flex items-center gap-1">
            {saveStatus === 'saved' ? (
              <>
                <Check className="w-3 h-3 text-emerald-600" />
                <span>Guardado</span>
              </>
            ) : (
              <>
                <Save className="w-3 h-3 text-sky-700 animate-pulse" />
                <span>Guardando...</span>
              </>
            )}
          </span>
          <span>{currentText.length} caracteres</span>
        </div>
      </div>
    </div>
  );
};
