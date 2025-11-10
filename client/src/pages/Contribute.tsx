import { useState, useRef, useEffect } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Image from '@tiptap/extension-image';
import { Toolbar } from '../components/editor/Toolbar';
import { memoriesApi, imageGenerationApi } from '../services/api';
import { useApi } from '../hooks/useApi';
import { LoadingSpinner } from '../components/ui/LoadingSpinner';
import { useNavigate, useLocation } from 'react-router-dom';
import { IMemoryImage, IMemory } from '../../../shared/types/Memory';
import { useAuthStore } from '../stores/authStore';
import { MemoryImage } from '../components/memories/MemoryImage';
import logger from '../utils/logger';
import { getErrorMessage } from '../utils/errorMessages';


interface MemoryImage extends IMemoryImage {
  id: string;
  isConfirmed: boolean;
  presignedUrl?: string; // Cached presigned URL for display
}

export function Contribute() {
  const navigate = useNavigate();
  const location = useLocation();
  const user = useAuthStore((state) => state.user);
  const editorRef = useRef<HTMLDivElement>(null);
  
  // Check if we're in editing mode
  const isEditing = location.state?.isEditing || false;
  const editingMemory = location.state?.editingMemory as IMemory | undefined;
  
  const [title, setTitle] = useState(editingMemory?.title || '');
  const [date, setDate] = useState(editingMemory?.date ? new Date(editingMemory.date).toISOString().split('T')[0] : new Date().toISOString().split('T')[0]);
  const [isPublic, setIsPublic] = useState(editingMemory?.isPublic ?? false);
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);
  const [images, setImages] = useState<MemoryImage[]>([]);
  const [selectedImage, setSelectedImage] = useState<MemoryImage | null>(null);

  // Initialize images with presigned URLs when editing
  useEffect(() => {
    const initializeImages = async () => {
      if (editingMemory?.images && editingMemory.images.length > 0) {
        const imagesWithPresignedUrls = await Promise.all(
          editingMemory.images.map(async (img, index) => {
            try {
              const presignedResponse = await imageGenerationApi.generatePresignedViewUrl(img.url);
              return {
                id: index.toString(),
                url: img.url,
                presignedUrl: presignedResponse.data.presignedUrl,
                position: img.position,
                isConfirmed: true,
              };
            } catch (error) {
              logger.error('Failed to generate presigned URL for existing image', { 
                error: error instanceof Error ? error.message : 'Unknown error',
                imageUrl: img.url.substring(0, 50) + '...'
              });
              return {
                id: index.toString(),
                url: img.url,
                position: img.position,
                isConfirmed: true,
              };
            }
          })
        );
        setImages(imagesWithPresignedUrls);
      }
    };

    initializeImages();
  }, [editingMemory]);

  const {
    isLoading: isSaving,
    error: saveError,
    execute: saveMemory,
  } = useApi(isEditing ? memoriesApi.update : memoriesApi.create, null);

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
          class: 'max-w-full h-auto border-2 border-slate-200',
        },
      }),
    ],
    content: editingMemory?.content || '',
    editorProps: {
      attributes: {
        class: 'prose prose-sm sm:prose lg:prose-lg xl:prose-xl mx-auto focus:outline-none',
      },
      handleClick: (_view, _pos, _event) => {
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
        userId: user?._id, // Include user ID for enhanced prompts
      });

      // Convert S3 URI to pre-signed URL for display
      const presignedResponse = await imageGenerationApi.generatePresignedViewUrl(response.data.url);
      
      const position = getRandomPosition();
      const newImage: MemoryImage = {
        id: Date.now().toString(),
        url: response.data.url, // Store the S3 URI
        presignedUrl: presignedResponse.data.presignedUrl, // Cache presigned URL for display
        position,
        isConfirmed: false,
      };
      setSelectedImage(newImage);
      // Clear any existing unconfirmed images and add the new one
      const confirmedImages = images.filter(img => img.isConfirmed);
      setImages([...confirmedImages, newImage]);
    } catch (error) {
      logger.error('Failed to generate image', { 
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    } finally {
      setIsGeneratingImage(false);
    }
  };

  const handleConfirmImage = () => {
      if (!selectedImage) return;
    
    // Replace all existing confirmed images with the new confirmed image
    const confirmedNewImage = { ...selectedImage, isConfirmed: true };
    const unconfirmedImages = images.filter(img => !img.isConfirmed && img.id !== selectedImage.id);
    
    setImages([...unconfirmedImages, confirmedNewImage]);
    setSelectedImage(null);
  };

  const handleCancelImage = () => {
    if (!selectedImage) return;
    
    setImages(images.filter(img => img.id !== selectedImage.id));
    setSelectedImage(null);
  };

  const handleSave = async () => {
    if (!editor || !title) return;

    try {
      const memoryData = {
        title,
        content: editor.getHTML(),
        date: new Date(date),
        isPublic,
        images: images.filter(img => img.isConfirmed).map(({ url, position }) => ({ url, position })),
        tags: [], // TODO: Add tag input
      };

      if (isEditing && editingMemory?._id) {
        // Update existing memory
        await saveMemory(editingMemory._id, memoryData);
      } else {
        // Create new memory
        await saveMemory(memoryData);
      }

      // Reset form and navigate to memories
      setTitle('');
      setDate(new Date().toISOString().split('T')[0]);
      setIsPublic(false);
      editor.commands.setContent('');
      setImages([]);
      setSelectedImage(null);
      navigate('/memories');
    } catch (error) {
      logger.error('Failed to save memory', { 
        error: error instanceof Error ? error.message : 'Unknown error',
        isEditing: !!editingMemory
      });
    }
  };

  return (
    <div className="w-full px-6 sm:px-8 lg:px-12 py-12">
      <div className="max-w-5xl mx-auto space-y-12">
        <div className="border-b border-slate-200 pb-6">
          <h1 className="text-4xl font-semibold text-slate-900 tracking-tight">
            {isEditing ? 'Edit Memory' : 'Create New Memory'}
          </h1>
        </div>
        <div>
          <label htmlFor="title" className="form-label">
            Title
          </label>
          <input
            type="text"
            id="title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="input-field"
            placeholder="Give your memory a title"
          />
        </div>

        <div className="grid grid-cols-2 gap-6">
          <div>
            <label htmlFor="date" className="form-label">
              Date
            </label>
            <input
              type="date"
              id="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="input-field"
            />
          </div>

          <div>
            <label className="form-label">
              Visibility
            </label>
            <div className="mt-2">
              <label className="inline-flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={isPublic}
                  onChange={(e) => setIsPublic(e.target.checked)}
                  className="w-4 h-4 border-2 border-slate-300 text-slate-900 focus:ring-1 focus:ring-slate-900"
                />
                <span className="text-sm font-medium text-slate-700 uppercase tracking-wider">Make this memory public</span>
              </label>
              <p className="mt-2 text-xs text-slate-500 uppercase tracking-wider">
                {isPublic 
                  ? "This memory will be visible to everyone in the Explore page" 
                  : "This memory will only be visible to you in your Memories page"
                }
              </p>
            </div>
          </div>
        </div>

        <div>
          <label className="form-label">
            Content
          </label>
          <div className="prose max-w-none">
            <div className="border-2 border-slate-200 bg-white">
              <Toolbar editor={editor} />
              <div ref={editorRef} className="relative">
                <EditorContent 
                  editor={editor} 
                  className="min-h-[300px] p-6 prose-sm sm:prose lg:prose-lg xl:prose-xl mx-auto focus:outline-none [&_*]:!text-slate-900 [&_p]:!my-2 [&_p.is-editor-empty:first-child::before]:!text-slate-400 [&_p.is-editor-empty:first-child::before]:!float-left [&_p.is-editor-empty:first-child::before]:!content-[attr(data-placeholder)] [&_p.is-editor-empty:first-child::before]:!pointer-events-none [&_.ProseMirror]:!min-h-[300px] [&_.ProseMirror]:!cursor-text" 
                />
                {images.filter(img => img.isConfirmed).map((image) => (
                  <div
                    key={image.id}
                    className="absolute border-2 border-slate-200"
                    style={{
                      left: `${image.position.x}px`,
                      top: `${image.position.y}px`,
                      width: `${image.position.width}px`,
                      height: `${image.position.height}px`,
                    }}
                  >
                    <MemoryImage
                      src={image.url}
                      alt="Memory illustration"
                      className="w-full h-full object-cover"
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div>
          <div className="space-y-6">
            {(images.length === 0 || isEditing) && 
            <button
              onClick={handleGenerateImage}
              disabled={isGeneratingImage || !title}
              className="btn-primary"
            >
              {isGeneratingImage ? (
                <LoadingSpinner size="sm" className="text-white mr-2" />
              ) : null}
              {isEditing ? 'Generate New Illustration' : 'Generate Illustration'}
            </button>
            }

            {selectedImage && (
              <div className="space-y-4">
                <div className="relative w-full max-w-3xl mx-auto border-2 border-slate-200">
                  <img
                    src={selectedImage.presignedUrl || selectedImage.url}
                    alt="Generated image"
                    className="w-full h-auto"
                  />
                  <div className="absolute bottom-6 left-6 right-6 flex justify-center gap-3">
                    <button
                      onClick={handleGenerateImage}
                      disabled={isGeneratingImage}
                      className="px-6 py-2.5 text-sm font-medium tracking-wide uppercase text-white bg-yellow-600 hover:bg-yellow-700 active:bg-yellow-800 focus:outline-none focus:ring-1 focus:ring-yellow-600 focus:ring-offset-2 transition-all duration-150 disabled:opacity-50"
                    >
                      Regenerate
                    </button>
                    <button
                      onClick={handleConfirmImage}
                      className="px-6 py-2.5 text-sm font-medium tracking-wide uppercase text-white bg-green-600 hover:bg-green-700 active:bg-green-800 focus:outline-none focus:ring-1 focus:ring-green-600 focus:ring-offset-2 transition-all duration-150"
                    >
                      Confirm
                    </button>
                    <button
                      onClick={handleCancelImage}
                      className="px-6 py-2.5 text-sm font-medium tracking-wide uppercase text-white bg-red-600 hover:bg-red-700 active:bg-red-800 focus:outline-none focus:ring-1 focus:ring-red-600 focus:ring-offset-2 transition-all duration-150"
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
          <div className="error-message text-center">
            {getErrorMessage(saveError)}
          </div>
        )}

        <div className="flex justify-end pt-6 border-t border-slate-200">
          <button
            onClick={handleSave}
            disabled={isSaving || !title || !editor?.getText()}
            className="btn-primary"
          >
            {isSaving ? (
              <LoadingSpinner size="sm" className="text-white mr-2" />
            ) : null}
            {isEditing ? 'Update Memory' : 'Save Memory'}
          </button>
        </div>
      </div>
    </div>
  );
} 