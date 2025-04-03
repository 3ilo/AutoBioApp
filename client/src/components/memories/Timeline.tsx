import { format, differenceInDays, addDays } from 'date-fns';
import { useState, useEffect } from 'react';
import { IMemory } from '@shared/types/Memory';

interface TimelineProps {
  memories: IMemory[];
  currentIndex: number;
  onSelect: (index: number) => void;
}

export function Timeline({ memories, currentIndex, onSelect }: TimelineProps) {
  const [timelinePoints, setTimelinePoints] = useState<Date[]>([]);
  const [hoveredMemory, setHoveredMemory] = useState<IMemory | null>(null);

  useEffect(() => {
    if (!memories.length) return;

    // Calculate date range
    const dates = memories.map(m => new Date(m.date));
    const minDate = new Date(Math.min(...dates.map(d => d.getTime())));
    const maxDate = new Date(Math.max(...dates.map(d => d.getTime())));
    const totalDays = differenceInDays(maxDate, minDate);

    // Calculate number of points based on viewport width
    const viewportWidth = window.innerWidth;
    const pointsCount = Math.max(5, Math.min(20, Math.floor(viewportWidth / 100)));
    const interval = Math.ceil(totalDays / (pointsCount - 1));

    // Generate timeline points
    const points = Array.from({ length: pointsCount }, (_, i) => 
      addDays(minDate, i * interval)
    );

    setTimelinePoints(points);
  }, [memories]);

  const getMemoryPosition = (date: Date) => {
    if (!timelinePoints.length) return 0;
    const start = timelinePoints[0].getTime();
    const end = timelinePoints[timelinePoints.length - 1].getTime();
    const memoryTime = date.getTime();
    return ((memoryTime - start) / (end - start)) * 100;
  };

  return (
    <div className="relative w-full h-24 bg-gray-100 rounded-lg">
      {/* Timeline line */}
      <div className="absolute inset-0 flex items-center">
        <div className="w-full h-0.5 bg-gray-300" />
      </div>

      {/* Timeline points */}
      <div className="absolute inset-0 flex items-center">
        {timelinePoints.map((date, index) => (
          <div
            key={date.toISOString()}
            className="relative flex-1 flex flex-col items-center"
          >
            <div className="w-0.5 h-4 bg-gray-400" />
            <span className="text-xs text-gray-500 mt-1">
              {format(date, 'MMM d')}
            </span>
          </div>
        ))}
      </div>

      {/* Memory markers */}
      {memories.map((memory) => {
        const date = new Date(memory.date);
        const percentage = getMemoryPosition(date);
        
        return (
          <div
            key={memory._id}
            className="absolute top-1/2 -translate-y-1/2 group"
            style={{ left: `${percentage}%` }}
          >
            <div
              onClick={() => onSelect(memories.findIndex(m => m._id === memory._id))}
              onMouseEnter={() => setHoveredMemory(memory)}
              onMouseLeave={() => setHoveredMemory(null)}
              className="relative w-2 h-2 cursor-pointer"
            >
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-[8px] h-[5px] rounded-full bg-gray-400 group-hover:bg-gray-600 transition-colors" />
              </div>
            </div>
            
            {/* Hover preview */}
            {hoveredMemory?._id === memory._id && (
              <div className="fixed bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 bg-white rounded-lg shadow-lg p-3 z-50">
                <h3 className="text-sm font-medium text-gray-900 mb-1 truncate">{memory.title}</h3>
                <time className="text-xs text-gray-500">
                  {format(new Date(memory.date), 'MMM d, yyyy')}
                </time>
                {memory.images.length > 0 && (
                  <img
                    src={memory.images[0].url}
                    alt={memory.title}
                    className="w-full h-16 object-cover rounded mt-2"
                  />
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
} 