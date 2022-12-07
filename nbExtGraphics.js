class nbExtGraphics {
    #canvas;
    #gl;

    constructor(canvas)
    {
        this.#canvas = canvas;
        this.#canvas.width = 400;
        this.#canvas.height = 240;
        // WebGL2のコンテキストを取得します。
        this.#gl = this.#canvas.getContext('webgl2');
    }
}