'use client';

import React, { useState } from 'react';
import { DayPicker } from 'react-day-picker';
import { th } from 'date-fns/locale';
import { format, parse, isValid } from 'date-fns';
import { CalendarIcon, ClockIcon } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';

const HOURS = Array.from({ length: 24 }, (_, i) => i);
const MINUTES = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55];

export interface DateTimePickerProps {
  /** YYYY-MM-DD */
  dateValue: string;
  /** HH:mm */
  timeValue: string;
  onDateChange: (v: string) => void;
  onTimeChange: (v: string) => void;
  /** unused — kept for API compatibility */
  placeholder?: string;
  accent?: 'orange' | 'green';
  disabled?: boolean;
}

function toThaiDisplay(dateStr: string): string | null {
  if (!dateStr) return null;
  const d = parse(dateStr, 'yyyy-MM-dd', new Date());
  if (!isValid(d)) return null;
  return `${format(d, 'dd')}/${format(d, 'MM')}/${d.getFullYear() + 543}`;
}

export function DateTimePicker({
  dateValue,
  timeValue,
  onDateChange,
  onTimeChange,
  accent = 'orange',
  disabled,
}: DateTimePickerProps) {
  const [calOpen, setCalOpen] = useState(false);
  const [timeOpen, setTimeOpen] = useState(false);

  const selectedDate = dateValue ? parse(dateValue, 'yyyy-MM-dd', new Date()) : undefined;
  const validDate = selectedDate && isValid(selectedDate) ? selectedDate : undefined;

  const timeParts = timeValue ? timeValue.split(':').map(Number) : [8, 0];
  const selHour = timeParts[0] ?? 8;
  const selMinute = Math.round((timeParts[1] ?? 0) / 5) * 5 % 60;

  const handleDay = (day: Date | undefined) => {
    if (!day) return;
    onDateChange(format(day, 'yyyy-MM-dd'));
    setCalOpen(false); // auto-close calendar after picking date
  };

  const handleHour = (h: number) =>
    onTimeChange(`${String(h).padStart(2, '0')}:${String(selMinute).padStart(2, '0')}`);

  const handleMinute = (m: number) =>
    onTimeChange(`${String(selHour).padStart(2, '0')}:${String(m).padStart(2, '0')}`);

  const thaiDisplay = toThaiDisplay(dateValue);
  const isOrange = accent === 'orange';

  const activeCls = isOrange
    ? 'bg-orange-600 text-white hover:bg-orange-700'
    : 'bg-green-600 text-white hover:bg-green-700';

  const triggerRing = isOrange
    ? 'hover:border-orange-300 focus-visible:ring-orange-200 focus-visible:border-orange-400 data-[state=open]:border-orange-500 data-[state=open]:ring-2 data-[state=open]:ring-orange-200'
    : 'hover:border-green-300 focus-visible:ring-green-200 focus-visible:border-green-400 data-[state=open]:border-green-500 data-[state=open]:ring-2 data-[state=open]:ring-green-200';

  // z-[2000] beats Leaflet map layers (z-1000) + form overlay (z-1001)
  const popoverCls = 'z-[2000] p-0 overflow-hidden shadow-2xl rounded-xl border border-gray-200 bg-white w-auto';

  return (
    <div className="flex gap-2">
      {/* ─────────── วันที่ ─────────── */}
      <Popover open={calOpen} onOpenChange={setCalOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            disabled={disabled}
            data-state={calOpen ? 'open' : 'closed'}
            className={cn(
              'flex-1 min-w-0 flex items-center gap-2 px-2.5 py-2 rounded-lg border border-gray-200 bg-white text-[13px] transition-all focus-visible:outline-none focus-visible:ring-2',
              thaiDisplay ? 'text-gray-900 font-semibold' : 'text-gray-400',
              triggerRing,
            )}
          >
            <CalendarIcon className={cn('w-3.5 h-3.5 shrink-0', thaiDisplay ? (isOrange ? 'text-orange-500' : 'text-green-500') : 'text-gray-400')} />
            <span className="truncate tabular-nums">{thaiDisplay ?? 'วันที่'}</span>
          </button>
        </PopoverTrigger>

        <PopoverContent
          className={popoverCls}
          align="start"
          sideOffset={6}
          onMouseDown={e => e.stopPropagation()}
          onClick={e => e.stopPropagation()}
        >
          <div className="px-2 pt-2 pb-2">
            <DayPicker
              mode="single"
              selected={validDate}
              onSelect={handleDay}
              locale={th}
              weekStartsOn={0}
              showOutsideDays
              formatters={{
                formatCaption: (date) =>
                  `${date.toLocaleString('th-TH', { month: 'long' })} ${date.getFullYear() + 543}`,
              }}
              classNames={{
                root: 'text-sm select-none',
                months: 'flex',
                month: 'w-full',
                nav: 'absolute inset-x-0 top-0 flex items-center justify-between px-1',
                button_previous: 'h-7 w-7 flex items-center justify-center rounded-md text-gray-500 hover:bg-gray-100 transition-colors',
                button_next: 'h-7 w-7 flex items-center justify-center rounded-md text-gray-500 hover:bg-gray-100 transition-colors',
                month_caption: 'relative flex justify-center items-center h-9 mb-1 text-sm font-semibold text-gray-800',
                table: 'w-full border-collapse',
                weekdays: 'flex',
                weekday: 'flex-1 text-center text-[11px] font-medium text-gray-400 py-1',
                week: 'flex mt-1',
                day: 'flex-1 flex items-center justify-center',
                day_button: cn(
                  'h-8 w-8 rounded-full text-[13px] font-medium transition-all cursor-pointer hover:bg-gray-100',
                  isOrange
                    ? 'aria-selected:bg-orange-600 aria-selected:text-white aria-selected:hover:bg-orange-700'
                    : 'aria-selected:bg-green-600 aria-selected:text-white aria-selected:hover:bg-green-700',
                ),
                today: isOrange ? 'text-orange-600 font-bold' : 'text-green-600 font-bold',
                outside: 'opacity-30',
                hidden: 'invisible',
              }}
            />
          </div>
        </PopoverContent>
      </Popover>

      {/* ─────────── เวลา ─────────── */}
      <Popover open={timeOpen} onOpenChange={setTimeOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            disabled={disabled}
            data-state={timeOpen ? 'open' : 'closed'}
            className={cn(
              'flex items-center gap-1.5 px-2.5 py-2 rounded-lg border border-gray-200 bg-white text-[13px] font-mono font-semibold tabular-nums transition-all focus-visible:outline-none focus-visible:ring-2 text-gray-900 shrink-0',
              triggerRing,
            )}
          >
            <ClockIcon className={cn('w-3.5 h-3.5 shrink-0', isOrange ? 'text-orange-500' : 'text-green-500')} />
            <span>{timeValue || '――:――'}</span>
            <span className="text-[11px] font-normal text-gray-400">น.</span>
          </button>
        </PopoverTrigger>

        <PopoverContent
          className={popoverCls}
          align="end"
          sideOffset={6}
          onMouseDown={e => e.stopPropagation()}
          onClick={e => e.stopPropagation()}
        >
          <div className="px-3 pt-3 pb-3 space-y-3 w-64">
            {/* header */}
            <div className="flex items-center gap-2">
              <ClockIcon className={cn('w-3.5 h-3.5 shrink-0', isOrange ? 'text-orange-500' : 'text-green-500')} />
              <span className="text-xs font-semibold text-gray-600">เลือกเวลา (24 ชั่วโมง)</span>
            </div>

            <div className="flex gap-2.5">
              {/* Hour grid */}
              <div className="flex-1 min-w-0">
                <p className="text-[10px] text-gray-400 font-medium text-center mb-1.5 uppercase tracking-wider">ชั่วโมง</p>
                <div className="grid grid-cols-6 gap-1">
                  {HOURS.map(h => (
                    <button
                      key={h}
                      type="button"
                      onClick={() => handleHour(h)}
                      className={cn(
                        'h-7 rounded-md text-[11px] font-semibold tabular-nums transition-all',
                        h === selHour ? activeCls : 'text-gray-700 hover:bg-gray-100',
                      )}
                    >
                      {String(h).padStart(2, '0')}
                    </button>
                  ))}
                </div>
              </div>

              <div className="w-px bg-gray-200 self-stretch" />

              {/* Minute grid */}
              <div className="w-16 shrink-0">
                <p className="text-[10px] text-gray-400 font-medium text-center mb-1.5 uppercase tracking-wider">นาที</p>
                <div className="grid grid-cols-2 gap-1">
                  {MINUTES.map(m => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => handleMinute(m)}
                      className={cn(
                        'h-7 rounded-md text-[11px] font-semibold tabular-nums transition-all',
                        m === selMinute ? activeCls : 'text-gray-700 hover:bg-gray-100',
                      )}
                    >
                      {String(m).padStart(2, '0')}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Preview pill */}
            <div className={cn(
              'rounded-lg py-2 text-center text-[13px] font-mono font-semibold border',
              isOrange ? 'bg-orange-50 text-orange-700 border-orange-200' : 'bg-green-50 text-green-700 border-green-200',
            )}>
              {String(selHour).padStart(2, '0')} : {String(selMinute).padStart(2, '0')} น.
            </div>

            {/* Confirm */}
            <button
              type="button"
              onClick={() => setTimeOpen(false)}
              className={cn(
                'w-full py-1.5 rounded-lg text-xs font-semibold text-white transition-all',
                isOrange ? 'bg-orange-600 hover:bg-orange-700' : 'bg-green-600 hover:bg-green-700',
              )}
            >
              ยืนยันเวลา
            </button>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
