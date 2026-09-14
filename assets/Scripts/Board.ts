import { _decorator, Component, Node,GraphicsComponent,UITransform } from 'cc';
const { ccclass, property } = _decorator;

@ccclass('Board')
export class Board extends Component {

    @property
    row: number = 8;

    @property
    col: number = 8;

    onload() {
        const g = this.getComponent(GraphicsComponent);
        const width = this.node.getComponent(UITransform).width;
        const height = this.node.getComponent(UITransform).height;
        

    }

    start() {

    }

    update(deltaTime: number) {
        
    }
}


