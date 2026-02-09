"use client";

import * as React from "react";
import { Calendar as CalendarIcon, Download, ChevronDown, Save, Loader2 } from "lucide-react";
import { addYears, subYears, format } from "date-fns";
import type { DateRange } from "react-day-picker";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

interface DateRangePickerProps extends React.HTMLAttributes<HTMLDivElement> {
  selectedMonth: Date;
  onMonthChange: (year: number, month: number) => void;
  onMonthDownload: () => Promise<void>;
  onSave: () => void;
  isSaving: boolean;
  hasUnsavedChanges: boolean;
  isDownloading: boolean;
}

export function DateRangePicker({
  className,
  selectedMonth,
  onMonthChange,
  onMonthDownload,
  onSave,
  isSaving,
  hasUnsavedChanges,
  isDownloading,
}: DateRangePickerProps) {
  const year = selectedMonth.getFullYear();
  const month = selectedMonth.getMonth();
  const [showSaveReminder, setShowSaveReminder] = React.useState(true);
  const [downloadCount, setDownloadCount] = React.useState(0);
  const [showSharePrompt, setShowSharePrompt] = React.useState(false);
  const [hasShared, setHasShared] = React.useState(false);
  const [isAttemptingToClose, setIsAttemptingToClose] = React.useState(false);
  const [isDownloadPending, setIsDownloadPending] = React.useState(false);

  React.useEffect(() => {
    // Check for existing access to sharing feature
    if (localStorage.getItem('hasSharedForDownload') === 'true') {
      setHasShared(true);
    }

    // Load download count from local storage
    const count = parseInt(localStorage.getItem('downloadCount') || '0', 10);
    setDownloadCount(count);

    // Listener to grant access after returning from sharing
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && localStorage.getItem('shareInitiatedForDownload') === 'true') {
        localStorage.setItem('hasSharedForDownload', 'true');
        setHasShared(true);
        setShowSharePrompt(false);
        localStorage.removeItem('shareInitiatedForDownload');
        // If a download was pending, trigger it now
        if (isDownloadPending) {
          onMonthDownload();
          setIsDownloadPending(false);
        }
      }
    };

    // Listener for unsaved changes prompt
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasUnsavedChanges) {
        e.preventDefault();
        e.returnValue = '';
        setIsAttemptingToClose(true);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [hasUnsavedChanges]);

  const handleYearChange = (newYear: number) => {
    onMonthChange(newYear, month);
  };

  const handleMonthChange = (newMonth: number) => {
    onMonthChange(year, newMonth);
  };

  const handleShare = async () => {
    const shareData = {
      title: 'Check out this amazing app!',
      text: 'ಶಿಕ್ಷಕ ಮಿತ್ರರೇ MDM ಲೆಕ್ಕಾಚಾರದ ತಲೆನೋವಿಗೆ ಪರಿಹಾರ ಬೇಕೇ??? \n \nಹಾಗಿದ್ದರೆ ಈ ಕೆಳಗಿನ ಲಿಂಕನ್ನು ಬಳಸಿ ಎಲ್ಲಾ ಲೆಕ್ಕಾಚಾರಗಳನ್ನು ಕ್ಷಣಾರ್ಧದಲ್ಲಿ ಮುಗಿಸಿ...\nJoin our WhatsApp group for updates: https://chat.whatsapp.com/Fgnf3AOmeux7EH7JioPYeA \n\n',
      url: window.location.origin,
    };

    try {
      if (navigator.share) {
        await navigator.share(shareData);
        localStorage.setItem('shareInitiatedForDownload', 'true');
      } else {
        alert('Please share this link: ' + shareData.url);
        localStorage.setItem('hasSharedForDownload', 'true');
        setHasShared(true);
        setShowSharePrompt(false);
      }
    } catch (error) {
      console.error('Error sharing:', error);
      localStorage.setItem('shareInitiatedForDownload', 'true'); // Also grant access if sharing fails/is cancelled
    }
  };

  const handleDownloadClick = () => {
    const newCount = downloadCount + 1;
    localStorage.setItem('downloadCount', newCount.toString());
    setDownloadCount(newCount);

    if (newCount >= 3 && !hasShared) {
      setShowSharePrompt(true);
      setIsDownloadPending(true); // Set download as pending
    } else {
      onMonthDownload();
    }
  };

  const months = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];
  const years = Array.from({ length: 51 }, (_, i) => 2000 + i);

  return (
    <div className={cn("flex flex-col md:flex-row md:items-center md:justify-between gap-4 p-4 bg-card rounded-lg border shadow-sm", className)}>
      <div className="flex flex-col sm:flex-row items-center gap-2">
        <div className="flex items-center gap-2">
          <CalendarIcon className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium text-card-foreground">Select Period:</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <select
              value={year}
              onChange={e => handleYearChange(Number(e.target.value))}
              className="appearance-none bg-background border border-input rounded-md px-3 py-1 text-sm font-medium pr-8 w-full md:w-auto min-w-[80px] focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent hover:border-muted-foreground transition-colors"
            >
              {years.map(y => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
            <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 pointer-events-none text-gray-500" />
          </div>
          <div className="relative">
            <select
              value={month}
              onChange={e => handleMonthChange(Number(e.target.value))}
              className="appearance-none bg-background border border-input rounded-md px-3 py-1 text-sm font-medium pr-8 w-full md:w-auto min-w-[120px] focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent hover:border-muted-foreground transition-colors"
            >
              {months.map((m, idx) => (
                <option key={m} value={idx}>{m}</option>
              ))}
            </select>
            <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 pointer-events-none text-gray-500" />
          </div>
        </div>
      </div>
      
      <div className="flex items-center gap-2 mt-4 md:mt-0">
        {showSaveReminder && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50">
            <div className="bg-blue-950 p-6 rounded-lg shadow-xl text-center">
              <h3 className="text-lg font-bold text-white mb-4">Don't Forget to Save!</h3>
              <p className="mb-4 text-white">Click the 'Save' button to make sure your data is stored.</p>
              <Button onClick={() => setShowSaveReminder(false)}>Got it</Button>
            </div>
          </div>
        )}
        <Button
          size="sm"
          variant="outline"
          className={`flex items-center shine-effect justify-center gap-2 px-4 py-2 text-sm font-medium ${isAttemptingToClose ? 'blinking' : ''}`}
          onClick={() => { onSave(); setShowSaveReminder(false); }}
          disabled={isSaving}
        >
          {isSaving ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Save className="h-4 w-4" />
          )}
          {isSaving ? 'Saving...' : 'Save'}
        </Button>
        <Button
          size="sm"
          variant="default"
          className="flex items-center shine-effect justify-center gap-2 px-4 py-2 text-sm font-medium bg-primary hover:bg-primary/90 text-primary-foreground transition-colors"
          onClick={handleDownloadClick}
          disabled={isDownloading}
        >
          {isDownloading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Download className="h-4 w-4" />
          )}
          {isDownloading ? 'Generating...' : 'Download Report'}
        </Button>
      </div>

      {showSharePrompt && (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex justify-center items-center z-50 p-4">
          <div className="bg-white p-8 rounded-lg shadow-2xl text-center max-w-sm w-full">
            <h2 className="text-2xl font-bold mb-4 text-gray-800">Unlock Unlimited Downloads!</h2>
            <p className="mb-6 text-gray-600">To continue downloading reports, please share this app with 5 friends or groups on WhatsApp.</p>
            <Button 
              onClick={handleShare} 
              className="w-full bg-green-500 hover:bg-green-600 text-white font-bold py-3 px-4 rounded-lg transition duration-300 ease-in-out transform hover:scale-105"
            >
              Share on WhatsApp
            </Button>
            <Button 
              variant="link"
              onClick={() => setShowSharePrompt(false)} 
              className="mt-4 text-sm text-gray-500"
            >
              Maybe Later
            </Button>
          </div>
        </div>
      )}

      {isDownloading && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex justify-center items-center z-50">
          <div className="text-center">
            <p className="text-2xl font-bold text-white shine-animation">Please wait, the PDF is being generated...</p>
          </div>
        </div>
      )}
    </div>
  );
}
