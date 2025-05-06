import { useState, useRef, useEffect } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Image from '@tiptap/extension-image';
import { Toolbar } from '../components/editor/Toolbar';
import { memoriesApi, imageGenerationApi } from '../services/api';
import { useApi } from '../hooks/useApi';
import { LoadingSpinner } from '../components/ui/LoadingSpinner';
import { useNavigate } from 'react-router-dom';
import { IMemoryImage } from '../../../shared/types/Memory';

interface MemoryImage extends IMemoryImage {
  id: string;
  isConfirmed: boolean;
}

export function Contribute() {
  const navigate = useNavigate();
  const editorRef = useRef<HTMLDivElement>(null);
  const [title, setTitle] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [isPublic, setIsPublic] = useState(true);
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);
  const [images, setImages] = useState<MemoryImage[]>([]);
  const [selectedImage, setSelectedImage] = useState<MemoryImage | null>(null);

  const {
    isLoading: isSaving,
    error: saveError,
    execute: saveMemory,
  } = useApi(memoriesApi.create, null);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        bulletList: {
          keepMarks: true,
          keepAttributes: false,
        },
        orderedList: {
          keepMarks: true,
          keepAttributes: false,
        },
      }),
      Image.configure({
        allowBase64: true,
        HTMLAttributes: {
          class: 'max-w-full h-auto rounded-lg shadow-md',
        },
      }),
    ],
    content: '',
    editorProps: {
      attributes: {
        class: 'prose prose-sm sm:prose lg:prose-lg xl:prose-xl mx-auto focus:outline-none',
      },
      handleClick: (view, pos, event) => {
        return false;
      },
    },
  });

  // Function to get random position within editor bounds
  const getRandomPosition = () => {
    if (!editorRef.current) return { x: 0, y: 0, width: 300, height: 200 };
    
    const editorRect = editorRef.current.getBoundingClientRect();
    const maxWidth = editorRect.width * 0.8; // 80% of editor width
    const maxHeight = editorRect.height * 0.4; // 40% of editor height
    
    return {
      x: Math.random() * (editorRect.width - maxWidth),
      y: Math.random() * (editorRect.height - maxHeight),
      width: maxWidth,
      height: maxHeight,
    };
  };

  const handleGenerateImage = async () => {
    if (!editor || !title) return;
    
    setIsGeneratingImage(true);
    try {
      const response = await imageGenerationApi.generate({
        title,
        content: editor.getText(),
        date: new Date(date),
      });

      const position = getRandomPosition();
      const newImage: MemoryImage = {
        id: Date.now().toString(),
        url: response.data.url,
        position,
        isConfirmed: false,
      };
      setSelectedImage(newImage);
      setImages([...images, newImage]);
    } catch (error) {
      console.error('Error generating image:', error);
    } finally {
      setIsGeneratingImage(false);
    }
  };

  const handleRegenerateImage = async () => {
    if (!editor || !title || !selectedImage) return;
    
    setIsGeneratingImage(true);
    try {
      const response = await imageGenerationApi.regenerate({
        title,
        content: editor.getText(),
        date: new Date(date),
        previousUrl: selectedImage.url,
      });

      const newImage: MemoryImage = {
        id: Date.now().toString(),
        url: response.data.url,
        position: selectedImage.position,
        isConfirmed: false,
      };
      setSelectedImage(newImage);
      setImages(images.map(img => 
        img.id === selectedImage.id ? newImage : img
      ));
    } catch (error) {
      console.error('Error regenerating image:', error);
    } finally {
      setIsGeneratingImage(false);
    }
  };

  const handleConfirmImage = () => {
    if (!selectedImage) return;
    
    setImages(images.map(img => 
      img.id === selectedImage.id ? { ...img, isConfirmed: true } : img
    ));
    setSelectedImage(null);
  };

  const handleCancelImage = () => {
    if (!selectedImage) return;
    
    setImages(images.filter(img => img.id !== selectedImage.id));
    setSelectedImage(null);
  };

  const handleDragEnd = (result: any) => {
    if (!result.destination) return;

    const items = Array.from(images);
    const [reorderedItem] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reorderedItem);

    setImages(items);
  };

  const handleSave = async () => {
    if (!editor || !title) return;

    try {
      await saveMemory({
        title,
        content: editor.getHTML(),
        date: new Date(date),
        isPublic,
        images: images.filter(img => img.isConfirmed).map(({ url, position }) => ({ url, position })),
        tags: [], // TODO: Add tag input
      });

      // Reset form and navigate to memories
      setTitle('');
      setDate(new Date().toISOString().split('T')[0]);
      setIsPublic(true);
      editor.commands.setContent('');
      setImages([]);
      setSelectedImage(null);
      navigate('/memories');
    } catch (error) {
      console.error('Error saving memory:', error);
    }
  };

  return (
    <div className="w-screen px-4 sm:px-6 lg:px-8 py-8">
      <div className="space-y-8">
        <div>
          <label htmlFor="title" className="block text-sm font-medium text-gray-700">
            Title
          </label>
          <input
            type="text"
            id="title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
            placeholder="Give your memory a title"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label htmlFor="date" className="block text-sm font-medium text-gray-700">
              Date
            </label>
            <input
              type="date"
              id="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">
              Visibility
            </label>
            <div className="mt-1">
              <label className="inline-flex items-center">
                <input
                  type="checkbox"
                  checked={isPublic}
                  onChange={(e) => setIsPublic(e.target.checked)}
                  className="rounded border-gray-300 text-indigo-600 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                />
                <span className="ml-2 text-sm text-gray-700">Public</span>
              </label>
            </div>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Content
          </label>
          <div className="prose max-w-none">
            <div className="border rounded-md overflow-hidden bg-white">
              <Toolbar editor={editor} />
              <div ref={editorRef} className="relative">
                <EditorContent 
                  editor={editor} 
                  className="min-h-[200px] p-4 prose-sm sm:prose lg:prose-lg xl:prose-xl mx-auto focus:outline-none [&_*]:!text-gray-900 [&_p]:!my-2 [&_p.is-editor-empty:first-child::before]:!text-gray-400 [&_p.is-editor-empty:first-child::before]:!float-left [&_p.is-editor-empty:first-child::before]:!content-[attr(data-placeholder)] [&_p.is-editor-empty:first-child::before]:!pointer-events-none [&_.ProseMirror]:!min-h-[200px] [&_.ProseMirror]:!cursor-text" 
                />
                {images.filter(img => img.isConfirmed).map((image) => (
                  <div
                    key={image.id}
                    className="absolute"
                    style={{
                      left: `${image.position.x}px`,
                      top: `${image.position.y}px`,
                      width: `${image.position.width}px`,
                      height: `${image.position.height}px`,
                    }}
                  >
                    <img
                      src={image.url}
                      alt="Memory illustration"
                      className="w-full h-full object-cover rounded-lg shadow-md"
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Images
          </label>
          <div className="space-y-4">
            {images.length === 0 && 
            <button
              onClick={handleGenerateImage}
              disabled={isGeneratingImage || !title}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isGeneratingImage ? (
                <LoadingSpinner size="sm" className="text-white mr-2" />
              ) : null}
              Generate Image
            </button>
            }

            {selectedImage && (
              <div className="space-y-4">
                <div className="relative w-full max-w-2xl mx-auto">
                  <img
                    src={selectedImage.url}
                    alt="Generated image"
                    className="w-full h-auto rounded-lg shadow-md"
                  />
                  <div className="absolute bottom-4 left-4 right-4 flex justify-center space-x-2">
                    <button
                      onClick={handleGenerateImage}
                      disabled={isGeneratingImage}
                      className="px-4 py-2 bg-yellow-500 text-white rounded-md hover:bg-yellow-600 disabled:opacity-50"
                    >
                      Regenerate
                    </button>
                    <button
                      onClick={handleConfirmImage}
                      className="px-4 py-2 bg-green-500 text-white rounded-md hover:bg-green-600"
                    >
                      Confirm
                    </button>
                    <button
                      onClick={handleCancelImage}
                      className="px-4 py-2 bg-red-500 text-white rounded-md hover:bg-red-600"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {saveError && (
          <div className="text-sm text-red-600 text-center">{saveError.message}</div>
        )}

        <div className="flex justify-end">
          <button
            onClick={handleSave}
            disabled={isSaving || !title || !editor?.getText()}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSaving ? (
              <LoadingSpinner size="sm" className="text-white mr-2" />
            ) : null}
            Save Memory
          </button>
        </div>
      </div>
    </div>
  );
} 