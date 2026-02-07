"use client";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableFooter,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ZoomIn, ZoomOut, RotateCcw, Share2 } from "lucide-react";

export function EggAndBSheetUI() {
  return (
    <div className="space-y-4">
      {/* Price Section */}
      <div className="flex items-center gap-4 p-4 border rounded-lg">
        <h3 className="text-lg font-semibold">ಬೆಲೆಗಳು</h3>

        <div className="flex items-center gap-2">
          <label className="font-medium">ಮೊಟ್ಟೆ ಬೆಲೆ:</label>
          <Input className="w-24" placeholder="0" />
        </div>

        <div className="flex items-center gap-2">
          <label className="font-medium">ಬಾಳೆ ಬೆಲೆ:</label>
          <Input className="w-24" placeholder="0" />
        </div>
      </div>

      {/* Summary */}
      <div className="rounded-md border p-4">
        <h3 className="text-lg font-semibold text-center">Summary</h3>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead />
              <TableHead className="text-center font-bold">ಮೊಟ್ಟೆ</TableHead>
              <TableHead className="text-center font-bold">ಬಾಳೆ</TableHead>
              <TableHead className="text-center font-bold">Total</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {["APF", "GOV", "Total"].map(label => (
              <TableRow key={label}>
                <TableCell className="font-bold">{label}</TableCell>
                <TableCell className="text-center">0</TableCell>
                <TableCell className="text-center">0</TableCell>
                <TableCell className="text-center font-bold">0</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Controls */}
      <div className="flex items-center justify-between">
        <Button variant="outline" size="sm" className="gap-2">
          <Share2 className="h-4 w-4" />
          Share
        </Button>

        <div className="flex gap-2">
          <Button variant="outline" size="icon"><ZoomIn className="h-4 w-4" /></Button>
          <Button variant="outline" size="icon"><ZoomOut className="h-4 w-4" /></Button>
          <Button variant="outline" size="icon"><RotateCcw className="h-4 w-4" /></Button>
        </div>
      </div>

      {/* Main Table */}
      <div className="rounded-md border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableCell colSpan={14} className="text-center font-semibold">
                Month Year - ಮೊಟ್ಟೆ ಮತ್ತು ಬಾಳೆಹಣ್ಣು
              </TableCell>
            </TableRow>

            <TableRow>
              <TableHead>ದಿನಾಂಕ</TableHead>
              <TableHead>ಪಾವತಿಸುವವನು</TableHead>
              <TableHead colSpan={4}>ಮೊಟ್ಟೆ</TableHead>
              <TableHead colSpan={4}>ಬಾಳೆ</TableHead>
              <TableHead colSpan={3}>ಒಟ್ಟು</TableHead>
              <TableHead>ಒಟ್ಟು ಹಣ</TableHead>
            </TableRow>
          </TableHeader>

          <TableBody>
            {[1, 2, 3].map(i => (
              <TableRow key={i}>
                <TableCell>DD/MM/YYYY</TableCell>
                <TableCell>
                  <div className="flex flex-col gap-1">
                    <Button size="sm">APF</Button>
                    <Button size="sm">GOV</Button>
                  </div>
                </TableCell>

                {Array.from({ length: 8 }).map((_, idx) => (
                  <TableCell key={idx}>
                    <Input className="w-20" />
                  </TableCell>
                ))}

                <TableCell>0</TableCell>
                <TableCell>0</TableCell>
                <TableCell>0</TableCell>
                <TableCell>0</TableCell>
              </TableRow>
            ))}
          </TableBody>

          <TableFooter>
            <TableRow>
              <TableCell colSpan={14} className="font-bold text-right">
                Grand Total: 0
              </TableCell>
            </TableRow>
          </TableFooter>
        </Table>
      </div>
    </div>
  );
}
