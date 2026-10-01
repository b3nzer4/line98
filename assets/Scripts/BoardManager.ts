import { _decorator, Component, Node, UITransform, Prefab, instantiate, EventMouse, Vec3, tween, UIOpacity, Animation, Label, AudioSource } from 'cc';
import { Board } from './BoardDraw';
const { ccclass, property } = _decorator;

export interface Cell {
    row: number;
    col: number;
}

const EMPTY = -1;
const COLOR_COUNT = 6;
const MIN_MATCH = 5;

interface BoardSnapshot {
    board: number[][];
    balls: { row: number; col: number; color: number }[];
    previewBalls: { row: number; col: number; color: number }[];
    score: number;
}

@ccclass('BoardSpawner')
export class BoardSpawner extends Component {
    @property(Board)
    board: Board = null;

    @property([Prefab])
    BallPrefabs: Prefab[] = [];

    @property
    ballScale: number = 0.9;

    @property
    previewScale: number = 0.4;

    @property
    animDuration: number = 0.1;

    @property
    moveDuration: number = 0.3;

    @property
    maxHistory: number = 10000;

    @property(Label)
    ScoreLabel: Label = null;

    @property(AudioSource)
    audioSource: AudioSource = null!;

    public haveBall: number[][] = [];
    public balls: Node[] = [];
    public previewBalls: Node[] = [];
    public Score: number = 0;

    public isWaiting: boolean = false;
    public selectedBall: Node = null;
    public overlayBall: Node = null;
    public lockedOverlayPos: Vec3 | null = null;
    public history: BoardSnapshot[] = [];

    onLoad() {
        this.board = this.board || this.getComponent(Board);
        const size = this.board.boardSize;

        this.haveBall = [];
        for (let r = 0; r < size; r++) {
            const row: number[] = [];
            for (let c = 0; c < size; c++) {
                row.push(EMPTY);
            }
            this.haveBall.push(row);
        }

        this.node.on(Node.EventType.MOUSE_DOWN, this.onMouseDown, this);

        this.spawnRandom(7);
        this.refillPreview();
        this.setScore(this.Score);
    }

    onDestroy() {
        this.node.off(Node.EventType.MOUSE_DOWN, this.onMouseDown, this);
    }

    lateUpdate(dt: number) {
        if (this.overlayBall && this.overlayBall.isValid && this.lockedOverlayPos) {
            this.overlayBall.setPosition(this.lockedOverlayPos);
        }
    }

    //  INPUT 
    public onMouseDown(event: EventMouse) {
        if (event.getButton() !== EventMouse.BUTTON_LEFT) return;

        const cell = this.getCellFromMouse(event);
        if (!cell) return;

        if (!this.isWaiting) {
            this.trySelect(cell);
        } else {
            this.tryMoveTo(cell);
        }
    }

    public trySelect(cell: Cell) {
        const ball = this.getBallAt(cell.row, cell.col);
        if (!ball) return;

        this.selectedBall = ball;
        this.isWaiting = true;

        this.setNodeOpacity(ball, 0);

        const color = ball["__color"];
        const overlay = instantiate(this.BallPrefabs[color]);
        overlay.setParent(this.node);
        overlay.setPosition(ball.position);
        overlay.setScale(ball.scale);
        overlay["__row"] = ball["__row"];
        overlay["__col"] = ball["__col"];
        overlay["__color"] = color;

        this.lockedOverlayPos = ball.position.clone();

        const anim = overlay.getComponent(Animation);
        if (anim) anim.play('bounce');

        this.overlayBall = overlay;
    }

    public tryMoveTo(cell: Cell) {
        if (!this.selectedBall || !this.selectedBall.isValid) {
            this.cancelWaiting();
            return;
        }

        if (this.selectedBall["__row"] === cell.row &&
            this.selectedBall["__col"] === cell.col) {
            this.cancelWaiting();
            return;
        }

        if (this.haveBall[cell.row][cell.col] !== EMPTY) return;

        const from: Cell = {
            row: this.selectedBall["__row"],
            col: this.selectedBall["__col"]
        };

        const path = this.findPath(from, cell);
        if (!path) return;

        this.preStep();

        const color = this.selectedBall["__color"];

        this.haveBall[from.row][from.col] = EMPTY;
        this.haveBall[cell.row][cell.col] = color;

        this.selectedBall["__row"] = cell.row;
        this.selectedBall["__col"] = cell.col;

        if (this.overlayBall && this.overlayBall.isValid) {
            const anim = this.overlayBall.getComponent(Animation);
            if (anim) anim.stop();
            this.overlayBall.destroy();
        }
        this.overlayBall = null;
        this.lockedOverlayPos = null;

        this.setNodeOpacity(this.selectedBall, 255);

        const ball = this.selectedBall;
        this.selectedBall = null;
        this.isWaiting = false;

        this.move(ball, path, () => {
            this.checkAndRemoveConnected();
            this.upgradePreviews();
        });
    }

