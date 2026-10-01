import { _decorator, Component, Node } from 'cc';
import { Cell, BoardSpawner } from './BoardManager'
import { Board } from './BoardDraw';

const { ccclass, property } = _decorator;

@ccclass('PathFinder')
export class PathFinder extends Component {
    @property(Board)
    board: Board = null;
    //  BFS
    onLoad(){
        this.board = this.board || this.getComponent(Board);
        const size = this.board.boardSize;
    }

    public findPath(from: Cell, to: Cell): Cell[] | null {
        if (from.row === to.row && from.col === to.col) return null;
        const size = this.board.boardSize;
        const visited: boolean[][] = Array.from({ length: size }, () => new Array(size).fill(false));
        const queue: Cell[] = [from];
        visited[from.row][from.col] = true;
        const parent: (Cell | null)[][] = Array.from({ length: size }, () => new Array(size).fill(null));
        const dirs = [
            { dr: -1, dc: 0 },
            { dr: 1, dc: 0 },
            { dr: 0, dc: -1 },
            { dr: 0, dc: 1 }
        ];
        let found = false;
        while (queue.length > 0) {
            const current = queue.shift()!;
            if (current.row === to.row && current.col === to.col) {
                found = true;
                break;
            }
            for (const d of dirs) {
                const nr = current.row + d.dr;
                const nc = current.col + d.dc;
                if (nr < 0 || nr >= size || nc < 0 || nc >= size) continue;
                if (visited[nr][nc]) continue;
                const isTarget = (nr === to.row && nc === to.col);
                if (this.haveBall[nr][nc] !== EMPTY && !isTarget) continue;
                visited[nr][nc] = true;
                parent[nr][nc] = current;
                queue.push({ row: nr, col: nc });
            }
        }
        if (!found) return null;
        const path: Cell[] = [];
        let cur: Cell | null = to;
        while (cur) {
            path.unshift(cur);
            cur = parent[cur.row][cur.col];
        }
        return path;
    }

}


