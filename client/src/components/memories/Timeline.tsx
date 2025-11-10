import { format, differenceInDays, addDays } from 'date-fns';
import { useState, useEffect, useMemo } from 'react';
import { IMemory } from '@shared/types/Memory';
import { MemoryImage } from './MemoryImage';

interface TimelineProps {
  memories: IMemory[];
  currentIndex: number;
  onSelect: (index: number) => void;
}

export function Timeline({ memories, currentIndex, onSelect }: TimelineProps) {
  const [timelinePoints, setTimelinePoints] = useState<Date[]>([]);
  const [hoveredMemory, setHoveredMemory] = useState<IMemory | null>(null);

  // Sort memories chronologically (oldest first) for rainbow gradient
  // Memoize to prevent infinite loops
  const sortedMemories = useMemo(() => {
    return [...memories].sort((a, b) => 
      new Date(a.date).getTime() - new Date(b.date).getTime()
    );
  }, [memories]);

  useEffect(() => {
    if (!sortedMemories.length) return;

    // Calculate date range
    const dates = sortedMemories.map(m => new Date(m.date));
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
  }, [sortedMemories]);

  const getMemoryPosition = (date: Date) => {
    if (!timelinePoints.length) return 0;
    const start = timelinePoints[0].getTime();
    const end = timelinePoints[timelinePoints.length - 1].getTime();
    const memoryTime = date.getTime();
    return ((memoryTime - start) / (end - start)) * 100;
  };

  // Generate rainbow color based on chronological position (subdued/muted)
  const getChronologicalColor = (index: number, total: number): string => {
    if (total === 0) return '#5b7fb8';
    
    // Calculate position from 0 to 1
    const position = total === 1 ? 0 : index / (total - 1);
    
    // Subdued rainbow colors - reduced saturation and slightly darkened
    // Mixing vibrant colors with gray to create more muted tones
    const rainbowColors = [
      { r: 200, g: 80, b: 100 },   // muted red
      { r: 200, g: 130, b: 80 },   // muted orange
      { r: 200, g: 170, b: 100 },  // muted yellow
      { r: 100, g: 180, b: 140 },  // muted green
      { r: 100, g: 140, b: 200 },  // muted blue
      { r: 120, g: 120, b: 200 },  // muted indigo
      { r: 150, g: 120, b: 200 },  // muted purple
      { r: 200, g: 100, b: 140 },  // muted pink
    ];
    
    // Map position (0-1) to color index (0-7)
    const colorIndex = position * (rainbowColors.length - 1);
    const lowerIndex = Math.floor(colorIndex);
    const upperIndex = Math.min(lowerIndex + 1, rainbowColors.length - 1);
    const blend = colorIndex - lowerIndex;
    
    // Interpolate between two colors
    const lowerColor = rainbowColors[lowerIndex];
    const upperColor = rainbowColors[upperIndex];
    
    const r = Math.round(lowerColor.r + (upperColor.r - lowerColor.r) * blend);
    const g = Math.round(lowerColor.g + (upperColor.g - lowerColor.g) * blend);
    const b = Math.round(lowerColor.b + (upperColor.b - lowerColor.b) * blend);
    
    return `rgb(${r}, ${g}, ${b})`;
  };

  return (
    <div className="relative w-full h-32 bg-slate-100 border border-slate-200">
      {/* Timeline line */}
      <div className="absolute inset-0 flex items-center">
        <div className="w-full h-1 bg-slate-300" />
      </div>

      {/* Timeline points */}
      <div className="absolute inset-0 flex items-center">
        {timelinePoints.map((date, _index) => (
          <div
            key={date.toISOString()}
            className="relative flex-1 flex flex-col items-center"
          >
            <div className="w-1 h-6 bg-slate-400" />
            <span className="text-xs font-medium text-slate-500 uppercase tracking-wider mt-2">
              {format(date, 'MMM d')}
            </span>
          </div>
        ))}
      </div>

      {/* Memory markers - colorful, chronological rainbow */}
      {sortedMemories.map((memory, index) => {
        const date = new Date(memory.date);
        const percentage = getMemoryPosition(date);
        const isActive = memories[currentIndex]?._id === memory._id;
        // Get color based on chronological position (oldest = red, newest = pink)
        const memoryColor = getChronologicalColor(index, sortedMemories.length);
        
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
              className="relative w-4 h-4 cursor-pointer"
            >
              <div 
                className="absolute inset-0 rounded-full border-2 border-slate-900 transition-all duration-150"
                style={{ 
                  backgroundColor: isActive ? memoryColor : 'transparent',
                  borderColor: memoryColor,
                  transform: isActive ? 'scale(1.5)' : 'scale(1)',
                }}
              />
            </div>
            
            {/* Hover preview - sharp, minimal */}
            {hoveredMemory?._id === memory._id && (
              <div className="fixed bottom-full left-1/2 -translate-x-1/2 mb-3 w-56 bg-white border-2 border-slate-900 p-4 z-50">
                <h3 className="text-sm font-semibold text-slate-900 mb-1 truncate tracking-tight">{memory.title}</h3>
                <time className="text-xs font-medium text-slate-500 uppercase tracking-wider block mb-3">
                  {format(new Date(memory.date), 'MMM d, yyyy')}
                </time>
                {memory.images.length > 0 && (
                  <div className="border-2 border-slate-200">
                    <MemoryImage
                      src={memory.images[0].url}
                      alt={memory.title}
                      className="w-full h-20 object-cover"
                    />
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
} 