import { GraphicsComponent, Color } from 'cc';

/**
 * Vẽ nền và lưới bàn cờ.
 */
export class BoardRenderer {
    public static draw(g: GraphicsComponent, side: number, boardSize: number) {
        if (!g) return;
        const cellSize = side / boardSize;

        g.clear();
        g.fillColor = new Color(255, 255, 255, 150);
        g.rect(-side / 2, -side / 2, side, side);
        g.fill();

        g.strokeColor = new Color(105, 61, 0, 255);
        g.lineWidth = 8;

        for (let i = 0; i <= boardSize; i++) {
            const pos = -side / 2 + i * cellSize;
            g.moveTo(pos, -side / 2);
            g.lineTo(pos, side / 2);
            g.moveTo(-side / 2, pos);
            g.lineTo(side / 2, pos);
        }
        g.stroke();
    }
}
