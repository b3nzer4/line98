import { Cell, EMPTY } from './BoardTypes';

/**
 * Dữ liệu logic của bàn cờ: mỗi ô là EMPTY (-1) hoặc index màu (0..COLOR_COUNT-1).
 */
export class BoardGrid {
    public cells: number[][] = [];

    constructor(public readonly size: number) {
        this.reset();
    }

    public reset() {
        this.cells = [];
        for (let r = 0; r < this.size; r++) {
            const row: number[] = [];
            for (let c = 0; c < this.size; c++) {
                row.push(EMPTY);
            }
            this.cells.push(row);
        }
    }

    public isInside(row: number, col: number): boolean {
        return row >= 0 && row < this.size && col >= 0 && col < this.size;
    }

    public get(row: number, col: number): number {
        return this.cells[row][col];
    }

    public set(row: number, col: number, value: number) {
        this.cells[row][col] = value;
    }

    public isEmpty(row: number, col: number): boolean {
        return this.cells[row][col] === EMPTY;
    }

    public getEmptyCells(): Cell[] {
        const empty: Cell[] = [];
        for (let r = 0; r < this.size; r++) {
            for (let c = 0; c < this.size; c++) {
                if (this.cells[r][c] === EMPTY) {
                    empty.push({ row: r, col: c });
                }
            }
        }
        return empty;
    }

    public clone(): number[][] {
        return this.cells.map(row => row.slice());
    }

    /** Ghi đè dữ liệu tại chỗ (giữ nguyên tham chiếu để các class khác vẫn dùng được). */
    public restore(board: number[][]) {
        for (let r = 0; r < this.size; r++) {
            for (let c = 0; c < this.size; c++) {
                this.cells[r][c] = board[r][c];
            }
        }
    }
}
