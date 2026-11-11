import { useQuery } from "@tanstack/react-query";
import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { tripQueryKeys } from "@/entities/trip";
import { tripApi } from "@/shared/api/tripApi";
import type { Place } from "@/shared/api/types";
import { cn } from "@/shared/lib/cn";
import { useDebouncedValue } from "@/shared/lib/useDebouncedValue";

const MINIMUM_QUERY_LENGTH = 2;
const SEARCH_DEBOUNCE_MILLISECONDS = 250;
const RESULT_LIMIT = 6;

interface PlaceSearchFieldProps {
  endpoint: "origin" | "destination";
  label: string;
  value: Place | null;
  onSelect: (place: Place | null) => void;
  isNextMapPick: boolean;
  errorId?: string;
  hasError?: boolean;
}

export function PlaceSearchField({
  endpoint,
  label,
  value,
  onSelect,
  isNextMapPick,
  errorId,
  hasError = false,
}: PlaceSearchFieldProps) {
  const listboxId = useId();
  const [inputText, setInputText] = useState(value?.label ?? "");
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const clearedByTypingRef = useRef(false);
  const debouncedQuery = useDebouncedValue(inputText.trim(), SEARCH_DEBOUNCE_MILLISECONDS);
  const shouldSearch =
    isOpen && debouncedQuery.length >= MINIMUM_QUERY_LENGTH && debouncedQuery !== value?.label;

  useEffect(() => {
    if (clearedByTypingRef.current) {
      clearedByTypingRef.current = false;
      return;
    }
    setInputText(value?.label ?? "");
  }, [value]);

  const { data, isFetching, isError } = useQuery({
    queryKey: tripQueryKeys.places(debouncedQuery),
    queryFn: ({ signal }) => tripApi.searchPlaces(debouncedQuery, RESULT_LIMIT, signal),
    enabled: shouldSearch,
    staleTime: Infinity,
  });
  const results = shouldSearch ? (data?.results ?? []) : [];
  const showListbox = isOpen && shouldSearch && (results.length > 0 || !isFetching);

  const choose = (place: Place) => {
    onSelect(place);
    setInputText(place.label);
    setIsOpen(false);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      setIsOpen(true);
      if (results.length === 0) return;
      const offset = event.key === "ArrowDown" ? 1 : -1;
      setActiveIndex((index) => (index + offset + results.length) % results.length);
    } else if (event.key === "Enter" && showListbox) {
      const activeResult = results[activeIndex];
      if (activeResult) {
        event.preventDefault();
        choose(activeResult);
      }
    } else if (event.key === "Escape") {
      setIsOpen(false);
      setInputText(value?.label ?? "");
    }
  };

  const optionId = (index: number) => `${listboxId}-option-${index}`;

  return (
    <div className="relative">
      <label
        className={cn(
          "flex items-center gap-2.5 rounded-control border bg-raised px-3 py-2.5 transition duration-150 focus-within:border-accent focus-within:bg-accent-soft",
          hasError ? "border-risk-severe" : "border-line",
          isNextMapPick && !value && "border-dashed border-accent",
        )}
      >
        <span
          aria-hidden="true"
          className={cn(
            "size-2.5 flex-none",
            endpoint === "origin"
              ? "rounded-full border-[2.5px] border-accent"
              : "rounded-[3px] bg-accent",
          )}
        />
        <span className="sr-only">{label}</span>
        <input
          role="combobox"
          aria-expanded={showListbox}
          aria-controls={listboxId}
          aria-autocomplete="list"
          aria-activedescendant={
            showListbox && results.length > 0 ? optionId(activeIndex) : undefined
          }
          aria-invalid={hasError || undefined}
          aria-describedby={hasError ? errorId : undefined}
          value={inputText}
          placeholder={
            endpoint === "origin" ? "Origin city or address" : "Destination city or address"
          }
          onChange={(event) => {
            setInputText(event.target.value);
            setActiveIndex(0);
            setIsOpen(true);
            if (value) {
              clearedByTypingRef.current = true;
              onSelect(null);
            }
          }}
          onFocus={() => setIsOpen(true)}
          onBlur={() => window.setTimeout(() => setIsOpen(false), 120)}
          onKeyDown={handleKeyDown}
          className="min-w-0 flex-1 bg-transparent pr-8 text-sm font-medium outline-none placeholder:text-muted"
        />
      </label>
      {showListbox && (
        <ul
          id={listboxId}
          role="listbox"
          aria-label={`${label} suggestions`}
          className="glass absolute inset-x-0 top-[calc(100%+4px)] z-30 max-h-64 overflow-auto p-1"
        >
          {results.length === 0 && (
            <li role="presentation" className="px-3 py-2 text-xs text-muted">
              {isError ? "Place search is unavailable right now." : "No matching places."}
            </li>
          )}
          {results.map((place, index) => (
            <li
              key={`${place.label}-${place.latitude}-${place.longitude}`}
              id={optionId(index)}
              role="option"
              aria-selected={index === activeIndex}
              onMouseDown={(event) => {
                event.preventDefault();
                choose(place);
              }}
              onMouseEnter={() => setActiveIndex(index)}
              className={cn(
                "cursor-pointer rounded-lg px-3 py-2 text-sm",
                index === activeIndex ? "bg-hover text-ink" : "text-muted",
              )}
            >
              {place.label}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
