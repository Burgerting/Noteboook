import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../store/AuthContext';
import { getNoteContent, syncNote } from '../../lib/notesSync';
import type { NoteItem } from '../../lib/notesSync';
import { createFile } from '../../lib/drive';
import { Save, Loader2, Image as ImageIcon, CheckCircle, List, ListOrdered, CheckSquare, Edit3, Eye } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface NoteEditorProps {
  note: NoteItem;
}

const ResizableImage = ({ 
  src, 
  alt, 
  originalUrl,
  updateImageWidth 
}: { 
  src: string, 
  alt?: string, 
  originalUrl: string,
  updateImageWidth: (oldUrl: string, newUrl: string) => void
}) => {
  const [width, setWidth] = useState<number | undefined>(() => {
    const match = originalUrl.match(/#width=(\d+)/);
    return match ? parseInt(match[1], 10) : undefined;
  });
  
  const [isResizing, setIsResizing] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const startX = useRef(0);
  const startWidth = useRef(0);

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
    startX.current = e.clientX;
    startWidth.current = containerRef.current?.offsetWidth || 0;
    
    let finalWidth = startWidth.current;
    
    const handleMouseMove = (e: MouseEvent) => {
      const deltaX = e.clientX - startX.current;
      finalWidth = Math.max(50, startWidth.current + deltaX);
      setWidth(finalWidth);
    };
    
    const handleMouseUp = () => {
      setIsResizing(false);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      
      const baseUrl = originalUrl.split('#')[0];
      const newUrl = `${baseUrl}#width=${Math.round(finalWidth)}`;
      updateImageWidth(originalUrl, newUrl);
    };
    
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  return (
    <div 
      ref={containerRef}
      style={{ 
        position: 'relative', 
        display: 'inline-block', 
        width: width ? `${width}px` : 'auto',
        maxWidth: '100%',
        margin: '0.5rem 0',
        border: isResizing ? '2px dashed var(--accent-primary)' : '2px solid transparent',
        transition: 'border 0.2s'
      }}
    >
      <img 
        src={src} 
        alt={alt} 
        style={{ 
          width: '100%', 
          display: 'block', 
          borderRadius: 'var(--radius-sm)',
          pointerEvents: isResizing ? 'none' : 'auto'
        }} 
      />
      <div 
        onMouseDown={handleMouseDown}
        style={{
          position: 'absolute',
          right: '-6px',
          top: 0,
          bottom: 0,
          width: '12px',
          cursor: 'col-resize',
          zIndex: 10,
          opacity: isResizing ? 1 : 0,
          backgroundColor: 'var(--accent-primary)',
          borderRadius: '4px',
          transition: 'opacity 0.2s',
        }}
        onMouseEnter={(e) => (e.currentTarget.style.opacity = '1')}
        onMouseLeave={(e) => { if (!isResizing) e.currentTarget.style.opacity = '0'; }}
      />
    </div>
  );
};

export default function NoteEditor({ note }: NoteEditorProps) {
  const { token, activeFolderId: folderId } = useAuth();
  
  const [content, setContent] = useState('');
  const [originalContent, setOriginalContent] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [mode, setMode] = useState<'edit' | 'preview'>('preview');
  
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const updateImageWidth = (oldUrl: string, newUrl: string) => {
    setContent((prev) => {
      const updated = prev.split(oldUrl).join(newUrl);
      setTimeout(() => handleSave(updated), 0);
      return updated;
    });
  };

  useEffect(() => {
    let isMounted = true;
    const loadContent = async () => {
      if (!token) return;
      setIsLoading(true);
      try {
        const text = await getNoteContent(token, note.id);
        if (isMounted) {
          setContent(text);
          setOriginalContent(text);
        }
      } catch (e) {
        console.error('Failed to load note content', e);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };
    loadContent();
    return () => { isMounted = false; };
  }, [note.id, token]);

  const handleSave = async (contentToSave = content) => {
    if (!token) return;
    setIsSaving(true);
    setIsSuccess(false);
    
    try {
      const { mergedContent } = await syncNote(token, note.id, originalContent, contentToSave);
      setContent(mergedContent);
      setOriginalContent(mergedContent);
      setIsSuccess(true);
      setTimeout(() => setIsSuccess(false), 3000);
    } catch (e) {
      console.error('Sync failed', e);
      alert('同步筆記失敗，請檢查控制台獲取詳細資訊。');
    } finally {
      setIsSaving(false);
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !token || !folderId) return;
    
    setIsSaving(true);
    try {
      const driveFile = await createFile(token, folderId, file.name, file as any, file.type);
      const imageUrl = `https://drive.google.com/uc?id=${driveFile.id}`;
      const imageMarkdown = `\n![${file.name}](${imageUrl})\n`;
      
      const cursorPosition = textareaRef.current?.selectionStart || content.length;
      const newContent = content.slice(0, cursorPosition) + imageMarkdown + content.slice(cursorPosition);
      
      setContent(newContent);
    } catch (err) {
      console.error(err);
      alert('圖片上傳失敗');
    } finally {
      setIsSaving(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const insertText = (prefix: string) => {
    setMode('edit');
    setTimeout(() => {
      const textarea = textareaRef.current;
      if (!textarea) {
        setContent(content + '\n' + prefix);
        return;
      }
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const before = content.substring(0, start);
      const needsNewline = before.length > 0 && !before.endsWith('\n');
      const actualPrefix = (needsNewline ? '\n' : '') + prefix;
      
      const newContent = before + actualPrefix + content.substring(end);
      setContent(newContent);
      
      setTimeout(() => {
        textarea.focus();
        textarea.setSelectionRange(start + actualPrefix.length, start + actualPrefix.length);
      }, 0);
    }, 50);
  };

  const previewRef = useRef<HTMLDivElement>(null);

  const toggleCheckboxByIndex = (targetIndex: number) => {
    let currentIndex = 0;
    let replaced = false;
    
    // 嚴格限制只能匹配行首 (包含縮排或引言) 的待辦事項，避免算入句子中間的假待辦造成錯位
    const newContent = content.replace(/^(\s*(?:>\s*)*(?:[*+-]|\d+\.)\s+)\[([ xX])\]/gm, (match, p1, p2) => {
      if (currentIndex === targetIndex) {
        replaced = true;
        currentIndex++;
        return p1 + (p2 === ' ' ? '[x]' : '[ ]');
      }
      currentIndex++;
      return match;
    });

    if (replaced) {
      setContent(newContent);
      handleSave(newContent);
    } else {
      console.error('Checkbox replacement failed. Index out of bounds.');
    }
  };

  const handlePaste = async (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    
    for (const item of Array.from(items)) {
      if (item.type.indexOf('image') === 0) {
        e.preventDefault();
        const file = item.getAsFile();
        if (!file || !token || !folderId) return;
        
        setIsSaving(true);
        try {
          const driveFile = await createFile(token, folderId, file.name || 'image.png', file as any, file.type);
          const imageUrl = `https://drive.google.com/uc?id=${driveFile.id}`;
          const imageMarkdown = `\n![${file.name || 'image'}](${imageUrl})\n`;
          
          const cursorPosition = textareaRef.current?.selectionStart || content.length;
          const newContent = content.slice(0, cursorPosition) + imageMarkdown + content.slice(cursorPosition);
          
          setContent(newContent);
          handleSave(newContent);
        } catch (err) {
          console.error(err);
          alert('圖片貼上失敗');
        } finally {
          setIsSaving(false);
        }
        break;
      }
    }
  };

  if (isLoading) {
    return (
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Loader2 className="animate-spin" size={32} color="var(--accent-primary)" />
      </div>
    );
  }

  const isDirty = content !== originalContent;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Header & Toolbar */}
      <div style={{ padding: '1rem', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <h2 style={{ margin: 0, fontSize: '1.25rem' }}>{note.name}</h2>
        
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          
          {/* Mode Switcher */}
          <div style={{ display: 'flex', background: 'rgba(255,255,255,0.05)', borderRadius: 'var(--radius-sm)', padding: '0.25rem', marginRight: '0.5rem' }}>
            <button className={`btn ${mode === 'edit' ? 'btn-primary' : 'btn-ghost'}`} style={{ padding: '0.4rem', fontSize: '0.85rem' }} onClick={() => setMode('edit')} title="編輯模式">
              <Edit3 size={16} /> 編輯
            </button>
            <button className={`btn ${mode === 'preview' ? 'btn-primary' : 'btn-ghost'}`} style={{ padding: '0.4rem', fontSize: '0.85rem' }} onClick={() => setMode('preview')} title="預覽模式">
              <Eye size={16} /> 預覽
            </button>
          </div>

          {/* Formatting Toolbar */}
          <div style={{ display: 'flex', background: 'rgba(255,255,255,0.05)', borderRadius: 'var(--radius-sm)', padding: '0.25rem', marginRight: '0.5rem' }}>
            <button className="btn btn-ghost" style={{ padding: '0.4rem' }} onClick={() => insertText('- ')} title="圓點列表">
              <List size={16} />
            </button>
            <button className="btn btn-ghost" style={{ padding: '0.4rem' }} onClick={() => insertText('1. ')} title="數字列表">
              <ListOrdered size={16} />
            </button>
            <button className="btn btn-ghost" style={{ padding: '0.4rem' }} onClick={() => insertText('- [ ] ')} title="待辦事項">
              <CheckSquare size={16} />
            </button>
          </div>

          <input type="file" accept="image/*" ref={fileInputRef} style={{ display: 'none' }} onChange={handleImageUpload} />
          <button className="btn btn-ghost" onClick={() => fileInputRef.current?.click()} disabled={isSaving} title="上傳圖片" style={{ padding: '0.5rem' }}>
            <ImageIcon size={18} />
          </button>
          
          <button className={`btn ${isDirty ? 'btn-primary' : 'btn-ghost'}`} onClick={() => handleSave()} disabled={isSaving || (!isDirty && !isSuccess)}>
            {isSaving ? <Loader2 size={18} className="animate-spin" /> : isSuccess ? <CheckCircle size={18} color="var(--success)" /> : <Save size={18} />}
            {isSaving ? '同步中...' : isSuccess ? '已同步' : '儲存'}
          </button>
        </div>
      </div>
      
      {/* Editor / Preview Area */}
      <div style={{ flex: 1, overflow: 'auto', position: 'relative' }}>
        {mode === 'edit' ? (
          <textarea
            ref={textareaRef}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            onPaste={handlePaste}
            style={{
              width: '100%',
              height: '100%',
              resize: 'none',
              border: 'none',
              background: 'transparent',
              color: 'inherit',
              padding: '1.5rem',
              fontFamily: 'monospace',
              fontSize: '1rem',
              lineHeight: 1.6,
              outline: 'none'
            }}
            placeholder="開始輸入您的筆記 (支援 Markdown 語法，您可以直接 Ctrl+V 貼上圖片)..."
          />
        ) : (
          <div ref={previewRef} style={{ padding: '1.5rem', lineHeight: 1.6, fontSize: '1rem' }}>
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
                img: ({ src, alt }) => {
                  const originalUrl = src || '';
                  const cleanSrc = originalUrl.split('#')[0];
                  let finalSrc = cleanSrc;

                  if (cleanSrc.includes('id=mock-file-')) {
                    const match = cleanSrc.match(/id=(mock-file-\d+)/);
                    if (match) {
                      try {
                        const files = JSON.parse(localStorage.getItem('mock_drive_files') || '[]');
                        const file = files.find((f: any) => f.id === match[1]);
                        if (file && file.content.startsWith('data:image')) {
                          finalSrc = file.content;
                        }
                      } catch (e) {
                        console.error('Failed to load mock image', e);
                      }
                    }
                  }

                  return (
                    <ResizableImage 
                      src={finalSrc} 
                      alt={alt} 
                      originalUrl={originalUrl} 
                      updateImageWidth={updateImageWidth} 
                    />
                  );
                },
                input: ({ node, checked, type, ...props }) => {
                  if (type === 'checkbox') {
                    return (
                      <input 
                        type="checkbox" 
                        checked={checked} 
                        onChange={(e) => {
                          if (previewRef.current) {
                            const checkboxes = Array.from(previewRef.current.querySelectorAll('input[type="checkbox"]'));
                            const index = checkboxes.indexOf(e.target as HTMLInputElement);
                            if (index !== -1) {
                              toggleCheckboxByIndex(index);
                            }
                          }
                        }} 
                        style={{ cursor: 'pointer', marginRight: '0.5rem', transform: 'scale(1.2)', marginLeft: '-1.25rem' }}
                      />
                    );
                  }
                  return <input type={type} {...props} />;
                },
                ul: ({node, ...props}) => <ul style={{ paddingLeft: '1.5rem', marginBottom: '1rem' }} {...props} />,
                ol: ({node, ...props}) => <ol style={{ paddingLeft: '1.5rem', marginBottom: '1rem' }} {...props} />,
                li: ({node, className, ...props}) => (
                  <li 
                    style={{ 
                      marginBottom: '0.5rem', 
                      listStyleType: className?.includes('task-list-item') ? 'none' : 'inherit'
                    }} 
                    className={className} 
                    {...props} 
                  />
                ),
              }}
            >
              {content || '*尚未輸入任何內容。*'}
            </ReactMarkdown>
          </div>
        )}
      </div>
    </div>
  );
}
