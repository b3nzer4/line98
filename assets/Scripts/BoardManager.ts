import { _decorator, Component, Node, UITransform, Prefab, instantiate, EventMouse, Vec3, tween, UIOpacity, Animation } from 'cc';
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
    maxHistory: number = 50;

    public haveBall: number[][] = [];
    public balls: Node[] = [];
    public previewBalls: Node[] = [];

    private isWaiting: boolean = false;
    private selectedBall: Node = null;
    private overlayBall: Node = null;
    private lockedOverlayPos: Vec3 | null = null;
    private history: BoardSnapshot[] = [];

    onLoad() {
        this.board = this.board || this.getComponent(Board);
        const size = this.board.boardSize;
        this.haveBall = Array.from({ length: size }, () => new Array(size).fill(EMPTY));

        this.node.on(Node.EventType.MOUSE_DOWN, this.onMouseDown, this);

        this.spawnRandom(7);
        this.refillPreview();
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
    private onMouseDown(event: EventMouse) {
        if (event.getButton() !== EventMouse.BUTTON_LEFT) return;

        const cell = this.getCellFromMouse(event);
        if (!cell) return;

        if (!this.isWaiting) {
            this.trySelect(cell);
        } else {
            this.tryMoveTo(cell);
        }
    }

    //  CHỌN QUẢ 
    private trySelect(cell: Cell) {
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
        if (anim) {
            anim.play('bounce');
        }

        this.overlayBall = overlay;
    }

    //  DI CHUYỂN 
    private tryMoveTo(cell: Cell) {
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

        this.moveBallAlongPath(ball, path, () => {
            this.checkAndRemoveConnected();
            this.upgradePreviews();
        });
    }

    //  HỦY CHỜ 
    private cancelWaiting() {
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

    //  TÌM ĐƯỜNG 
    private findPath(from: Cell, to: Cell): Cell[] | null {
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

    //  DI CHUYỂN THEO ĐƯỜNG 
    private moveBallAlongPath(ball: Node, path: Cell[], onDone: () => void) {
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

    //  KIỂM TRA BÓNG LIỀN (ĐÚNG LUẬT LINE 98) 
    public checkAndRemoveConnected() {
        this.scanLines();
    }

    private scanLines() {
        const size = this.board.boardSize;
        const toRemove = new Set<string>();

        // 4 hướng: ngang, dọc, chéo xuôi, chéo ngược
        const dirs = [
            { dr: 0, dc: 1 },   // ngang
            { dr: 1, dc: 0 },   // dọc
            { dr: 1, dc: 1 },   // chéo xuôi
            { dr: 1, dc: -1 }   // chéo ngược
        ];

        for (let r = 0; r < size; r++) {
            for (let c = 0; c < size; c++) {
                const color = this.haveBall[r][c];
                if (color === EMPTY) continue;

                for (const d of dirs) {
                    // Kiểm tra ô này có phải là ĐẦU của đường không
                    const pr = r - d.dr;
                    const pc = c - d.dc;
                    if (pr >= 0 && pr < size && pc >= 0 && pc < size) {
                        if (this.haveBall[pr][pc] === color) continue;
                    }

                    // Đếm số ô cùng màu liên tiếp theo hướng d
                    const line: Cell[] = [];
                    let nr = r;
                    let nc = c;
                    while (nr >= 0 && nr < size && nc >= 0 && nc < size) {
                        if (this.haveBall[nr][nc] !== color) break;
                        line.push({ row: nr, col: nc });
                        nr += d.dr;
                        nc += d.dc;
                    }

                    // Nếu >= MIN_MATCH → đánh dấu xoá
                    if (line.length >= MIN_MATCH) {
                        for (const cell of line) {
                            toRemove.add(`${cell.row}_${cell.col}`);
                        }
                    }
                }
            }
        }

        // Xoá tất cả ô đã đánh dấu
        for (const key of toRemove) {
            const [r, c] = key.split('_').map(Number);
            this.removeBallAt(r, c);
        }
    }

    //  SPAWN 
    private spawnRandom(count: number) {
        const size = this.board.boardSize;
        const empty: Cell[] = [];
        for (let r = 0; r < size; r++)
            for (let c = 0; c < size; c++)
                if (this.haveBall[r][c] === EMPTY) empty.push({ row: r, col: c });

        const n = Math.min(count, empty.length);
        for (let i = 0; i < n; i++) {
            const idx = Math.floor(Math.random() * empty.length);
            const { row, col } = empty.splice(idx, 1)[0];

            const color = Math.floor(Math.random() * COLOR_COUNT);
            this.haveBall[row][col] = color;
            this.spawnBallAt(row, col, color);
        }
    }

    private refillPreview() {
        if (!this.BallPrefabs || this.BallPrefabs.length === 0) return;

        const size = this.board.boardSize;
        const empty: Cell[] = [];
        for (let r = 0; r < size; r++)
            for (let c = 0; c < size; c++)
                if (this.haveBall[r][c] === EMPTY) empty.push({ row: r, col: c });

        const n = Math.min(3, empty.length);

        for (let i = 0; i < n; i++) {
            const idx = Math.floor(Math.random() * empty.length);
            const { row, col } = empty.splice(idx, 1)[0];

            const color = Math.floor(Math.random() * COLOR_COUNT);
            this.haveBall[row][col] = color;
            this.spawnPreviewAt(row, col, color);
        }
    }

    private spawnPreviewAt(row: number, col: number, color: number) {
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

    private spawnBallAt(row: number, col: number, color: number) {
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

    //  PHÓNG TO 
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
    private preStep() {
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
            previewBalls: previewData
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
        this.haveBall = Array.from({ length: size }, () => new Array(size).fill(EMPTY));

        for (let r = 0; r < size; r++) {
            for (let c = 0; c < size; c++) {
                this.haveBall[r][c] = snapshot.board[r][c];
            }
        }

        for (const data of snapshot.balls) {
            this.spawnBallAt(data.row, data.col, data.color);
        }

        for (const data of snapshot.previewBalls) {
            this.spawnPreviewAt(data.row, data.col, data.color);
        }

        console.log(`Undo. Còn ${this.history.length} bước`);
    }

    //  HELPERS 
    public getColorAt(row: number, col: number): number {
        return this.haveBall[row][col];
    }

    public isOccupied(row: number, col: number): boolean {
        return this.haveBall[row][col] !== EMPTY;
    }

    private setNodeOpacity(node: Node, opacity: number) {
        let uiOpacity = node.getComponent(UIOpacity);
        if (!uiOpacity) uiOpacity = node.addComponent(UIOpacity);
        uiOpacity.opacity = opacity;
    }

    private getCellFromMouse(event: EventMouse): Cell | null {
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

    private getBallAt(row: number, col: number): Node | null {
        for (const b of this.balls) {
            if (b["__row"] === row && b["__col"] === col) return b;
        }
        return null;
    }
}