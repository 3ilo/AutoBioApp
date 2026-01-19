import { useState, useRef, useEffect, useMemo } from 'react';
import { useEditor, EditorContent, JSONContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Image from '@tiptap/extension-image';
import Mention from '@tiptap/extension-mention';
import { Underline } from '../components/editor/Underline';
import { Toolbar } from '../components/editor/Toolbar';
import { createMentionSuggestionConfig } from '../components/editor/mentionSuggestionConfig';
import { memoriesApi, imageGenerationApi, characterApi } from '../services/api';
import { useApi } from '../hooks/useApi';
import { LoadingSpinner } from '../components/ui/LoadingSpinner';
import { useNavigate, useLocation } from 'react-router-dom';
import { IMemoryImage, IMemory } from '../../../shared/types/Memory';
import { ICharacter, ITaggedCharacter } from '../types/character';
import { useAuthStore } from '../stores/authStore';
import { MemoryImage } from '../components/memories/MemoryImage';
import { Memory } from '../components/memories/Memory';
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
  const [selectedImageId, setSelectedImageId] = useState<string | null>(null); // For selecting confirmed images
  const [characters, setCharacters] = useState<ICharacter[]>([]);

  // Load characters for @mention functionality
  useEffect(() => {
    const loadCharacters = async () => {
      try {
        const response = await characterApi.getAll();
        setCharacters(response.data.characters);
        logger.debug('Characters loaded for mention', { count: response.data.characters.length });
      } catch (error) {
        logger.error('Failed to load characters for mention', {
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    };
    loadCharacters();
  }, []);

  // Create mention suggestion config with characters
  const mentionSuggestionConfig = useMemo(
    () => createMentionSuggestionConfig({ characters }),
    [characters]
  );

  // Initialize images with presigned URLs when editing
  useEffect(() => {
    const initializeImages = async () => {
      if (editingMemory) {
        const allImages: MemoryImage[] = [];
        
        // Add main image if it exists
        if (editingMemory.mainImage) {
          try {
            const presignedResponse = await imageGenerationApi.generatePresignedViewUrl(editingMemory.mainImage.url);
            allImages.push({
              id: `main-${Date.now()}`,
              url: editingMemory.mainImage.url,
              presignedUrl: presignedResponse.data.presignedUrl,
              position: editingMemory.mainImage.position,
              isConfirmed: true,
            });
          } catch (error) {
            logger.error('Failed to generate presigned URL for main image', { 
              error: error instanceof Error ? error.message : 'Unknown error',
              imageUrl: editingMemory.mainImage.url.substring(0, 50) + '...'
            });
            allImages.push({
              id: `main-${Date.now()}`,
              url: editingMemory.mainImage.url,
              position: editingMemory.mainImage.position,
              isConfirmed: true,
            });
          }
        }
        
        // Add secondary images
        if (editingMemory.images && editingMemory.images.length > 0) {
          const imagesWithPresignedUrls = await Promise.all(
            editingMemory.images.map(async (img, index) => {
              try {
                const presignedResponse = await imageGenerationApi.generatePresignedViewUrl(img.url);
                return {
                  id: `secondary-${Date.now()}-${index}`,
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
                  id: `secondary-${Date.now()}-${index}`,
                  url: img.url,
                  position: img.position,
                  isConfirmed: true,
                };
              }
            })
          );
          allImages.push(...imagesWithPresignedUrls);
        }
        
        setImages(allImages);
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
        heading: {
          levels: [1, 2, 3],
        },
      }),
      Underline,
      Image.configure({
        allowBase64: true,
        HTMLAttributes: {
          class: 'max-w-full h-auto border-2 border-slate-200',
        },
      }),
      Mention.configure({
        HTMLAttributes: {
          class: 'mention',
        },
        renderLabel({ node }) {
          // Remove the @ prefix in the editor, just show the name
          return node.attrs.label;
        },
        renderText({ node }) {
          // Remove the @ prefix in plain text extraction
          return node.attrs.label;
        },
        renderHTML({ node }) {
          // Customize the HTML output to exclude the @ symbol
          return [
            'span',
            {
              class: 'mention',
              'data-type': 'mention',
              'data-id': node.attrs.id,
              'data-label': node.attrs.label,
            },
            node.attrs.label, // Just the name, no @
          ];
        },
        suggestion: mentionSuggestionConfig,
      }),
    ],
    content: editingMemory?.content || '',
    editorProps: {
      attributes: {
        class: 'prose prose-sm sm:prose lg:prose-lg xl:prose-xl mx-auto focus:outline-none',
        'data-placeholder': 'Start writing your memory...',
      },
      handleClick: (_view, _pos, _event) => {
        return false;
      },
    },
  }, [mentionSuggestionConfig]);

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

  const handleGenerateImage = async (regenerateForImageId?: string) => {
    if (!editor || !title) return;
    
    setIsGeneratingImage(true);
    try {
      // Extract tagged character IDs from current editor content
      const editorJson = editor.getJSON();
      const taggedChars = extractTaggedCharacters(editorJson);
      const taggedCharacterIds = taggedChars.map(tc => tc.characterId);

      const response = await imageGenerationApi.generate({
        title,
        content: editor.getText(),
        date: new Date(date),
        userId: user?._id, // Include user ID for enhanced prompts
        taggedCharacterIds: taggedCharacterIds.length > 0 ? taggedCharacterIds : undefined,
      });

      // Convert S3 URI to pre-signed URL for display
      const presignedResponse = await imageGenerationApi.generatePresignedViewUrl(response.data.url);
      
      if (regenerateForImageId) {
        // Regenerating a specific image - replace it
        const imageToReplace = images.find(img => img.id === regenerateForImageId);
        if (imageToReplace) {
          const newImage: MemoryImage = {
            ...imageToReplace,
            url: response.data.url,
            presignedUrl: presignedResponse.data.presignedUrl,
            isConfirmed: false, // Mark as unconfirmed so user can review
          };
          
          // Replace the image
          setImages(images.map(img => img.id === regenerateForImageId ? newImage : img));
          setSelectedImage(newImage);
          setSelectedImageId(null);
        }
      } else {
        // Generating a new image
        const position = getRandomPosition();
        const newImage: MemoryImage = {
          id: Date.now().toString(),
          url: response.data.url, // Store the S3 URI
          presignedUrl: presignedResponse.data.presignedUrl, // Cache presigned URL for display
          position,
          isConfirmed: false,
        };
        setSelectedImage(newImage);
        setSelectedImageId(null);
        // Clear any existing unconfirmed images and add the new one
        const confirmedImages = images.filter(img => img.isConfirmed);
        setImages([...confirmedImages, newImage]);
      }
    } catch (error) {
      logger.error('Failed to generate image', { 
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    } finally {
      setIsGeneratingImage(false);
    }
  };

  const handleSelectImage = (imageId: string) => {
    const image = images.find(img => img.id === imageId);
    if (image) {
      setSelectedImageId(imageId);
      // If it's an unconfirmed image, also set selectedImage
      if (!image.isConfirmed) {
        setSelectedImage(image);
      } else {
        setSelectedImage(null);
      }
    }
  };

  const handleConfirmImage = () => {
    if (!selectedImage) return;
  
    // Keep all existing confirmed images and add the new confirmed image
    const confirmedNewImage = { ...selectedImage, isConfirmed: true };
    const existingConfirmedImages = images.filter(img => img.isConfirmed);
    const unconfirmedImages = images.filter(img => !img.isConfirmed && img.id !== selectedImage.id);
    
    setImages([...existingConfirmedImages, ...unconfirmedImages, confirmedNewImage]);
    setSelectedImage(null);
    setSelectedImageId(null);
  };

  const handleCancelImage = () => {
    if (!selectedImage) return;
    
    setImages(images.filter(img => img.id !== selectedImage.id));
    setSelectedImage(null);
    setSelectedImageId(null);
  };

  // Extract tagged characters from editor content
  const extractTaggedCharacters = (content: JSONContent): ITaggedCharacter[] => {
    const mentions: ITaggedCharacter[] = [];
    
    const traverse = (node: JSONContent) => {
      if (node.type === 'mention' && node.attrs?.id && node.attrs?.label) {
        const attrs = node.attrs; // Store attrs in a variable to satisfy TypeScript
        // Avoid duplicates
        if (!mentions.some(m => m.characterId === attrs.id)) {
          mentions.push({
            characterId: attrs.id,
            displayName: attrs.label,
          });
        }
      }
      if (node.content) {
        node.content.forEach(traverse);
      }
    };
    
    traverse(content);
    return mentions;
  };

  const handleSave = async () => {
    if (!editor || !title) return;

    try {
      const confirmedImages = images.filter(img => img.isConfirmed);
      
      // Determine main image: 
      // 1. If editing and mainImage exists in confirmed images, use it
      // 2. Otherwise, first confirmed image becomes mainImage
      let mainImage: { url: string; position: { x: number; y: number; width: number; height: number } } | undefined;
      let secondaryImages: Array<{ url: string; position: { x: number; y: number; width: number; height: number } }> = [];
      
      if (confirmedImages.length > 0) {
        // Check if we're editing and have a main image from the original memory
        const originalMainImageUrl = editingMemory?.mainImage?.url;
        const mainImageIndex = originalMainImageUrl 
          ? confirmedImages.findIndex(img => img.url === originalMainImageUrl)
          : -1;
        
        if (mainImageIndex >= 0) {
          // Preserve original main image
          mainImage = { 
            url: confirmedImages[mainImageIndex].url, 
            position: confirmedImages[mainImageIndex].position 
          };
          secondaryImages = confirmedImages
            .filter((_, index) => index !== mainImageIndex)
            .map(({ url, position }) => ({ url, position }));
        } else {
          // First confirmed image becomes mainImage
          mainImage = { 
            url: confirmedImages[0].url, 
            position: confirmedImages[0].position 
          };
          secondaryImages = confirmedImages.length > 1
            ? confirmedImages.slice(1).map(({ url, position }) => ({ url, position }))
            : [];
        }
      }

      // Extract tagged characters from editor content
      const editorJson = editor.getJSON();
      const taggedCharacters = extractTaggedCharacters(editorJson);

      const memoryData = {
        title,
        content: editor.getHTML(),
        date: new Date(date),
        isPublic,
        mainImage,
        images: secondaryImages,
        tags: [], // TODO: Add tag input
        taggedCharacters,
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
                  className="min-h-[300px] p-6 prose-sm sm:prose lg:prose-lg xl:prose-xl mx-auto focus:outline-none [&_*]:!text-slate-900 [&_p]:!my-2 [&_ul]:!my-2 [&_ol]:!my-2 [&_li]:!my-1 [&_p.is-editor-empty:first-child::before]:!text-slate-400 [&_p.is-editor-empty:first-child::before]:!float-left [&_p.is-editor-empty:first-child::before]:!content-[attr(data-placeholder)] [&_p.is-editor-empty:first-child::before]:!pointer-events-none [&_.ProseMirror]:!min-h-[300px] [&_.ProseMirror]:!cursor-text" 
                />
              </div>
              
              {/* Confirmed images preview below editor */}
              {images.filter(img => img.isConfirmed).length > 0 && (
                <div className="mt-4 pt-4 border-t border-slate-200 pb-4">
                  <label className="form-label text-xs font-semibold uppercase tracking-wider text-slate-700 mb-3 block text-center">
                    Confirmed Images ({images.filter(img => img.isConfirmed).length})
                  </label>
                  <div className="flex flex-wrap justify-center gap-4">
                    {images.filter(img => img.isConfirmed).map((image) => (
                      <div
                        key={image.id}
                        onClick={() => handleSelectImage(image.id)}
                        className={`relative w-24 h-24 border-2 cursor-pointer transition-all duration-150 overflow-hidden ${
                          selectedImageId === image.id 
                            ? 'border-slate-900' 
                            : 'border-slate-200 hover:border-slate-400'
                        }`}
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
              )}
            </div>
          </div>
        </div>

        <div>
          <div className="space-y-6">
            {/* Generate New Image Button - Always visible */}
            <button
              onClick={() => handleGenerateImage()}
              disabled={isGeneratingImage || !title}
              className="btn-primary"
            >
              {isGeneratingImage ? (
                <LoadingSpinner size="sm" className="text-white mr-2" />
              ) : null}
              Generate New Illustration
            </button>

            {/* Regenerate Selected Image Button - Only visible when an image is selected */}
            {(selectedImageId || selectedImage) && (
              <button
                onClick={() => handleGenerateImage(selectedImageId || selectedImage?.id)}
                disabled={isGeneratingImage || !title}
                className="btn-secondary"
              >
                {isGeneratingImage ? (
                  <LoadingSpinner size="sm" className="text-slate-900 mr-2" />
                ) : null}
                Regenerate Selected Image
              </button>
            )}

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

        {/* Preview Section - Memory Component */}
        {(editor?.getText() || images.some(img => img.isConfirmed)) && (
          <div>
            <label className="form-label">
              Preview
            </label>
            <div className="border-2 border-slate-200 bg-white p-8">
              <Memory
                memory={{
                  _id: editingMemory?._id,
                  title: title || 'Untitled',
                  content: editor?.getHTML() || '',
                  date: new Date(date),
                  mainImage: images.find(img => img.isConfirmed) 
                    ? { url: images.find(img => img.isConfirmed)!.url, position: images.find(img => img.isConfirmed)!.position }
                    : undefined,
                  images: images.filter((img, index) => img.isConfirmed && index > 0).map(({ url, position }) => ({ url, position })),
                  tags: [],
                  author: user?._id || '',
                  likes: [],
                  comments: [],
                  isPublic,
                }}
              />
            </div>
          </div>
        )}

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