import { Editor } from '@tiptap/react';
import { useEffect, useState } from 'react';
import {
  BoldIcon,
  ItalicIcon,
  ListBulletIcon,
  NumberedListIcon,
  MinusIcon,
  UnderlineIcon,
} from '@heroicons/react/24/outline';

// Custom quote icon - quotation marks
const QuoteIcon = () => (
  <svg className="w-5 h-5 text-slate-700" viewBox="0 0 24 24" fill="currentColor">
    <path d="M6 17h3l2-4V7H5v6h3zm8 0h3l2-4V7h-6v6h3z" opacity="0.9"/>
  </svg>
);

interface ToolbarProps {
  editor: Editor | null;
}

export function Toolbar({ editor }: ToolbarProps) {
  const [wordCount, setWordCount] = useState(0);
  const [characterCount, setCharacterCount] = useState(0);

  useEffect(() => {
    if (!editor) return;

    const updateCounts = () => {
      const text = editor.getText();
      const words = text.trim() ? text.trim().split(/\s+/).filter(word => word.length > 0).length : 0;
      const characters = text.length;
      setWordCount(words);
      setCharacterCount(characters);
    };

    updateCounts();

    editor.on('update', updateCounts);
    editor.on('selectionUpdate', updateCounts);

    return () => {
      editor.off('update', updateCounts);
      editor.off('selectionUpdate', updateCounts);
    };
  }, [editor]);

  if (!editor) {
    return null;
  }

  return (
    <div className="border-b border-slate-200 bg-slate-50 p-2 flex flex-wrap items-center gap-2">
      {/* Formatting Group */}
      <div className="flex items-center gap-1 border-r border-slate-300 pr-2">
        <button
          onClick={() => editor.chain().focus().toggleBold().run()}
          disabled={!editor.can().chain().focus().toggleBold().run()}
          className={`p-2 hover:bg-slate-200 transition-colors duration-150 ${
            editor.isActive('bold') ? 'bg-slate-300' : ''
          }`}
          title="Bold"
        >
          <BoldIcon className="w-5 h-5 text-slate-700" />
        </button>
        <button
          onClick={() => editor.chain().focus().toggleItalic().run()}
          disabled={!editor.can().chain().focus().toggleItalic().run()}
          className={`p-2 hover:bg-slate-200 transition-colors duration-150 ${
            editor.isActive('italic') ? 'bg-slate-300' : ''
          }`}
          title="Italic"
        >
          <ItalicIcon className="w-5 h-5 text-slate-700" />
        </button>
        <button
          onClick={() => (editor.chain().focus() as any).toggleUnderline().run()}
          className={`p-2 hover:bg-slate-200 transition-colors duration-150 ${
            editor.isActive('underline') ? 'bg-slate-300' : ''
          }`}
          title="Underline"
        >
          <UnderlineIcon className="w-5 h-5 text-slate-700" />
        </button>
      </div>

      {/* Structure Group */}
      <div className="flex items-center gap-1 border-r border-slate-300 pr-2">
        <button
          onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
          className={`p-2 hover:bg-slate-200 transition-colors duration-150 text-xs font-semibold text-slate-700 ${
            editor.isActive('heading', { level: 1 }) ? 'bg-slate-300' : ''
          }`}
          title="Heading 1"
        >
          H1
        </button>
        <button
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          className={`p-2 hover:bg-slate-200 transition-colors duration-150 text-xs font-semibold text-slate-700 ${
            editor.isActive('heading', { level: 2 }) ? 'bg-slate-300' : ''
          }`}
          title="Heading 2"
        >
          H2
        </button>
        <button
          onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
          className={`p-2 hover:bg-slate-200 transition-colors duration-150 text-xs font-semibold text-slate-700 ${
            editor.isActive('heading', { level: 3 }) ? 'bg-slate-300' : ''
          }`}
          title="Heading 3"
        >
          H3
        </button>
      </div>

      {/* Lists Group */}
      <div className="flex items-center gap-1 border-r border-slate-300 pr-2">
        <button
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          disabled={!editor.can().chain().focus().toggleBulletList().run()}
          className={`p-2 hover:bg-slate-200 transition-colors duration-150 ${
            editor.isActive('bulletList') ? 'bg-slate-300' : ''
          }`}
          title="Bullet List"
        >
          <ListBulletIcon className="w-5 h-5 text-slate-700" />
        </button>
        <button
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          disabled={!editor.can().chain().focus().toggleOrderedList().run()}
          className={`p-2 hover:bg-slate-200 transition-colors duration-150 ${
            editor.isActive('orderedList') ? 'bg-slate-300' : ''
          }`}
          title="Numbered List"
        >
          <NumberedListIcon className="w-5 h-5 text-slate-700" />
        </button>
        <button
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
          disabled={!editor.can().chain().focus().toggleBlockquote().run()}
          className={`p-2 hover:bg-slate-200 transition-colors duration-150 ${
            editor.isActive('blockquote') ? 'bg-slate-300' : ''
          }`}
          title="Blockquote"
        >
          <QuoteIcon />
        </button>
        <button
          onClick={() => editor.chain().focus().setHorizontalRule().run()}
          className="p-2 hover:bg-slate-200 transition-colors duration-150"
          title="Horizontal Rule"
        >
          <MinusIcon className="w-5 h-5 text-slate-700" />
        </button>
      </div>

      {/* Word Count */}
      <div className="ml-auto flex items-center gap-3 text-xs text-slate-600 font-medium">
        <span>{wordCount} words</span>
        <span className="text-slate-400">•</span>
        <span>{characterCount} characters</span>
      </div>
    </div>
  );
} 