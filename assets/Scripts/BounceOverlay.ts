import { Node, Prefab, instantiate, Tween, Animation } from 'cc';

/**
 * Animation nảy hiển thị đè lên bóng đang được chọn.
 */
export class BounceOverlay {
    private overlay: Node = null;

    constructor(private parent: Node, private prefabs: Prefab[]) {}

    public show(ball: Node, color: number) {
        this.hide();

        const prefab = this.prefabs && this.prefabs[color];
        if (!prefab) return;

        const overlay = instantiate(prefab);
        overlay.setParent(this.parent);
        overlay.setPosition(ball.position);
        overlay.setScale(ball.scale);

        const anim = overlay.getComponentInChildren(Animation);
        if (anim) anim.play();

        this.overlay = overlay;
    }

    public hide() {
        if (this.overlay && this.overlay.isValid) {
            Tween.stopAllByTarget(this.overlay);
            const anim = this.overlay.getComponentInChildren(Animation);
            if (anim) anim.stop();
            this.overlay.destroy();
        }
        this.overlay = null;
    }
}
