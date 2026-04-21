import React, { useState, useEffect, useRef } from 'react';
import { Search, Loader2, MapPin } from 'lucide-react';

interface AddressSearchInputProps {
  value: string;
  onSelect: (address: string) => void;
  placeholder?: string;
  className?: string;
}

export const AddressSearchInput: React.FC<AddressSearchInputProps> = ({ 
  value, 
  onSelect, 
  placeholder = "Search address...", 
  className = "" 
}) => {
  const [inputValue, setInputValue] = useState(value);
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setInputValue(value);
  }, [value]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (!inputValue || inputValue.length < 3 || suggestions.some(s => s.description === inputValue)) {
      if (suggestions.some(s => s.description === inputValue)) {
         setShowDropdown(false);
      }
      return;
    }

    const handler = setTimeout(async () => {
      setIsLoading(true);
      try {
        const res = await fetch(`/api/autocomplete?input=${encodeURIComponent(inputValue)}`);
        const data = await res.json();
        if (Array.isArray(data)) {
          setSuggestions(data);
          setShowDropdown(data.length > 0);
        }
      } catch (err) {
        console.error("Autocomplete fetch error:", err);
      } finally {
        setIsLoading(false);
      }
    }, 300);

    return () => clearTimeout(handler);
  }, [inputValue]);

  return (
    <div ref={containerRef} className={`relative flex-1 ${className}`}>
      <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
        {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
      </div>
      <input
        type="text"
        value={inputValue}
        onChange={(e) => {
          setInputValue(e.target.value);
          setShowDropdown(true);
        }}
        onFocus={() => inputValue.length >= 3 && setShowDropdown(true)}
        placeholder={placeholder}
        className="w-full pl-10 pr-4 py-3 bg-white border border-gray-200 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-uh-yellow/50 transition-all shadow-sm"
      />
      
      {showDropdown && suggestions.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-gray-100 rounded-2xl shadow-2xl z-[1000] overflow-hidden max-h-60 overflow-y-auto">
          {suggestions.map((suggestion, idx) => (
            <button
              key={suggestion.place_id || idx}
              type="button"
              onClick={() => {
                onSelect(suggestion.description);
                setInputValue(suggestion.description);
                setShowDropdown(false);
              }}
              className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-uh-yellow/5 group transition-colors border-b last:border-0 border-gray-50"
            >
              <div className="w-8 h-8 rounded-full bg-gray-50 flex items-center justify-center group-hover:bg-uh-yellow/20 transition-colors">
                <MapPin className="w-4 h-4 text-gray-400 group-hover:text-uh-black transition-colors" />
              </div>
              <div className="flex flex-col min-w-0">
                <span className="text-sm font-bold text-uh-black truncate">{suggestion.description.split(',')[0]}</span>
                <span className="text-[10px] text-gray-400 truncate uppercase tracking-wider">{suggestion.description.split(',').slice(1).join(',').trim()}</span>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
