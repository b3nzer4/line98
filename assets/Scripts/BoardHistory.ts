import { BallManager } from './BallManager';
import { BoardGrid } from './BoardGrid';
import { BoardSnapshot } from './BoardTypes';

/**
 * Lưu và lấy lại trạng thái bàn cờ để undo.
 */
export class BoardHistory {
    private stack: BoardSnapshot[] = [];

    constructor(private maxSize: number) {}

    public get length(): number {
        return this.stack.length;
    }

    public record(grid: BoardGrid, balls: BallManager, score: number) {
        this.stack.push({
            board: grid.clone(),
            balls: balls.exportBalls(),
            previewBalls: balls.exportPreviews(),
            score: score,
        });

        if (this.stack.length > this.maxSize) {
            this.stack.shift();
        }
    }

    public pop(): BoardSnapshot | undefined {
        return this.stack.pop();
    }
}
