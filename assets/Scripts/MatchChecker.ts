import { BoardGrid } from './BoardGrid';
import { Cell, EMPTY, MIN_MATCH } from './BoardTypes';

const DIRS = [
    { dr: 0, dc: 1 },   // ngang
    { dr: 1, dc: 0 },   // dọc
    { dr: 1, dc: 1 },   // chéo \
    { dr: 1, dc: -1 },  // chéo /
];

/**
 * Tìm tất cả các ô nằm trong đường thẳng >= MIN_MATCH bóng cùng màu.
 */
export class MatchChecker {
    public static findMatches(grid: BoardGrid): Cell[] {
        const size = grid.size;
        const found = new Set<number>();
        const result: Cell[] = [];

        for (let r = 0; r < size; r++) {
            for (let c = 0; c < size; c++) {
                const color = grid.get(r, c);
                if (color === EMPTY) continue;

                for (const d of DIRS) {
                    // Chỉ bắt đầu đếm từ đầu đường thẳng
                    const pr = r - d.dr;
                    const pc = c - d.dc;
                    if (grid.isInside(pr, pc) && grid.get(pr, pc) === color) continue;

                    const line: Cell[] = [];
                    let nr = r;
                    let nc = c;
                    while (grid.isInside(nr, nc) && grid.get(nr, nc) === color) {
                        line.push({ row: nr, col: nc });
                        nr += d.dr;
                        nc += d.dc;
                    }

                    if (line.length >= MIN_MATCH) {
                        for (const cell of line) {
                            const key = cell.row * size + cell.col;
                            if (!found.has(key)) {
                                found.add(key);
                                result.push(cell);
                            }
                        }
                    }
                }
            }
        }
        return result;
    }
}
