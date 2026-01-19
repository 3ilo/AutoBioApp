import { ReactRenderer } from '@tiptap/react';
import tippy, { Instance as TippyInstance } from 'tippy.js';
import { MentionSuggestion, MentionSuggestionRef } from './MentionSuggestion';
import { ICharacter } from '../../types/character';
import { SuggestionOptions, SuggestionProps } from '@tiptap/suggestion';

export interface MentionSuggestionConfigOptions {
  characters: ICharacter[];
}

export function createMentionSuggestionConfig(
  options: MentionSuggestionConfigOptions
): Omit<SuggestionOptions, 'editor'> {
  return {
    items: ({ query }: { query: string }) => {
      const searchTerm = query.toLowerCase();
      return options.characters
        .filter(character => {
          const fullName = `${character.firstName} ${character.lastName}`.toLowerCase();
          return fullName.includes(searchTerm);
        })
        .slice(0, 5);
    },

    render: () => {
      let component: ReactRenderer<MentionSuggestionRef> | null = null;
      let popup: TippyInstance[] | null = null;

      return {
        onStart: (props: SuggestionProps<ICharacter>) => {
          component = new ReactRenderer(MentionSuggestion, {
            props,
            editor: props.editor,
          });

          if (!props.clientRect) {
            return;
          }

          popup = tippy('body', {
            getReferenceClientRect: props.clientRect as () => DOMRect,
            appendTo: () => document.body,
            content: component.element,
            showOnCreate: true,
            interactive: true,
            trigger: 'manual',
            placement: 'bottom-start',
          });
        },

        onUpdate(props: SuggestionProps<ICharacter>) {
          component?.updateProps(props);

          if (!props.clientRect) {
            return;
          }

          popup?.[0]?.setProps({
            getReferenceClientRect: props.clientRect as () => DOMRect,
          });
        },

        onKeyDown(props: { event: KeyboardEvent }) {
          if (props.event.key === 'Escape') {
            popup?.[0]?.hide();
            return true;
          }

          return component?.ref?.onKeyDown(props) ?? false;
        },

        onExit() {
          popup?.[0]?.destroy();
          component?.destroy();
        },
      };
    },
  };
}
