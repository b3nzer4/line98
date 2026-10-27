import { Node, Prefab, instantiate, tween, Tween, Vec3, UIOpacity } from 'cc';
import { BoardGrid } from './BoardGrid';
import { BoardLayout } from './BoardLayout';
import { BallData, Cell, COLOR_COUNT, EMPTY, PREVIEW_COUNT } from './BoardTypes';

export interface BallOptions {
    prefabs: Prefab[];
    ballScale: number;
    previewScale: number;
    animDuration: number;
}

/**
 * Quản lý toàn bộ node bóng: sinh, preview, phóng to, di chuyển, xoá.
 */
export class BallManager {
    public balls: Node[] = [];
    public previewBalls: Node[] = [];

    constructor(
        private parent: Node,
        private grid: BoardGrid,
        private layout: BoardLayout,
        private options: BallOptions,
    ) {}

    // ---------- Thông tin gắn trên node ----------
    public static getInfo(node: Node): BallData {
        return { row: node['__row'], col: node['__col'], color: node['__color'] };
    }

    public static setCell(node: Node, row: number, col: number) {
        node['__row'] = row;
        node['__col'] = col;
    }

    public static setOpacity(node: Node, opacity: number) {
        let uiOpacity = node.getComponent(UIOpacity);
        if (!uiOpacity) uiOpacity = node.addComponent(UIOpacity);
        uiOpacity.opacity = opacity;
    }

    // ---------- Sinh bóng ----------
    private createBall(row: number, col: number, color: number, scaleFactor: number): Node | null {
        const prefab = this.options.prefabs && this.options.prefabs[color];
        if (!prefab) return null;

        const ball = instantiate(prefab);
        ball.setParent(this.parent);
        ball.setPosition(this.layout.cellToLocal(row, col));

        const s = this.layout.fitScale(ball, scaleFactor);
        ball.setScale(s, s, 1);

        BallManager.setCell(ball, row, col);
        ball['__color'] = color;
        return ball;
    }

    public spawnBallAt(row: number, col: number, color: number) {
        const ball = this.createBall(row, col, color, this.options.ballScale);
        if (ball) this.balls.push(ball);
    }

    public spawnPreviewAt(row: number, col: number, color: number) {
        const ball = this.createBall(row, col, color, this.options.previewScale);
        if (ball) this.previewBalls.push(ball);
    }

    private pickRandomEmpty(count: number): Cell[] {
        const empty = this.grid.getEmptyCells();
        const picked: Cell[] = [];
        const n = Math.min(count, empty.length);
        for (let i = 0; i < n; i++) {
            const idx = Math.floor(Math.random() * empty.length);
            picked.push(empty[idx]);
            empty.splice(idx, 1);
        }
        return picked;
    }

    public spawnRandom(count: number) {
        const cells = this.pickRandomEmpty(count);
        for (const cell of cells) {
            const color = Math.floor(Math.random() * COLOR_COUNT);
            this.grid.set(cell.row, cell.col, color);
            this.spawnBallAt(cell.row, cell.col, color);
        }
    }

    public refillPreview() {
        if (!this.options.prefabs || this.options.prefabs.length === 0) return;

        const cells = this.pickRandomEmpty(PREVIEW_COUNT);
        for (const cell of cells) {
            const color = Math.floor(Math.random() * COLOR_COUNT);
            this.grid.set(cell.row, cell.col, color);
            this.spawnPreviewAt(cell.row, cell.col, color);
        }
    }

    /** Phóng to các bóng preview thành bóng thật, rồi sinh preview mới. */
    public upgradePreviews() {
        for (const small of this.previewBalls) {
            if (!small || !small.isValid) continue;

            const s = this.layout.fitScale(small, this.options.ballScale);
            tween(small)
                .to(this.options.animDuration, { scale: new Vec3(s, s, 1) })
                .start();

            this.balls.push(small);
        }

        this.previewBalls = [];
        this.refillPreview();
    }

    // ---------- Truy vấn ----------
    public getBallAt(row: number, col: number): Node | null {
        for (const b of this.balls) {
            if (b['__row'] === row && b['__col'] === col) return b;
        }
        return null;
    }

    // ---------- Di chuyển ----------
    public moveAlong(ball: Node, path: Cell[], onDone: () => void) {
        if (path.length <= 1) {
            onDone();
            return;
        }

        let chain = tween(ball);
        for (let i = 1; i < path.length; i++) {
            const p = this.layout.cellToLocal(path[i].row, path[i].col);
            chain = chain.to(0.05, { position: p });
        }
        chain.call(onDone).start();
    }

    // ---------- Xoá ----------
    public removeBallAt(row: number, col: number) {
        if (this.removeFrom(this.balls, row, col)) return;
        this.removeFrom(this.previewBalls, row, col);
    }

    private removeFrom(list: Node[], row: number, col: number): boolean {
        for (let i = 0; i < list.length; i++) {
            const b = list[i];
            if (b['__row'] === row && b['__col'] === col) {
                list.splice(i, 1);
                this.grid.set(row, col, EMPTY);
                if (b && b.isValid) b.destroy();
                return true;
            }
        }
        return false;
    }

    public clearAll() {
        for (const list of [this.balls, this.previewBalls]) {
            for (const b of list) {
                if (b && b.isValid) {
                    Tween.stopAllByTarget(b);
                    b.destroy();
                }
            }
        }
        this.balls = [];
        this.previewBalls = [];
    }

    // ---------- Xuất dữ liệu cho undo ----------
    public exportBalls(): BallData[] {
        return this.balls.map(b => BallManager.getInfo(b));
    }

    public exportPreviews(): BallData[] {
        return this.previewBalls.map(b => BallManager.getInfo(b));
    }
}