    public cancelWaiting() {
        if (!this.isWaiting) return;

        if (this.overlayBall && this.overlayBall.isValid) {
            const anim = this.overlayBall.getComponent(Animation);
            if (anim) anim.stop();
            this.overlayBall.destroy();
        }
        this.overlayBall = null;
        this.lockedOverlayPos = null;

        if (this.selectedBall && this.selectedBall.isValid) {
            this.setNodeOpacity(this.selectedBall, 255);
        }

        this.selectedBall = null;
        this.isWaiting = false;
    }

    //  BFS
    public findPath(from: Cell, to: Cell): Cell[] | null {
        if (from.row === to.row && from.col === to.col) return null;

        const size = this.board.boardSize;

        const visited: boolean[][] = [];
        for (let r = 0; r < size; r++) {
            const row: boolean[] = [];
            for (let c = 0; c < size; c++) row.push(false);
            visited.push(row);
        }

        const queue: Cell[] = [from];
        visited[from.row][from.col] = true;

        const parent: (Cell | null)[][] = [];
        for (let r = 0; r < size; r++) {
            const row: (Cell | null)[] = [];
            for (let c = 0; c < size; c++) row.push(null);
            parent.push(row);
        }

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

    public move(ball: Node, path: Cell[], onDone: () => void) {
        const boardSize = this.board.getComponent(UITransform);
        const cellSize = boardSize.width / this.board.boardSize;

        const points = path.slice(1);

        if (points.length === 0) {
            onDone();
            return;
        }

        let chain = tween(ball);
        for (const point of points) {
            const x = -boardSize.width / 2 + (point.col + 0.5) * cellSize;
            const y = -boardSize.height / 2 + (point.row + 0.5) * cellSize;
            chain = chain.to(0.05, { position: new Vec3(x, y, 0) });
        }
        chain.call(onDone).start();
    }

    //  KIỂM TRA BÓNG LIỀN 
    public checkAndRemoveConnected() {
        this.checkLine();
    }

    public checkLine() {
        const size = this.board.boardSize;
        const toRemove = new Set<string>();

        const dirs = [
            { dr: 0, dc: 1 },
            { dr: 1, dc: 0 },
            { dr: 1, dc: 1 },
            { dr: 1, dc: -1 }
        ];

        for (let r = 0; r < size; r++) {
            for (let c = 0; c < size; c++) {
                const color = this.haveBall[r][c];
                if (color === EMPTY) continue;

                for (const d of dirs) {
                    const pr = r - d.dr;
                    const pc = c - d.dc;
                    if (pr >= 0 && pr < size && pc >= 0 && pc < size) {
                        if (this.haveBall[pr][pc] === color) continue;
                    }

                    const line: Cell[] = [];
                    let nr = r;
                    let nc = c;
                    while (nr >= 0 && nr < size && nc >= 0 && nc < size) {
                        if (this.haveBall[nr][nc] !== color) break;
                        line.push({ row: nr, col: nc });
                        nr += d.dr;
                        nc += d.dc;
                    }

                    if (line.length >= MIN_MATCH) {
                        for (const cell of line) {
                            toRemove.add(`${cell.row}_${cell.col}`);
                        }
                    }
                }
            }
        }

        let tempScore = 0;

        for (const key of toRemove) {
            const parts = key.split('_');
            const r = Number(parts[0]);
            const c = Number(parts[1]);
            this.removeBallAt(r, c);
            tempScore += 1;
        }

        if (tempScore > 0) {
            this.Score = this.Score + (tempScore * (tempScore - 4));
            this.audioSource.playOneShot(this.audioSource.clip, 0.2);
            this.setScore(this.Score);
        }
    }

    //  ĐIỂM 
    public setScore(score: number) {
        if (this.ScoreLabel) {
            this.ScoreLabel.string = `Score: ${score}`;
        }
    }

    //  SPAWN 
    public spawnRandom(count: number) {
        const size = this.board.boardSize;

        const empty: Cell[] = [];
        for (let r = 0; r < size; r++) {
            for (let c = 0; c < size; c++) {
                if (this.haveBall[r][c] === EMPTY) {
                    empty.push({ row: r, col: c });
                }
            }
        }

        const n = Math.min(count, empty.length);

        for (let i = 0; i < n; i++) {
            const idx = Math.floor(Math.random() * empty.length);
            const cell = empty.splice(idx, 1)[0];

            const color = Math.floor(Math.random() * COLOR_COUNT);

            this.haveBall[cell.row][cell.col] = color;
            this.spawnBallAt(cell.row, cell.col, color);
        }
    }

    public refillPreview() {
        if (!this.BallPrefabs || this.BallPrefabs.length === 0) return;

        const size = this.board.boardSize;

        const empty: Cell[] = [];
        for (let r = 0; r < size; r++) {
            for (let c = 0; c < size; c++) {
                if (this.haveBall[r][c] === EMPTY) {
                    empty.push({ row: r, col: c });
                }
            }
        }

        const n = Math.min(3, empty.length);

        for (let i = 0; i < n; i++) {
            const idx = Math.floor(Math.random() * empty.length);
            const cell = empty.splice(idx, 1)[0];

            const color = Math.floor(Math.random() * COLOR_COUNT);
            this.haveBall[cell.row][cell.col] = color;
            this.spawnPreviewAt(cell.row, cell.col, color);
        }
    }

    public spawnPreviewAt(row: number, col: number, color: number) {
        const boardSize = this.board.getComponent(UITransform);
        const cellSize = boardSize.width / this.board.boardSize;

        const small = instantiate(this.BallPrefabs[color]);
        small.setParent(this.node);

        const x = -boardSize.width / 2 + (col + 0.5) * cellSize;
        const y = -boardSize.height / 2 + (row + 0.5) * cellSize;
        small.setPosition(x, y, 0);

        const ballUT = small.getComponent(UITransform);
        if (ballUT && ballUT.width > 0 && ballUT.height > 0) {
            const scaleToFit = Math.min(cellSize / ballUT.width, cellSize / ballUT.height);
            const finalScale = scaleToFit * this.previewScale;
            small.setScale(finalScale, finalScale, 1);
        } else {
            small.setScale(this.previewScale, this.previewScale, 1);
        }

        small["__row"] = row;
        small["__col"] = col;
        small["__color"] = color;

        this.previewBalls.push(small);
    }

    public spawnBallAt(row: number, col: number, color: number) {
        if (!this.BallPrefabs || !this.BallPrefabs[color]) return;

        const ball = instantiate(this.BallPrefabs[color]);
        const boardSize = this.board.getComponent(UITransform);
        const cellSize = boardSize.width / this.board.boardSize;

        const x = -boardSize.width / 2 + (col + 0.5) * cellSize;
        const y = -boardSize.height / 2 + (row + 0.5) * cellSize;

        ball.setParent(this.node);
        ball.setPosition(x, y, 0);

        const ballUT = ball.getComponent(UITransform);
        if (ballUT && ballUT.width > 0 && ballUT.height > 0) {
            const scaleToFit = Math.min(cellSize / ballUT.width, cellSize / ballUT.height);
            const finalScale = scaleToFit * this.ballScale;
            ball.setScale(finalScale, finalScale, 1);
        }

        ball["__row"] = row;
        ball["__col"] = col;
        ball["__color"] = color;

        this.balls.push(ball);
    }

    public upgradePreviews() {
        const boardSize = this.board.getComponent(UITransform);
        const cellSize = boardSize.width / this.board.boardSize;

        for (const small of this.previewBalls) {
            if (!small || !small.isValid) continue;

            const ballUT = small.getComponent(UITransform);
            let scaleToFit = this.ballScale;
            if (ballUT && ballUT.width > 0 && ballUT.height > 0) {
                scaleToFit = Math.min(cellSize / ballUT.width, cellSize / ballUT.height) * this.ballScale;
            }

            tween(small)
                .to(this.animDuration, { scale: new Vec3(scaleToFit, scaleToFit, 1) })
                .start();

            this.balls.push(small);
        }

        this.previewBalls = [];
        this.refillPreview();
    }

    //  XOÁ BÓNG 
    public removeBallAt(row: number, col: number) {
        for (let i = 0; i < this.balls.length; i++) {
            const b = this.balls[i];
            if (b["__row"] === row && b["__col"] === col) {
                this.balls.splice(i, 1);
                this.haveBall[row][col] = EMPTY;
                if (b && b.isValid) b.destroy();
                return;
            }
        }

        for (let i = 0; i < this.previewBalls.length; i++) {
            const b = this.previewBalls[i];
            if (b["__row"] === row && b["__col"] === col) {
                this.previewBalls.splice(i, 1);
                this.haveBall[row][col] = EMPTY;
                if (b && b.isValid) b.destroy();
                return;
            }
        }
    }

    //  UNDO 
    public preStep() {
        const size = this.board.boardSize;

        const boardCopy: number[][] = [];
        for (let r = 0; r < size; r++) {
            boardCopy.push([...this.haveBall[r]]);
        }

        const ballsData = this.balls.map(b => ({
            row: b["__row"],
            col: b["__col"],
            color: b["__color"]
        }));

        const previewData = this.previewBalls.map(b => ({
            row: b["__row"],
            col: b["__col"],
            color: b["__color"]
        }));

        this.history.push({
            board: boardCopy,
            balls: ballsData,
            previewBalls: previewData,
            score: this.Score
        });

        if (this.history.length > this.maxHistory) {
            this.history.shift();
        }
    }

    public onUndoButtonClick() {
        this.undo();
    }

    public undo() {
        if (this.history.length === 0) {
            console.log('Không có gì để undo');
            return;
        }

        this.cancelWaiting();

        const snapshot = this.history.pop()!;

        for (const b of this.balls) {
            if (b && b.isValid) b.destroy();
        }
        this.balls = [];

        for (const b of this.previewBalls) {
            if (b && b.isValid) b.destroy();
        }
        this.previewBalls = [];

        const size = this.board.boardSize;
        this.haveBall = [];
        for (let r = 0; r < size; r++) {
            const row: number[] = [];
            for (let c = 0; c < size; c++) {
                row.push(snapshot.board[r][c]);
            }
            this.haveBall.push(row);
        }

        for (const data of snapshot.balls) {
            this.spawnBallAt(data.row, data.col, data.color);
        }

        for (const data of snapshot.previewBalls) {
            this.spawnPreviewAt(data.row, data.col, data.color);
        }

        this.Score = snapshot.score;
        this.setScore(this.Score);
    }

    //  HÀM PHỤ 
    public getColorAt(row: number, col: number): number {
        return this.haveBall[row][col];
    }

    public isOccupied(row: number, col: number): boolean {
        return this.haveBall[row][col] !== EMPTY;
    }

    public setNodeOpacity(node: Node, opacity: number) {
        let uiOpacity = node.getComponent(UIOpacity);
        if (!uiOpacity) uiOpacity = node.addComponent(UIOpacity);
        uiOpacity.opacity = opacity;
    }

    public getCellFromMouse(event: EventMouse): Cell | null {
        const uiTransform = this.node.getComponent(UITransform);
        const boardSize = this.board.getComponent(UITransform);
        if (!uiTransform || !boardSize) return null;

        const uiPos = event.getUILocation();
        const worldPos = new Vec3(uiPos.x, uiPos.y, 0);
        const localPos = uiTransform.convertToNodeSpaceAR(worldPos);

        const cellSize = boardSize.width / this.board.boardSize;
        const col = Math.floor((localPos.x + boardSize.width / 2) / cellSize);
        const row = Math.floor((localPos.y + boardSize.height / 2) / cellSize);

        const size = this.board.boardSize;
        if (row < 0 || row >= size || col < 0 || col >= size) return null;
        return { row, col };
    }

    public getBallAt(row: number, col: number): Node | null {
        for (const b of this.balls) {
            if (b["__row"] === row && b["__col"] === col) return b;
        }
        return null;
    }
}