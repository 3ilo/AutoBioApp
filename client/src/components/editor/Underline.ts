import { Mark, mergeAttributes, type RawCommands } from '@tiptap/core';

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    underline: {
      toggleUnderline: () => ReturnType;
    };
  }
}

export const Underline = Mark.create({
  name: 'underline',

  parseHTML() {
    return [
      {
        tag: 'u',
      },
      {
        style: 'text-decoration',
        getAttrs: (value) => value === 'underline' && null,
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return ['u', mergeAttributes(HTMLAttributes), 0];
  },

  addCommands(): Partial<RawCommands> {
    return {
      toggleUnderline: () => ({ commands }) => {
        return commands.toggleMark(this.name);
      },
    };
  },
});

