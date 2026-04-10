"use client";

import { useState, useRef, useEffect } from "react";
import { FilterConfig } from "@/types/vertical";

interface FilterBarProps {
  filters: FilterConfig[];
  activeFilters: Record<string, string[]>;  // multi-select: array of values
  onFilterChange: (filterId: string, values: string[]) => void;
  onClear: () => void;
}

export default function FilterBar({ filters, activeFilters, onFilterChange, onClear }: FilterBarProps) {
  const totalActive = Object.values(activeFilters).reduce((sum, vals) => sum + vals.length, 0);

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {filters.map((filter) => {
        if (filter.type === "date") {
          return (
            <div key={filter.id} className="flex items-center gap-1">
              <span className="text-xs text-gray-600">{filter.label}:</span>
              <select
                value={activeFilters[filter.id]?.[0] || ""}
                onChange={(e) => onFilterChange(filter.id, e.target.value ? [e.target.value] : [])}
                className="bg-gray-900 border border-gray-700 rounded-lg px-2 py-1 text-xs focus:outline-none focus:border-emerald-500 transition-colors"
              >
                <option value="">All time</option>
                <option value="7d">Last 7 days</option>
                <option value="30d">Last 30 days</option>
                <option value="90d">Last 90 days</option>
              </select>
            </div>
          );
        }

        if (filter.type === "select" && filter.options) {
          return (
            <MultiSelect
              key={filter.id}
              filter={filter}
              selected={activeFilters[filter.id] || []}
              onChange={(vals) => onFilterChange(filter.id, vals)}
            />
          );
        }

        return null;
      })}

      {totalActive > 0 && (
        <button
          onClick={onClear}
          className="text-xs text-gray-500 hover:text-red-400 transition-colors border border-gray-800 hover:border-red-800 px-2 py-1 rounded-lg"
        >
          Clear all ({totalActive})
        </button>
      )}
    </div>
  );
}

function MultiSelect({
  filter,
  selected,
  onChange,
}: {
  filter: FilterConfig;
  selected: string[];
  onChange: (vals: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const toggle = (val: string) => {
    if (selected.includes(val)) {
      onChange(selected.filter((v) => v !== val));
    } else {
      onChange([...selected, val]);
    }
  };

  const hasSelection = selected.length > 0;

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border transition-colors ${
          hasSelection
            ? "border-emerald-500 text-emerald-400 bg-emerald-900/10"
            : "border-gray-700 text-gray-400 hover:border-gray-600"
        }`}
      >
        <span>
          {hasSelection
            ? selected.length === 1
              ? selected[0]
              : `${filter.label}: ${selected.length} selected`
            : `${filter.label} ▾`}
        </span>
        {hasSelection && (
          <span
            onClick={(e) => { e.stopPropagation(); onChange([]); }}
            className="text-gray-500 hover:text-white ml-1"
          >
            ✕
          </span>
        )}
      </button>

      {open && (
        <div className="absolute top-full left-0 mt-1 bg-gray-900 border border-gray-700 rounded-xl shadow-xl z-50 min-w-[160px] overflow-hidden">
          {filter.options!.map((opt) => {
            const isSelected = selected.includes(opt);
            return (
              <button
                key={opt}
                onClick={() => toggle(opt)}
                className={`w-full text-left px-4 py-2 text-xs flex items-center gap-2 transition-colors ${
                  isSelected
                    ? "bg-emerald-900/30 text-emerald-400"
                    : "text-gray-300 hover:bg-gray-800"
                }`}
              >
                <span className={`w-3.5 h-3.5 rounded border flex items-center justify-center shrink-0 ${
                  isSelected ? "bg-emerald-500 border-emerald-500" : "border-gray-600"
                }`}>
                  {isSelected && <span className="text-white text-[8px]">✓</span>}
                </span>
                {opt}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
