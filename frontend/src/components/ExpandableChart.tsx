import { useState } from 'react';
import { Maximize2, X } from 'lucide-react';

interface ExpandableChartProps {
  children: React.ReactNode;
  title?: string;
  minHeight?: string;
}

export default function ExpandableChart({ children, title, minHeight = 'min-h-[300px]' }: ExpandableChartProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const px = parseInt(minHeight.match(/\d+/)?.[0] ?? '300', 10);

  return (
    <>
      <div className="relative group w-full" style={{ height: `${px}px` }}>
        <button
          onClick={() => setIsExpanded(true)}
          className="absolute top-2 right-2 z-10 p-1.5 rounded-xl
                     bg-gray-100 hover:bg-gray-200
                     opacity-0 group-hover:opacity-100 max-lg:opacity-100 transition-opacity
                     cursor-pointer border border-gray-200"
          title="Развернуть график"
        >
          <Maximize2 className="w-4 h-4 text-gray-500" />
        </button>
        <div className="cursor-pointer h-full" onClick={() => setIsExpanded(true)}>
          {children}
        </div>
      </div>

      {isExpanded && (
        <div
          className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-8"
          onClick={() => setIsExpanded(false)}
        >
          <div
            className="relative w-full max-w-[90vw] max-h-[90vh] bg-white border border-gray-200 rounded-3xl p-6 overflow-auto shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              {title && (
                <h3 className="text-lg font-extrabold text-[#333333] tracking-tight">{title}</h3>
              )}
              <button
                onClick={() => setIsExpanded(false)}
                className="p-1.5 rounded-xl hover:bg-gray-100 transition-colors ml-auto"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            <div className="w-full h-[75vh]">
              {children}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
