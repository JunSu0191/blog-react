import type { HTMLAttributes, ReactNode } from "react";
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
    <div className="overflow-x-auto rounded-2xl border border-slate-200/80 bg-white/95 shadow-sm dark:border-slate-800/80 dark:bg-slate-900/90">
      <ShadcnTable
        className={cn("min-w-full divide-y divide-slate-200/70 dark:divide-slate-800/70", className)}
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
    <ShadcnTableHeaderSection className={cn("bg-slate-50/80 dark:bg-slate-900/70", className)} {...props}>
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
      className={cn("divide-y divide-slate-200/60 bg-white/95 dark:divide-slate-800/70 dark:bg-slate-950/60", className)}
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
      className={cn("transition-colors duration-200 hover:bg-slate-50/80 dark:hover:bg-slate-900/70", className)}
      {...props}
    >
      {children}
    </ShadcnTableRow>
  );
}

// Table Header Cell
interface TableHeaderProps extends HTMLAttributes<HTMLTableCellElement> {
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
        "h-auto px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400",
        className,
      )}
      {...props}
    >
      {children}
    </ShadcnTableHeadCell>
  );
}

// Table Cell
interface TableCellProps extends HTMLAttributes<HTMLTableCellElement> {
  children: ReactNode;
}

export function TableCell({
  children,
  className = "",
  ...props
}: TableCellProps) {
  return (
    <ShadcnTableCell
      className={cn("whitespace-nowrap px-6 py-4 text-sm text-slate-900 dark:text-slate-100", className)}
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
