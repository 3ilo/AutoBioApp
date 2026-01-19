import { forwardRef, useEffect, useImperativeHandle, useState } from 'react';
import { ICharacter } from '../../types/character';

export interface MentionSuggestionProps {
  items: ICharacter[];
  command: (item: { id: string; label: string }) => void;
}

export interface MentionSuggestionRef {
  onKeyDown: (event: { event: KeyboardEvent }) => boolean;
}

export const MentionSuggestion = forwardRef<MentionSuggestionRef, MentionSuggestionProps>(
  ({ items, command }, ref) => {
    const [selectedIndex, setSelectedIndex] = useState(0);

    const selectItem = (index: number) => {
      const item = items[index];
      if (item) {
        command({
          id: item._id,
          label: `${item.firstName} ${item.lastName}`,
        });
      }
    };

    const upHandler = () => {
      setSelectedIndex((selectedIndex + items.length - 1) % items.length);
    };

    const downHandler = () => {
      setSelectedIndex((selectedIndex + 1) % items.length);
    };

    const enterHandler = () => {
      selectItem(selectedIndex);
    };

    useEffect(() => {
      setSelectedIndex(0);
    }, [items]);

    useImperativeHandle(ref, () => ({
      onKeyDown: ({ event }: { event: KeyboardEvent }) => {
        if (event.key === 'ArrowUp') {
          upHandler();
          return true;
        }

        if (event.key === 'ArrowDown') {
          downHandler();
          return true;
        }

        if (event.key === 'Enter') {
          enterHandler();
          return true;
        }

        return false;
      },
    }));

    if (items.length === 0) {
      return (
        <div className="bg-white border border-slate-200 rounded-md shadow-lg p-3 text-sm text-slate-500">
          No characters found
        </div>
      );
    }

    return (
      <div className="bg-white border border-slate-200 rounded-md shadow-lg overflow-hidden max-h-48 overflow-y-auto">
        {items.map((item, index) => (
          <button
            key={item._id}
            onClick={() => selectItem(index)}
            className={`w-full flex items-center gap-3 px-3 py-2 text-left text-sm ${
              index === selectedIndex
                ? 'bg-indigo-50 text-indigo-700'
                : 'text-slate-700 hover:bg-slate-50'
            }`}
          >
            <div className="h-8 w-8 rounded-full bg-slate-200 flex items-center justify-center text-xs font-medium text-slate-600">
              {item.firstName.charAt(0)}{item.lastName.charAt(0)}
            </div>
            <div>
              <div className="font-medium">
                {item.firstName} {item.lastName}
              </div>
              {item.relationship && (
                <div className="text-xs text-slate-500">{item.relationship}</div>
              )}
            </div>
          </button>
        ))}
      </div>
    );
  }
);

MentionSuggestion.displayName = 'MentionSuggestion';
