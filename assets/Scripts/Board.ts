import { _decorator, Component, Node, Prefab, EventMouse, Label, AudioSource, GraphicsComponent, view, Button } from 'cc';
import { BallManager } from './BallManager';
import { BoardGrid } from './BoardGrid';
import { BoardHistory } from './BoardHistory';
import { BoardLayout } from './BoardLayout';
import { BoardRenderer } from './BoardRenderer';
import { Cell, EMPTY, INITIAL_BALLS } from './BoardTypes';
import { BounceOverlay } from './BounceOverlay';
import { MatchChecker } from './MatchChecker';
import { PathFinder } from './PathFinder';

export type { Cell } from './BoardTypes';

const { ccclass, property } = _decorator;

@ccclass('BoardSpawner')
export class BoardSpawner extends Component {
    @property(GraphicsComponent)
    graphics: GraphicsComponent = null;

    @property([Prefab])
    BallPrefabs: Prefab[] = [];

    @property([Prefab])
    AnimPrefab: Prefab[] = [];

    @property
    boardSize = 9;

    @property
    screenMargin = 24;

    @property
    ballScale: number = 0.9;

    @property
    previewScale: number = 0.4;

    @property
    animDuration: number = 0.1;

    @property
    maxHistory: number = 10000;

    @property(Label)
    ScoreLabel: Label = null;

    @property(AudioSource)
    audioSource: AudioSource = null!;

    @property(Button)
    undoButton: Button = null;

    public Score: number = 0;
    public isWaiting: boolean = false;
    public selectedBall: Node = null;

    public grid: BoardGrid;
    public ballManager: BallManager;

    private layout: BoardLayout;
    private overlay: BounceOverlay;
    private history: BoardHistory;

    // ---------- Vòng đời ----------
    onLoad() {
        this.graphics = this.graphics || this.getComponent(GraphicsComponent);

        this.grid = new BoardGrid(this.boardSize);
        this.layout = new BoardLayout(this.node, this.boardSize);
        this.ballManager = new BallManager(this.node, this.grid, this.layout, {
            prefabs: this.BallPrefabs,
            ballScale: this.ballScale,
            previewScale: this.previewScale,
            animDuration: this.animDuration,
        });
        this.overlay = new BounceOverlay(this.node, this.AnimPrefab);
        this.history = new BoardHistory(this.maxHistory);

        this.resizeBoard();
        view.on('canvas-resize', this.resizeBoard, this);

        this.node.on(Node.EventType.MOUSE_DOWN, this.onMouseDown, this);

        if (this.undoButton) {
            this.undoButton.node.on(Button.EventType.CLICK, this.undo, this);
        }

        this.ballManager.spawnRandom(INITIAL_BALLS);
        this.ballManager.refillPreview();
        this.setScore(this.Score);
    }

    onDestroy() {
        this.node.off(Node.EventType.MOUSE_DOWN, this.onMouseDown, this);
        view.off('canvas-resize', this.resizeBoard, this);

        if (this.undoButton && this.undoButton.isValid) {
            this.undoButton.node.off(Button.EventType.CLICK, this.undo, this);
        }

        this.overlay.hide();
    }

    // ---------- Vẽ ----------
    private resizeBoard() {
        const visible = view.getVisibleSize();
        const side = Math.max(0, Math.min(visible.width, visible.height) - this.screenMargin * 2);

        this.layout.setSide(side);
        BoardRenderer.draw(this.graphics, side, this.boardSize);
    }

    // ---------- Input ----------
    public onMouseDown(event: EventMouse) {
        if (event.getButton() !== EventMouse.BUTTON_LEFT) return;

        const cell = this.layout.mouseToCell(event);
        if (!cell) return;

        if (this.isWaiting === false) {
            this.trySelect(cell);
        } else {
            this.tryMoveTo(cell);
        }
    }

    public trySelect(cell: Cell) {
        const ball = this.ballManager.getBallAt(cell.row, cell.col);
        if (!ball) return;

        this.selectedBall = ball;
        this.isWaiting = true;

        BallManager.setOpacity(ball, 0);
        this.overlay.show(ball, BallManager.getInfo(ball).color);
    }

    public tryMoveTo(cell: Cell) {
        if (!this.selectedBall || !this.selectedBall.isValid) {
            this.cancelWaiting();
            return;
        }

        const info = BallManager.getInfo(this.selectedBall);
        const from: Cell = { row: info.row, col: info.col };

        if (from.row === cell.row && from.col === cell.col) {
            this.cancelWaiting();
            return;
        }

        if (!this.grid.isEmpty(cell.row, cell.col)) return;

        const path = PathFinder.find(this.grid, from, cell);
        if (!path) return;

        this.history.record(this.grid, this.ballManager, this.Score);

        this.grid.set(from.row, from.col, EMPTY);
        this.grid.set(cell.row, cell.col, info.color);

        const ball = this.selectedBall;
        BallManager.setCell(ball, cell.row, cell.col);
        BallManager.setOpacity(ball, 255);
        this.overlay.hide();

        this.selectedBall = null;
        this.isWaiting = false;

        this.ballManager.moveAlong(ball, path, () => {
            this.checkAndRemoveConnected();
            this.ballManager.upgradePreviews();
        });
    }

    public cancelWaiting() {
        if (this.isWaiting === false) return;

        if (this.selectedBall && this.selectedBall.isValid) {
            BallManager.setOpacity(this.selectedBall, 255);
        }

        this.overlay.hide();
        this.selectedBall = null;
        this.isWaiting = false;
    }

    // ---------- Match & điểm ----------
    public checkAndRemoveConnected() {
        const matches = MatchChecker.findMatches(this.grid);
        for (const cell of matches) {
            this.ballManager.removeBallAt(cell.row, cell.col);
        }

        const count = matches.length;
        if (count > 0) {
            this.Score += count * (count - 4);
            if (this.audioSource) this.audioSource.playOneShot(this.audioSource.clip, 0.2);
            this.setScore(this.Score);
        }
    }

    public setScore(score: number) {
        if (this.ScoreLabel) {
            this.ScoreLabel.string = 'Score: ' + score;
        }
    }

    // ---------- Undo ----------
    public undo() {
        const snapshot = this.history.pop();
        if (!snapshot) {
            console.log('Không có gì để undo');
            return;
        }

        this.cancelWaiting();
        this.ballManager.clearAll();
        this.grid.restore(snapshot.board);

        for (const d of snapshot.balls) {
            this.ballManager.spawnBallAt(d.row, d.col, d.color);
        }
        for (const d of snapshot.previewBalls) {
            this.ballManager.spawnPreviewAt(d.row, d.col, d.color);
        }

        this.Score = snapshot.score;
        this.setScore(this.Score);
    }
}
