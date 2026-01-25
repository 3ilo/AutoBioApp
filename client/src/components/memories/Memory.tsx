import { format } from 'date-fns';
import { IMemory, IMemoryImage } from '@shared/types/Memory';
import DOMPurify from 'dompurify';
import { MemoryImage } from './MemoryImage';
import { useMemo, useState, useEffect, useRef } from 'react';
import { characterApi } from '../../services/api';
import { getFirstName } from '../../utils/mentionProcessor';
import { ICharacter } from '../../types/character';
import { useMentionTooltips } from '../../hooks/useMentionTooltips';
import logger from '../../utils/logger';

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
 * Process mentions in HTML to show first name only and add tooltip data
 */
function processMentions(html: string, characterMap: Map<string, ICharacter>): string {
  // Match span with mention class, extract data-id and data-label in any order
  return html.replace(
    /<span([^>]*class="[^"]*mention[^"]*"[^>]*)>([^<]*)<\/span>/g,
    (match, attrs) => {
      // Extract data-id and data-label from attributes (order-independent)
      const idMatch = attrs.match(/data-id="([^"]+)"/);
      const labelMatch = attrs.match(/data-label="([^"]+)"/);
      
      if (!idMatch || !labelMatch) {
        // Not a mention with required attributes, return as-is
        return match;
      }
      
      const characterId = idMatch[1];
      const fullName = labelMatch[1];
      const character = characterMap.get(characterId);
      const firstName = getFirstName(fullName);
      const relationship = character?.relationship || '';
      
      // Escape HTML in data attributes
      const escapedFullName = fullName.replace(/"/g, '&quot;');
      const escapedRelationship = relationship.replace(/"/g, '&quot;');
      
      // Create enhanced mention with data attributes
      // Store full name and relationship separately for CSS tooltip
      const newAttrs = attrs
        .replace(/class="([^"]*)"/, `class="$1 mention-enhanced"`)
        + ` data-full-name="${escapedFullName}"`
        + (relationship ? ` data-relationship="${escapedRelationship}"` : '')
        + ` data-character-id="${characterId}"`;
      
      return `<span${newAttrs}>${firstName}</span>`;
    }
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
  const [characterMap, setCharacterMap] = useState<Map<string, ICharacter>>(new Map());
  const contentWrapperRef = useRef<HTMLDivElement>(null);
  
  // Add tooltips to mentions
  useMentionTooltips(contentWrapperRef);

  // Load character data for mentions
  useEffect(() => {
    const loadMentionCharacters = async () => {
      // Extract all character IDs from content
      const mentionMatches = memory.content.matchAll(/data-id="([^"]+)"/g);
      const characterIds = Array.from(mentionMatches, m => m[1]);
      
      if (characterIds.length === 0) return;
      
      const loadedCharacters = new Map<string, ICharacter>();
      for (const id of characterIds) {
        if (!characterMap.has(id)) {
          try {
            const response = await characterApi.getById(id);
            loadedCharacters.set(id, response.data.character);
          } catch (error) {
            // Character not found, skip
            logger.debug('Character not found for mention', { characterId: id });
          }
        }
      }
      
      if (loadedCharacters.size > 0) {
        const merged = new Map(characterMap);
        loadedCharacters.forEach((char, id) => merged.set(id, char));
        setCharacterMap(merged);
      }
    };
    
    loadMentionCharacters();
  }, [memory.content, characterMap]);

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
    // Process mentions BEFORE sanitizing to preserve data attributes
    let processed = processMentions(memory.content, characterMap);
    
    if (allImages.length === 0) {
      let sanitized = cleanMentionSymbols(DOMPurify.sanitize(processed, {
        ALLOW_DATA_ATTR: true,
        ALLOWED_ATTR: ['class', 'data-id', 'data-label', 'data-type', 'data-full-name', 'data-relationship', 'data-character-id'],
      }));
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
      let sanitized = cleanMentionSymbols(DOMPurify.sanitize(processed, {
        ALLOW_DATA_ATTR: true,
        ALLOWED_ATTR: ['class', 'data-id', 'data-label', 'data-type', 'data-full-name', 'data-relationship', 'data-character-id'],
      }));
      setContentNodes([<div key="content" dangerouslySetInnerHTML={{ __html: sanitized }} />]);
      return;
    }

    // Distribute images across paragraphs
    const imagesPerParagraph = Math.max(1, Math.floor(paragraphs.length / allImages.length));
    const nodes: React.ReactNode[] = [];
    let imageIndex = 0;

    paragraphs.forEach((paragraph, index) => {
      // Add paragraph - process mentions first, then sanitize
      const paragraphHtml = paragraph.outerHTML;
      let paragraphProcessed = processMentions(paragraphHtml, characterMap);
      let sanitized = cleanMentionSymbols(DOMPurify.sanitize(paragraphProcessed, {
        ALLOW_DATA_ATTR: true,
        ALLOWED_ATTR: ['class', 'data-id', 'data-label', 'data-type', 'data-full-name', 'data-relationship', 'data-character-id'],
      }));
      
      // Check if paragraph is empty (just whitespace, <br>, or empty)
      const textContent = paragraph.textContent?.trim() || '';
      const innerHTML = paragraph.innerHTML.trim();
      const isEmpty = textContent === '' && (innerHTML === '' || innerHTML === '<br>' || innerHTML === '<br/>');
      
      // Render paragraph with spacing - empty paragraphs create line breaks
      // Add margin-bottom to all paragraphs for spacing, extra height for empty ones
      // Use !important to override prose styles if needed
      nodes.push(
        <div 
          key={`para-${index}`}
          className={`!mb-4 ${isEmpty ? '!h-4 !min-h-[1rem] block' : ''}`}
          style={isEmpty ? { marginBottom: '1rem', minHeight: '1rem', display: 'block' } : { marginBottom: '1rem' }}
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
  }, [memory.content, allImages, characterMap]);

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
      <div className="memory-content-wrapper" ref={contentWrapperRef}>
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

