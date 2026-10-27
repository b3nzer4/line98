export interface Cell {
    row: number;
    col: number;
}

export interface BallData {
    row: number;
    col: number;
    color: number;
}

export interface BoardSnapshot {
    board: number[][];
    balls: BallData[];
    previewBalls: BallData[];
    score: number;
}

export const EMPTY = -1;
export const COLOR_COUNT = 6;
export const MIN_MATCH = 5;
export const INITIAL_BALLS = 7;
export const PREVIEW_COUNT = 3;
