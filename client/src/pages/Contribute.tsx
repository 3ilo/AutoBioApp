import { useState } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Image from '@tiptap/extension-image';
import { DragDropContext, Droppable, Draggable } from 'react-beautiful-dnd';
import { Toolbar } from '../components/editor/Toolbar';
import { memoriesApi } from '../services/api';
import { useApi } from '../hooks/useApi';
import { LoadingSpinner } from '../components/ui/LoadingSpinner';
import { useNavigate } from 'react-router-dom';

interface MemoryImage {
  id: string;
  url: string;
  position: { x: number; y: number };
}

export function Contribute() {
  const navigate = useNavigate();
  const [title, setTitle] = useState('');
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);
  const [images, setImages] = useState<MemoryImage[]>([]);

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
          class: 'max-w-full h-auto',
        },
      }),
    ],
    content: '',
    editorProps: {
      attributes: {
        class: 'prose prose-sm sm:prose lg:prose-lg xl:prose-xl mx-auto focus:outline-none',
      },
      handleClick: (view, pos, event) => {
        // Allow clicking anywhere to start editing
        return false;
      },
    },
  });

  const handleGenerateImage = async () => {
    if (!editor) return;
    
    setIsGeneratingImage(true);
    try {
      // TODO: Replace with actual API call
      const response = await fetch('/api/generate-image', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          content: editor.getText(),
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to generate image');
      }

      const { url } = await response.json();
      const newImage: MemoryImage = {
        id: Date.now().toString(),
        url,
        position: { x: 0, y: 0 },
      };
      setImages([...images, newImage]);
    } catch (error) {
      console.error('Error generating image:', error);
    } finally {
      setIsGeneratingImage(false);
    }
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
        date: new Date().toISOString(),
        datetime: new Date(),
        place: {
          name: 'Unknown', // TODO: Add location picker
        },
        isPublic: true,
        images: images.map(img => img.url),
        tags: [], // TODO: Add tag input
      });

      // Reset form and navigate to memories
      setTitle('');
      editor.commands.setContent('');
      setImages([]);
      navigate('/memories');
    } catch (error) {
      console.error('Error saving memory:', error);
    }
  };

  return (
    <div className="max-w-4xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
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

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Content
          </label>
          <div className="prose max-w-none">
            <div className="border rounded-md overflow-hidden bg-white">
              <Toolbar editor={editor} />
              <EditorContent 
                editor={editor} 
                className="min-h-[200px] p-4 prose-sm sm:prose lg:prose-lg xl:prose-xl mx-auto focus:outline-none [&_*]:!text-gray-900 [&_p]:!my-2 [&_p.is-editor-empty:first-child::before]:!text-gray-400 [&_p.is-editor-empty:first-child::before]:!float-left [&_p.is-editor-empty:first-child::before]:!content-[attr(data-placeholder)] [&_p.is-editor-empty:first-child::before]:!pointer-events-none [&_.ProseMirror]:!min-h-[200px] [&_.ProseMirror]:!cursor-text" 
              />
            </div>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Images
          </label>
          <div className="space-y-4">
            <button
              onClick={handleGenerateImage}
              disabled={isGeneratingImage}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isGeneratingImage ? (
                <LoadingSpinner size="sm" className="text-white mr-2" />
              ) : null}
              Generate Image
            </button>

            {images.length > 0 && (
              <DragDropContext onDragEnd={handleDragEnd}>
                <Droppable droppableId="images" direction="horizontal">
                  {(provided) => (
                    <div
                      {...provided.droppableProps}
                      ref={provided.innerRef}
                      className="flex space-x-4 overflow-x-auto pb-4"
                    >
                      {images.map((image, index) => (
                        <Draggable key={image.id} draggableId={image.id} index={index}>
                          {(provided) => (
                            <div
                              ref={provided.innerRef}
                              {...provided.draggableProps}
                              {...provided.dragHandleProps}
                              className="relative flex-shrink-0 w-48 h-48"
                            >
                              <img
                                src={image.url}
                                alt={`Generated image ${index + 1}`}
                                className="w-full h-full object-cover rounded-lg"
                              />
                              <button
                                onClick={() => setImages(images.filter((_, i) => i !== index))}
                                className="absolute top-2 right-2 p-1 bg-red-500 text-white rounded-full hover:bg-red-600"
                              >
                                ×
                              </button>
                            </div>
                          )}
                        </Draggable>
                      ))}
                      {provided.placeholder}
                    </div>
                  )}
                </Droppable>
              </DragDropContext>
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