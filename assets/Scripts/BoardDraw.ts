import { _decorator, Component, GraphicsComponent, UITransform, Color, view, Prefab, instantiate } from 'cc';
const { ccclass, property } = _decorator;

@ccclass('Board')
export class Board extends Component {
    @property(GraphicsComponent)
    graphics: GraphicsComponent = null;

    @property
    boardSize = 15;

    @property
    screenMargin = 24;

    @property(Prefab)
    BallPrefab: Prefab = null;

    private lastOrientation = '';

    onLoad() {
        this.graphics = this.getComponent(GraphicsComponent);
        this.resizeBoard();
        view.on('canvas-resize', this.resizeBoard, this);
    }

    onDestroy() {
        view.off('canvas-resize', this.resizeBoard, this);
    }



    private resizeBoard() {
        const visibleSize = view.getVisibleSize();
        const orientation = visibleSize.width >= visibleSize.height ? 'landscape' : 'portrait';
        const boardSide = Math.max(0, Math.min(visibleSize.width, visibleSize.height) - this.screenMargin * 2);
        const uiTransform = this.node.getComponent(UITransform);

        uiTransform.setContentSize(boardSide, boardSide);

        if (orientation !== this.lastOrientation) {
            this.lastOrientation = orientation;
            console.log(`Screen orientation: ${orientation}`);
        }

        this.drawBoard();
    }

    private drawBoard() {
        const uiTransform = this.node.getComponent(UITransform);
        const side = uiTransform.width;
        const cellSize = side / this.boardSize;

        this.graphics.clear();
        this.graphics.fillColor = new Color(245, 245, 245, 255);
        this.graphics.rect(-side / 2, -side / 2, side, side);
        this.graphics.fill();

        this.graphics.strokeColor = Color.BLACK;
        this.graphics.lineWidth = 5;
        for (let index = 0; index <= this.boardSize; index++) {
            const position = -side / 2 + index * cellSize;
            this.graphics.moveTo(position, -side / 2);
            this.graphics.lineTo(position, side / 2);
            this.graphics.moveTo(-side / 2, position);
            this.graphics.lineTo(side / 2, position);
        }
        this.graphics.stroke();
    }

    

}


