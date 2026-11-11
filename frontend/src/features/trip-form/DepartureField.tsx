import { useId } from "react";
import {
  formatTimeZoneName,
  fromDateTimeInputValue,
  nextWholeHour,
  toDateTimeInputValue,
} from "@/shared/lib/format";
import { cn } from "@/shared/lib/cn";
import { FieldError } from "./FieldError";

interface DepartureFieldProps {
  departure: Date;
  onChange: (departure: Date) => void;
  error: string | undefined;
}

export function DepartureField({ departure, onChange, error }: DepartureFieldProps) {
  const inputId = useId();
  const errorId = useId();

  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between">
        <label htmlFor={inputId} className="text-[11px] text-muted">
          Departure <span className="font-mono">({formatTimeZoneName(departure)})</span>
        </label>
        <button
          type="button"
          onClick={() => onChange(nextWholeHour())}
          className="text-[11px] font-semibold text-accent hover:underline"
        >
          Next hour
        </button>
      </div>
      <input
        id={inputId}
        type="datetime-local"
        value={toDateTimeInputValue(departure)}
        onChange={(event) => {
          const parsed = fromDateTimeInputValue(event.target.value);
          if (parsed) onChange(parsed);
        }}
        aria-invalid={Boolean(error) || undefined}
        aria-describedby={error ? errorId : undefined}
        className={cn(
          "w-full rounded-control border bg-raised px-3 py-2 font-mono text-[13px] font-medium outline-none transition focus:border-accent",
          error ? "border-risk-severe" : "border-line",
        )}
      />
      <FieldError id={errorId} message={error} />
    </div>
  );
}
