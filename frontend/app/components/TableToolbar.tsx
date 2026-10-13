"use client";

import { DownloadIcon, PencilIcon } from "./icons";

interface TableToolbarProps {
  // Omit for pages that have no rates editor of their own (Stock, Egg)
  onEditRates?: () => void;
  editDisabled?: boolean;
  onDownload: () => void;
  downloadDisabled?: boolean;
}

const btn =
  "flex h-7 w-7 items-center justify-center rounded shadow-sm disabled:opacity-40";

// Icon-only buttons for the top-left corner of a table: pencil (edit rates) then download (PDF).
// data-pdf-ignore keeps them out of the exported PDF.
export function TableToolbar({ onEditRates, editDisabled, onDownload, downloadDisabled }: TableToolbarProps) {
  return (
    <div className="flex items-center gap-2" data-pdf-ignore>
      {onEditRates && (
        <button
          type="button"
          aria-label="Edit rates"
          title="Edit rates"
          className={`${btn} bg-orange-500 hover:bg-orange-600`}
          disabled={editDisabled}
          onClick={onEditRates}
        >
          <PencilIcon className="h-4 w-4" />
        </button>
      )}
      <button
        type="button"
        aria-label="Download PDF"
        title="Download"
        className={`${btn} bg-blue-600 hover:bg-blue-700`}
        disabled={downloadDisabled}
        onClick={onDownload}
      >
        <DownloadIcon className="h-4 w-4" />
      </button>
    </div>
  );
}
