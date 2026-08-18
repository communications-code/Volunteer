import * as React from "react";
import { format, parse, isValid } from "date-fns";
import { CalendarIcon, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

interface DatePickerProps {
  value?: string;                    // "YYYY-MM-DD" string (matches form state)
  onChange?: (value: string) => void; // returns "YYYY-MM-DD" string
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

/**
 * Hybrid date picker: type a date directly OR click the calendar icon to pick.
 * Accepts common formats: MM/DD/YYYY, M/D/YYYY, MM-DD-YYYY, YYYY-MM-DD
 */
export function DatePicker({
  value,
  onChange,
  placeholder = "MM/DD/YYYY",
  className,
  disabled,
}: DatePickerProps) {
  const [open, setOpen] = React.useState(false);
  const [inputValue, setInputValue] = React.useState("");
  const inputRef = React.useRef<HTMLInputElement>(null);

  // Convert stored "YYYY-MM-DD" to display format "MM/DD/YYYY" when value changes externally
  React.useEffect(() => {
    if (!value) {
      setInputValue("");
      return;
    }
    try {
      const d = parse(value, "yyyy-MM-dd", new Date());
      if (isValid(d)) {
        setInputValue(format(d, "MM/dd/yyyy"));
      }
    } catch {
      // leave input as-is if value is unparseable
    }
  }, [value]);

  // Convert "YYYY-MM-DD" string to Date object for the calendar
  const dateValue = React.useMemo(() => {
    if (!value) return undefined;
    try {
      const d = parse(value, "yyyy-MM-dd", new Date());
      return isValid(d) ? d : undefined;
    } catch {
      return undefined;
    }
  }, [value]);

  // Try to parse what the user typed into a valid date
  const tryParseInput = (text: string): Date | null => {
    const trimmed = text.trim();
    if (!trimmed) return null;

    // Try common formats
    const formats = ["MM/dd/yyyy", "M/d/yyyy", "MM-dd-yyyy", "M-d-yyyy", "yyyy-MM-dd"];
    for (const fmt of formats) {
      try {
        const d = parse(trimmed, fmt, new Date());
        if (isValid(d) && d.getFullYear() > 1900 && d.getFullYear() < 2100) return d;
      } catch {
        // try next format
      }
    }
    return null;
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    setInputValue(raw);

    // Live-parse: if it looks complete, update the form value
    const parsed = tryParseInput(raw);
    if (parsed) {
      onChange?.(format(parsed, "yyyy-MM-dd"));
    }
  };

  const handleInputBlur = () => {
    const parsed = tryParseInput(inputValue);
    if (parsed) {
      const formatted = format(parsed, "yyyy-MM-dd");
      onChange?.(formatted);
      setInputValue(format(parsed, "MM/dd/yyyy"));
    } else if (inputValue.trim() === "") {
      onChange?.("");
    } else {
      // Invalid input — revert to last valid value
      if (value) {
        try {
          const d = parse(value, "yyyy-MM-dd", new Date());
          if (isValid(d)) setInputValue(format(d, "MM/dd/yyyy"));
        } catch {
          setInputValue("");
        }
      } else {
        setInputValue("");
      }
    }
  };

  const handleCalendarSelect = (date: Date | undefined) => {
    if (date) {
      onChange?.(format(date, "yyyy-MM-dd"));
      setInputValue(format(date, "MM/dd/yyyy"));
    } else {
      onChange?.("");
      setInputValue("");
    }
    setOpen(false);
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange?.("");
    setInputValue("");
    inputRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleInputBlur();
    }
  };

  return (
    <div className={cn("relative flex items-center", className)}>
      <input
        ref={inputRef}
        type="text"
        value={inputValue}
        onChange={handleInputChange}
        onBlur={handleInputBlur}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        disabled={disabled}
        className={cn(
          "flex h-8 w-full rounded-md border border-input bg-background px-3 pr-16 py-1 text-sm shadow-sm transition-colors",
          "file:border-0 file:bg-transparent file:text-sm file:font-medium",
          "placeholder:text-muted-foreground",
          "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
          "disabled:cursor-not-allowed disabled:opacity-50",
        )}
      />
      <div className="absolute right-1 flex items-center gap-0.5">
        {inputValue && (
          <button
            type="button"
            onClick={handleClear}
            className="p-0.5 rounded-sm text-muted-foreground hover:text-foreground transition-colors"
            tabIndex={-1}
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={disabled}
              className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground"
              tabIndex={-1}
            >
              <CalendarIcon className="h-3.5 w-3.5" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="end">
            <Calendar
              mode="single"
              selected={dateValue}
              onSelect={handleCalendarSelect}
              defaultMonth={dateValue}
              initialFocus
            />
          </PopoverContent>
        </Popover>
      </div>
    </div>
  );
}
