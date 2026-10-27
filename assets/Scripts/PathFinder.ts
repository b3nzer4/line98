import { BoardGrid } from './BoardGrid';
import { Cell, EMPTY } from './BoardTypes';

const DIRS = [
    { dr: -1, dc: 0 },
    { dr: 1, dc: 0 },
    { dr: 0, dc: -1 },
    { dr: 0, dc: 1 },
];

/**
 * Tìm đường đi ngắn nhất (BFS) giữa 2 ô, không đi xuyên qua bóng.
 */
export class PathFinder {
    public static find(grid: BoardGrid, from: Cell, to: Cell): Cell[] | null {
        if (from.row === to.row && from.col === to.col) return null;

        const size = grid.size;
        const visited: boolean[][] = [];
        const parent: (Cell | null)[][] = [];

        for (let r = 0; r < size; r++) {
            visited.push(new Array(size).fill(false));
            parent.push(new Array(size).fill(null));
        }

        const queue: Cell[] = [from];
        visited[from.row][from.col] = true;

        let found = false;
        let head = 0;

        while (head < queue.length) {
            const current = queue[head++];
            if (current.row === to.row && current.col === to.col) {
                found = true;
                break;
            }

            for (const d of DIRS) {
                const nr = current.row + d.dr;
                const nc = current.col + d.dc;

                if (!grid.isInside(nr, nc)) continue;
                if (visited[nr][nc]) continue;

                const isTarget = nr === to.row && nc === to.col;
                const hasBall = grid.get(nr, nc) !== EMPTY;
                if (hasBall && !isTarget) continue;

                visited[nr][nc] = true;
                parent[nr][nc] = current;
                queue.push({ row: nr, col: nc });
            }
        }

        if (!found) return null;

        const path: Cell[] = [];
        let curr: Cell | null = { row: to.row, col: to.col };
        while (curr) {
            path.unshift(curr);
            curr = parent[curr.row][curr.col];
        }
        return path;
    }
}
