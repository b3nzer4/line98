import { Node, UITransform, Vec3, EventMouse } from 'cc';
import { Cell } from './BoardTypes';

/**
 * Chuyển đổi giữa toạ độ ô (row, col) và toạ độ node, tính scale cho bóng.
 */
export class BoardLayout {
    private ui: UITransform;

    constructor(private node: Node, private boardSize: number) {
        this.ui = node.getComponent(UITransform);
    }

    public setSide(side: number) {
        this.ui.setContentSize(side, side);
    }

    public get side(): number {
        return this.ui.width;
    }

    public get cellSize(): number {
        return this.ui.width / this.boardSize;
    }

    public cellToLocal(row: number, col: number): Vec3 {
        const cell = this.cellSize;
        const half = this.ui.width / 2;
        return new Vec3(-half + (col + 0.5) * cell, -half + (row + 0.5) * cell, 0);
    }

    /** Scale để node vừa 1 ô, nhân với factor (ballScale / previewScale). */
    public fitScale(node: Node, factor: number): number {
        const ut = node.getComponent(UITransform);
        if (ut && ut.width > 0 && ut.height > 0) {
            const cell = this.cellSize;
            return Math.min(cell / ut.width, cell / ut.height) * factor;
        }
        return factor;
    }

    public mouseToCell(event: EventMouse): Cell | null {
        const uiPos = event.getUILocation();
        const worldPos = new Vec3(uiPos.x, uiPos.y, 0);
        const localPos = this.ui.convertToNodeSpaceAR(worldPos);

        const cell = this.cellSize;
        const col = Math.floor((localPos.x + this.ui.width / 2) / cell);
        const row = Math.floor((localPos.y + this.ui.height / 2) / cell);

        if (row < 0 || row >= this.boardSize || col < 0 || col >= this.boardSize) return null;
        return { row, col };
    }
}
