import { format } from 'date-fns';
import { IMemory, IMemoryImage } from '@shared/types/Memory';
import DOMPurify from 'dompurify';
import { MemoryImage } from './MemoryImage';
import { useMemo, useState, useEffect } from 'react';

interface MemoryProps {
  memory: IMemory;
}

/**
 * Helper function to remove @ symbols from mention spans in HTML content
 */
function cleanMentionSymbols(html: string): string {
  return html.replace(
    /(<span[^>]*class="[^"]*mention[^"]*"[^>]*>)@([^<]+)(<\/span>)/g,
    '$1$2$3'
  );
}

/**
 * Detailed Memory component for edit/view mode
 * - Displays all images (main + secondary) with text wrapping
 * - Two-column layout on wide screens
 * - Images injected into content at strategic points
 */
export function Memory({ memory }: MemoryProps) {
  const [contentNodes, setContentNodes] = useState<React.ReactNode[]>([]);

  // Collect all images (main + secondary)
  const allImages = useMemo(() => {
    const images: IMemoryImage[] = [];
    if (memory.mainImage) {
      images.push(memory.mainImage);
    }
    if (memory.images && memory.images.length > 0) {
      images.push(...memory.images);
    }
    return images;
  }, [memory.mainImage, memory.images]);

  // Process content and inject images
  useEffect(() => {
    if (allImages.length === 0) {
      const sanitized = cleanMentionSymbols(DOMPurify.sanitize(memory.content));
      setContentNodes([<div key="content" dangerouslySetInnerHTML={{ __html: sanitized }} />]);
      return;
    }

    // Parse HTML content
    const parser = new DOMParser();
    const doc = parser.parseFromString(memory.content, 'text/html');
    const body = doc.body;

    // Get all paragraph elements
    const paragraphs = Array.from(body.querySelectorAll('p'));
    
    if (paragraphs.length === 0) {
      // No paragraphs, just sanitize and return
      const sanitized = cleanMentionSymbols(DOMPurify.sanitize(memory.content));
      setContentNodes([<div key="content" dangerouslySetInnerHTML={{ __html: sanitized }} />]);
      return;
    }

    // Distribute images across paragraphs
    const imagesPerParagraph = Math.max(1, Math.floor(paragraphs.length / allImages.length));
    const nodes: React.ReactNode[] = [];
    let imageIndex = 0;

    paragraphs.forEach((paragraph, index) => {
      // Add paragraph
      const paragraphHtml = paragraph.outerHTML;
      const sanitized = cleanMentionSymbols(DOMPurify.sanitize(paragraphHtml));
      nodes.push(
        <div 
          key={`para-${index}`} 
          dangerouslySetInnerHTML={{ __html: sanitized }} 
        />
      );

      // Insert image after this paragraph if it's time
      if (imageIndex < allImages.length && (index + 1) % imagesPerParagraph === 0) {
        const image = allImages[imageIndex];
        const floatDirection = image.float || (imageIndex % 2 === 0 ? 'left' : 'right');
        const sizeClass = image.size === 'small' ? 'max-w-[200px]' : image.size === 'large' ? 'max-w-[400px]' : 'max-w-[300px]';
        
        nodes.push(
          <div
            key={`img-${imageIndex}`}
            className={`memory-image-wrap float-${floatDirection} ${sizeClass} mb-4 ${floatDirection === 'left' ? 'mr-4' : 'ml-4'}`}
          >
            <MemoryImage
              src={image.url}
              alt={`Memory illustration ${imageIndex + 1}`}
              className="w-full h-auto border-2 border-slate-200"
            />
          </div>
        );
        imageIndex++;
      }
    });

    // Add remaining images at the end
    while (imageIndex < allImages.length) {
      const image = allImages[imageIndex];
      const floatDirection = image.float || (imageIndex % 2 === 0 ? 'left' : 'right');
      const sizeClass = image.size === 'small' ? 'max-w-[200px]' : image.size === 'large' ? 'max-w-[400px]' : 'max-w-[300px]';
      
      nodes.push(
        <div
          key={`img-${imageIndex}`}
          className={`memory-image-wrap float-${floatDirection} ${sizeClass} mb-4 ${floatDirection === 'left' ? 'mr-4' : 'ml-4'}`}
        >
          <MemoryImage
            src={image.url}
            alt={`Memory illustration ${imageIndex + 1}`}
            className="w-full h-auto border-2 border-slate-200"
          />
        </div>
      );
      imageIndex++;
    }

    setContentNodes(nodes);
  }, [memory.content, allImages]);

  return (
    <div className="w-full">
      {/* Header */}
      <div className="border-b border-slate-200 pb-6 mb-8">
        <h1 className="text-4xl font-semibold text-slate-900 tracking-tight mb-2">
          {memory.title}
        </h1>
        <time className="text-xs font-medium text-slate-500 uppercase tracking-wider">
          {format(new Date(memory.date), 'MMM d, yyyy')}
        </time>
      </div>

      {/* Content with two-column layout on wide screens */}
      <div className="memory-content-wrapper">
        <div className="prose prose-sm sm:prose lg:prose-lg xl:prose-xl max-w-none memory-content-two-column">
          {contentNodes}
        </div>
      </div>

      {/* Tags */}
      {memory.tags && memory.tags.length > 0 && (
        <div className="flex flex-wrap gap-2 mt-8 pt-8 border-t border-slate-200">
          {memory.tags.map((tag) => (
            <span
              key={tag}
              className="inline-flex items-center px-3 py-1 text-xs font-semibold uppercase tracking-wider bg-slate-100 text-slate-700 border border-slate-200"
            >
              {tag}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

