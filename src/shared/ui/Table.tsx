import type {
  HTMLAttributes,
  ReactNode,
  TdHTMLAttributes,
  ThHTMLAttributes,
} from "react";
import {
  Table as ShadcnTable,
  TableBody as ShadcnTableBody,
  TableCell as ShadcnTableCell,
  TableHead as ShadcnTableHeadCell,
  TableHeader as ShadcnTableHeaderSection,
  TableRow as ShadcnTableRow,
} from "@/components/ui/table";
import { cn } from "@/shared/lib/cn";

// Table Root
interface TableProps extends HTMLAttributes<HTMLTableElement> {
  children: ReactNode;
}

export function Table({ children, className = "", ...props }: TableProps) {
  return (
    <div className="relative w-full min-w-0 overflow-x-auto rounded-[28px] border border-slate-200/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(248,250,252,0.96))] shadow-[0_28px_80px_-52px_rgba(15,23,42,0.5)] ring-1 ring-white/70 dark:border-slate-800/80 dark:bg-[linear-gradient(180deg,rgba(15,23,42,0.94),rgba(2,6,23,0.96))] dark:ring-slate-800/70">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-16 bg-gradient-to-b from-white/80 to-transparent dark:from-slate-800/30" />
      <ShadcnTable
        className={cn(
          "relative w-max min-w-full border-separate border-spacing-0 table-auto text-[13px]",
          className,
        )}
        {...props}
      >
        {children}
      </ShadcnTable>
    </div>
  );
}

// Table Header
interface TableHeadProps extends HTMLAttributes<HTMLTableSectionElement> {
  children: ReactNode;
}

export function TableHead({
  children,
  className = "",
  ...props
}: TableHeadProps) {
  return (
    <ShadcnTableHeaderSection
      className={cn("bg-transparent [&_tr]:border-0", className)}
      {...props}
    >
      {children}
    </ShadcnTableHeaderSection>
  );
}

// Table Body
interface TableBodyProps extends HTMLAttributes<HTMLTableSectionElement> {
  children: ReactNode;
}

export function TableBody({
  children,
  className = "",
  ...props
}: TableBodyProps) {
  return (
    <ShadcnTableBody
      className={cn(
        "bg-transparent [&_tr:last-child_td]:border-b-0",
        className,
      )}
      {...props}
    >
      {children}
    </ShadcnTableBody>
  );
}

// Table Row
interface TableRowProps extends HTMLAttributes<HTMLTableRowElement> {
  children: ReactNode;
}

export function TableRow({
  children,
  className = "",
  ...props
}: TableRowProps) {
  return (
    <ShadcnTableRow
      className={cn(
        "group/row transition-[background-color,transform] duration-200 odd:bg-white even:bg-slate-50/45 hover:bg-sky-50/85 dark:odd:bg-slate-950/10 dark:even:bg-slate-900/40 dark:hover:bg-sky-950/20",
        className,
      )}
      {...props}
    >
      {children}
    </ShadcnTableRow>
  );
}

// Table Header Cell
interface TableHeaderProps extends ThHTMLAttributes<HTMLTableCellElement> {
  children: ReactNode;
}

export function TableHeader({
  children,
  className = "",
  ...props
}: TableHeaderProps) {
  return (
    <ShadcnTableHeadCell
      className={cn(
        "sticky top-0 z-10 h-auto whitespace-nowrap border-b border-slate-200/80 bg-slate-50/92 px-5 py-3.5 text-left text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500 backdrop-blur supports-[backdrop-filter]:bg-slate-50/82 dark:border-slate-800/80 dark:bg-slate-900/92 dark:text-slate-400 dark:supports-[backdrop-filter]:bg-slate-900/82 first:pl-6 last:pr-6",
        className,
      )}
      {...props}
    >
      {children}
    </ShadcnTableHeadCell>
  );
}

// Table Cell
interface TableCellProps extends TdHTMLAttributes<HTMLTableCellElement> {
  children: ReactNode;
}

export function TableCell({
  children,
  className = "",
  ...props
}: TableCellProps) {
  return (
    <ShadcnTableCell
      className={cn(
        "whitespace-nowrap border-b border-slate-200/70 px-5 py-4 align-top text-sm text-slate-900 dark:border-slate-800/80 dark:text-slate-100 first:pl-6 last:pr-6",
        className,
      )}
      {...props}
    >
      {children}
    </ShadcnTableCell>
  );
}

// Legacy Table component for backward compatibility
interface LegacyTableProps {
  headers: string[];
  data: (string | number | ReactNode)[][];
  className?: string;
}

export default function LegacyTable({
  headers,
  data,
  className = "",
}: LegacyTableProps) {
  return (
    <Table className={className}>
      <TableHead>
        <TableRow>
          {headers.map((header, index) => (
            <TableHeader key={index}>{header}</TableHeader>
          ))}
        </TableRow>
      </TableHead>
      <TableBody>
        {data.map((row, rowIndex) => (
          <TableRow key={rowIndex}>
            {row.map((cell, cellIndex) => (
              <TableCell key={cellIndex}>{cell}</TableCell>
            ))}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
