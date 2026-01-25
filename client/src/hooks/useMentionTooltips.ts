import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';

/**
 * Hook that adds tooltips and click handlers to mention elements
 * Processes all .mention-enhanced elements in the container
 */
export function useMentionTooltips(containerRef: React.RefObject<HTMLElement>) {
  const navigate = useNavigate();
  const tooltipRefs = useRef<Map<HTMLElement, { tooltip: HTMLDivElement; clickHandler: (e: MouseEvent) => void }>>(new Map());
  const handlersRef = useRef<Map<HTMLElement, { enter: (e: Event) => void; leave: (e: Event) => void }>>(new Map());

  useEffect(() => {
    if (!containerRef.current) return;

    const container = containerRef.current;
    
    const setupMentions = () => {
      const mentions = container.querySelectorAll('.mention-enhanced');
      
      // Remove old handlers for elements that no longer exist
      handlersRef.current.forEach((handlers, mention) => {
        if (!container.contains(mention)) {
          mention.removeEventListener('mouseenter', handlers.enter);
          mention.removeEventListener('mouseleave', handlers.leave);
          handlersRef.current.delete(mention);
          const tooltipData = tooltipRefs.current.get(mention);
          if (tooltipData) {
            if (tooltipData.tooltip.parentNode) {
              tooltipData.tooltip.remove();
            }
            tooltipRefs.current.delete(mention);
          }
        }
      });

      mentions.forEach(mention => {
        const mentionEl = mention as HTMLElement;
        // Skip if already has handlers
        if (handlersRef.current.has(mentionEl)) return;

        const handleMouseEnter = (e: Event) => {
          const mentionEl = e.currentTarget as HTMLElement;
          const fullName = mentionEl.getAttribute('data-full-name') || '';
          const relationship = mentionEl.getAttribute('data-relationship') || '';
          const characterId = mentionEl.getAttribute('data-character-id') || '';

          // Don't create duplicate tooltip
          if (tooltipRefs.current.has(mentionEl)) return;

          // Create tooltip element - matches AutoBio aesthetic
          const tooltip = document.createElement('div');
          tooltip.className = 'mention-tooltip-popup';
          tooltip.innerHTML = `
            <div class="tooltip-name">${fullName}</div>
            ${relationship ? `<div class="tooltip-relationship">${relationship}</div>` : ''}
            <div class="tooltip-arrow"></div>
          `;
          
          // Position tooltip relative to mention
          // Use fixed positioning relative to viewport for better reliability
          const rect = mentionEl.getBoundingClientRect();
          tooltip.style.position = 'fixed';
          tooltip.style.bottom = `${window.innerHeight - rect.top + 8}px`;
          tooltip.style.left = `${rect.left + rect.width / 2}px`;
          tooltip.style.transform = 'translateX(-50%)';
          tooltip.style.zIndex = '9999';
          
          // Append to body for fixed positioning to work correctly
          document.body.appendChild(tooltip);

          // Add click handler
          const handleClick = (e: MouseEvent) => {
            e.preventDefault();
            e.stopPropagation();
            navigate('/profile');
          };
          
          tooltip.addEventListener('click', handleClick);
          mentionEl.addEventListener('click', handleClick);
          
          tooltipRefs.current.set(mentionEl, { tooltip, clickHandler: handleClick });
        };

        const handleMouseLeave = (e: Event) => {
          const mentionEl = e.currentTarget as HTMLElement;
          const tooltipData = tooltipRefs.current.get(mentionEl);
          if (tooltipData) {
            tooltipData.tooltip.remove();
            tooltipRefs.current.delete(mentionEl);
          }
        };

        mentionEl.addEventListener('mouseenter', handleMouseEnter);
        mentionEl.addEventListener('mouseleave', handleMouseLeave);
        
        handlersRef.current.set(mentionEl, {
          enter: handleMouseEnter,
          leave: handleMouseLeave,
        });
      });
    };

    // Initial setup
    setupMentions();

    // Watch for new mentions (when content updates)
    const observer = new MutationObserver(setupMentions);
    observer.observe(container, { childList: true, subtree: true });

    return () => {
      observer.disconnect();
      handlersRef.current.forEach((handlers, mention) => {
        mention.removeEventListener('mouseenter', handlers.enter);
        mention.removeEventListener('mouseleave', handlers.leave);
      });
      tooltipRefs.current.forEach(({ tooltip }) => {
        if (tooltip.parentNode) {
          tooltip.remove();
        }
      });
      handlersRef.current.clear();
      tooltipRefs.current.clear();
    };
  }, [containerRef, navigate]);
}
