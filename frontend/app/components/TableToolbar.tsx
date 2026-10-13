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
  "flex h-9 w-9 items-center justify-center rounded border bg-white text-black shadow-sm disabled:opacity-40";

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
          className={`${btn} border-orange-500 bg-orange-500 hover:bg-orange-600`}
          style={{ color: "#fff" }}
          disabled={editDisabled}
          onClick={onEditRates}
        >
          <PencilIcon />
        </button>
      )}
      <button
        type="button"
        aria-label="Download PDF"
        title="Download"
        className={`${btn} border-gray-400 hover:bg-gray-100`}
        disabled={downloadDisabled}
        onClick={onDownload}
      >
        <DownloadIcon />
      </button>
    </div>
  );
}
