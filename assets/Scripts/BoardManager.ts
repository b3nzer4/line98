import { _decorator, Component, Node, UITransform, Prefab, instantiate, EventMouse, Vec3, tween } from 'cc';
import { Board } from './Board';
const { ccclass, property } = _decorator;

@ccclass('BoardInput')
export class BoardInput extends Component {
    @property(Board)
    board: Board = null;

    @property(Prefab)
    BallPrefab: Prefab = null;

    @property
    ballScale: number = 0.8;     

    @property
    previewScale: number = 0.4;   

    @property
    animDuration: number = 0.3;

    private occupied: boolean[][] = [];
    private balls: Node[] = [];
    private previewBalls: Node[] = [];

    onLoad() {
        this.board = this.board || this.getComponent(Board);
        const size = this.board.boardSize;
        this.occupied = Array.from({ length: size }, () => new Array(size).fill(false));

        this.node.on(Node.EventType.MOUSE_DOWN, this.onMouseDown, this);

        this.spawnRandom(7);


        this.refillPreview();
    }

    onDestroy() {
        this.node.off(Node.EventType.MOUSE_DOWN, this.onMouseDown, this);
    }

    private onMouseDown(event: EventMouse) {
        if (event.getButton() === EventMouse.BUTTON_LEFT) {
            this.spawnFromPreview();
        } else if (event.getButton() === EventMouse.BUTTON_RIGHT) {
            this.removeRandom(3);
        }
    }


    private spawnFromPreview() {
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


    private spawnRandom(count: number) {
        const size = this.board.boardSize;
        const empty: { row: number, col: number }[] = [];
        for (let r = 0; r < size; r++)
            for (let c = 0; c < size; c++)
                if (!this.occupied[r][c]) empty.push({ row: r, col: c });

        const n = Math.min(count, empty.length);
        for (let i = 0; i < n; i++) {
            const idx = Math.floor(Math.random() * empty.length);
            const { row, col } = empty.splice(idx, 1)[0];
            this.occupied[row][col] = true;
            this.spawnBallAt(row, col);
        }
    }


    private refillPreview() {
        if (!this.BallPrefab) return;

        const size = this.board.boardSize;
        const boardSize = this.board.getComponent(UITransform);
        const cellSize = boardSize.width / this.board.boardSize;

        // Tìm ô trống
        const empty: { row: number, col: number }[] = [];
        for (let r = 0; r < size; r++)
            for (let c = 0; c < size; c++)
                if (!this.occupied[r][c]) empty.push({ row: r, col: c });

        const n = Math.min(3, empty.length);

        for (let i = 0; i < n; i++) {
            const idx = Math.floor(Math.random() * empty.length);
            const { row, col } = empty.splice(idx, 1)[0];

            this.occupied[row][col] = true;

            const small = instantiate(this.BallPrefab);
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

            this.previewBalls.push(small);
        }
    }


    private removeRandom(count: number) {
        const n = Math.min(count, this.balls.length);
        for (let i = 0; i < n; i++) {
            const idx = Math.floor(Math.random() * this.balls.length);
            const ball = this.balls.splice(idx, 1)[0];

            this.occupied[ball["__row"]][ball["__col"]] = false;
            ball.destroy();
        }
    }


    private spawnBallAt(row: number, col: number) {
        if (!this.BallPrefab) return;
        const ball = instantiate(this.BallPrefab);

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

        this.balls.push(ball);
    }


}