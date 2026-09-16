import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import type { T } from "@/i18n/t";
import { cn } from "@/lib/utils";

/**
 * A table that reads as a list of cards on a phone.
 *
 * Seven columns of statistics over 133 rows need 42 rem: on a 390 px screen
 * the table was put in a horizontal scroller, the hero column pinned on the
 * left, and the reader had to drag sideways to see a win rate. Below `sm` the
 * same table becomes one card per row — the row's heading on its own line,
 * each cell labelled by its column — and above it stays the table it always
 * was, cell alignment and all.
 *
 * One markup for both: the switch is entirely in `.cards-table` and
 * `.cards-table-cards` (globals.css), so the server renders the rows once,
 * the data is never duplicated, and the column headers stay the sort buttons
 * they are at every width, `aria-sort` included.
 *
 * A table of four short columns fits a phone as it is: it keeps its rows
 * (`cards={false}`), because a card costs two lines where a row costs one.
 * Cards are for the tables that do not fit — and a column that adds nothing
 * on a phone is dropped either way (`wideOnly`).
 *
 * Laying the cards out means giving the elements `display: block`, which in
 * most browsers drops the table semantics with it: the roles are therefore
 * written out, so a screen reader still announces a table, its rows and their
 * headers at every width, `aria-sort` included.
 */

export interface CardsColumn<R> {
  /** Identifier, and sort key when the column is sortable. */
  key: string;
  /** Column heading, and the label shown before the value on a card. */
  label: string;
  /** Cell content for a row, given its rank on the page. */
  cell: (row: R, index: number) => React.ReactNode;
  /**
   * The row's heading (`<th scope="row">`), which becomes the card's title.
   * One column at most, the first one by convention.
   */
  head?: boolean;
  /** Sorting offered on this column; needs `onSort`. */
  sortable?: boolean;
  /** Not repeated on the card: a decoration the row's figures already say. */
  wideOnly?: boolean;
  /** Extra classes on the cells of this column. */
  className?: string;
}

export function CardsTable<R>({
  caption,
  columns,
  rows,
  rowKey,
  sort,
  order,
  onSort,
  empty,
  cards = true,
  t,
  className,
}: {
  /** Table caption, read by screen readers. */
  caption: string;
  columns: CardsColumn<R>[];
  rows: readonly R[];
  rowKey: (row: R, index: number) => string;
  /** Key of the column currently ordering the rows. */
  sort?: string;
  order?: "asc" | "desc";
  /** Sorting handler; without it the headings are plain text. */
  onSort?: (key: string) => void;
  /** Shown in place of the rows when there is none. */
  empty?: React.ReactNode;
  /**
   * Rows become cards below `sm`. Turn it off for a table narrow enough to
   * be read as it is: the rows then simply tighten up.
   */
  cards?: boolean;
  t: T;
  className?: string;
}) {
  return (
    <table
      role={cards ? "table" : undefined}
      className={cn("cards-table", cards ? "cards-table-cards" : "max-sm:table-fixed", className)}
    >
      <caption className="sr-only">{caption}</caption>
      <thead role={cards ? "rowgroup" : undefined}>
        <tr role={cards ? "row" : undefined}>
          {columns.map((c) => {
            const active = !!sort && sort === c.key;
            const Icon = !active ? ArrowUpDown : order === "asc" ? ArrowUp : ArrowDown;
            return (
              <th
                key={c.key}
                role={cards ? "columnheader" : undefined}
                scope="col"
                data-column={c.key}
                aria-sort={active ? (order === "asc" ? "ascending" : "descending") : undefined}
                className={cn(c.wideOnly && "cards-table-wide", c.className)}
              >
                {c.sortable && onSort ? (
                  <button
                    type="button"
                    onClick={() => onSort(c.key)}
                    aria-label={t("common.table.sortBy", { column: c.label })}
                    className={cn(
                      "inline-flex items-center gap-1 whitespace-nowrap uppercase tracking-wide transition-colors hover:text-gold-400",
                      active && "text-gold-400",
                    )}
                  >
                    {c.label}
                    <Icon size={12} aria-hidden className={active ? undefined : "opacity-40"} />
                  </button>
                ) : (
                  c.label
                )}
              </th>
            );
          })}
        </tr>
      </thead>
      <tbody role={cards ? "rowgroup" : undefined}>
        {rows.map((row, i) => (
          <tr key={rowKey(row, i)} role={cards ? "row" : undefined}>
            {columns.map((c) =>
              c.head ? (
                <th key={c.key} role={cards ? "rowheader" : undefined} scope="row" data-column={c.key} className={c.className}>
                  {c.cell(row, i)}
                </th>
              ) : (
                <td
                  key={c.key}
                  role={cards ? "cell" : undefined}
                  data-column={c.key}
                  data-label={c.label}
                  className={cn(c.wideOnly && "cards-table-wide", c.className)}
                >
                  {c.cell(row, i)}
                </td>
              ),
            )}
          </tr>
        ))}
        {rows.length === 0 && empty && (
          <tr role={cards ? "row" : undefined} className="cards-table-empty">
            <td role={cards ? "cell" : undefined} colSpan={columns.length}>
              {empty}
            </td>
          </tr>
        )}
      </tbody>
    </table>
  );
}
