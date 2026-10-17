import { useMemo } from "react";

interface DiffViewProps {
  oldContent: string;
  newContent: string;
}

type DiffLine =
  | { type: "unchanged"; line: string; oldLineNum: number; newLineNum: number }
  | { type: "removed"; line: string; oldLineNum: number }
  | { type: "added"; line: string; newLineNum: number };

function computeLineDiff(oldText: string, newText: string): DiffLine[] {
  const oldLines = oldText.split("\n");
  const newLines = newText.split("\n");

  // LCS-based diff
  const m = oldLines.length;
  const n = newLines.length;

  // Build LCS table
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (oldLines[i - 1] === newLines[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }

  // Backtrack to produce diff
  const result: DiffLine[] = [];
  let i = m;
  let j = n;

  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && oldLines[i - 1] === newLines[j - 1]) {
      result.push({
        type: "unchanged",
        line: oldLines[i - 1],
        oldLineNum: i,
        newLineNum: j,
      });
      i--;
      j--;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      result.push({ type: "added", line: newLines[j - 1], newLineNum: j });
      j--;
    } else {
      result.push({ type: "removed", line: oldLines[i - 1], oldLineNum: i });
      i--;
    }
  }

  result.reverse();
  return result;
}

export function DiffView({ oldContent, newContent }: DiffViewProps) {
  const diff = useMemo(
    () => computeLineDiff(oldContent, newContent),
    [oldContent, newContent],
  );

  return (
    <div className="h-full overflow-auto font-mono text-sm">
      <table className="w-full border-collapse">
        <tbody>
          {diff.map((d, idx) => {
            const bg =
              d.type === "added"
                ? "bg-green-50 dark:bg-green-900/20"
                : d.type === "removed"
                  ? "bg-red-50 dark:bg-red-900/20"
                  : "";
            const prefix =
              d.type === "added" ? "+" : d.type === "removed" ? "-" : " ";
            const oldNum =
              d.type !== "added" ? String(d.oldLineNum) : "";
            const newNum =
              d.type !== "removed" ? String(d.newLineNum) : "";

            return (
              <tr key={idx} className={bg}>
                <td className="w-10 select-none border-r border-stone-200 px-2 text-right text-xs text-stone-400 dark:border-white/10">
                  {oldNum}
                </td>
                <td className="w-10 select-none border-r border-stone-200 px-2 text-right text-xs text-stone-400 dark:border-white/10">
                  {newNum}
                </td>
                <td className="whitespace-pre px-2 py-0.5">
                  <span
                    className={
                      d.type === "added"
                        ? "text-green-600 dark:text-green-400"
                        : d.type === "removed"
                          ? "text-red-600 dark:text-red-400"
                          : ""
                    }
                  >
                    {prefix}
                  </span>{" "}
                  {d.line}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export { computeLineDiff };
