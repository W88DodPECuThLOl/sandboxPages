class nbExtTextIO {
    #int = 1;
    #real = 2;
    #str = 4;
    #array = 8;
    #num = 3;

    #defaultTextScreenId = 4;

    #tram;
    #cursor;
    #width;
    #height;
    #color;
    #attr;

    constructor(width,height)
    {
        this.#width = width;
        this.#height = height;
        this.#tram = new Array(width * 3 * height);
        this.#cursor = {x:0, y:0};
        this.#color = 0xFFFFFFFF;
        this.#attr = 0;

        this.#CLS(this.#defaultTextScreenId);
    }

    putch32(codePoint)
    {
        this.#set(this.#cursor.x,this.#cursor.y,codePoint,this.#color,this.#attr);
        if(codePoint!=10) {
            // １文字進む
            this.#advanceCursor();
        } else {
            // 改行
            this.#nextLineCursor();
        }
    }
    
    #advanceCursor()
    {
        this.#cursor.x++;
        if(this.#cursor.x >= this.#width) {
            this.#cursor.x = 0;
            this.#nextLineCursor();
        }
    }

    #nextLineCursor()
    {
        this.#cursor.y++;
        this.#cursor.x = 0;
        if(this.#cursor.y >= this.#height) {
            this.#cursor.y = this.#height - 1;
            this.#sclroll();
        }
    }
    #sclroll()
    {
        let dst = 0;
        let src = this.#width * 3;
        const end = this.#width * 3 * this.#height;
        while(src != end) {
            this.#tram[dst++] = this.#tram[src++];
        }
        while(dst != end) {
            this.#tram[dst++] = 0;
            this.#tram[dst++] = 0xFFFFFFFF;
            this.#tram[dst++] = 0;
        }
    }

    #set(x,y,codePoint,color,attr)
    {
        const addr = x * 3 + y * this.#width * 3;
        this.#tram[addr] = codePoint;
        this.#tram[addr + 1] = color;
        this.#tram[addr + 2] = attr;
    }

    #drawLetter(codePoint, color, attr, cursor)
    {
        if(codePoint!=10) {
            if(codePoint==32 || codePoint== 0) {
                if(cursor) {
                    return '<span class="cursor">&emsp;</span>';
                } else {
                    return '<span>&emsp;</span>';
                }
            } else {
                if((attr & 3) == 1) {
                    return '<font color="#' + ('00000000' + color.toString(16)).slice(-6) + '"><span class="rot90">' + String.fromCodePoint(codePoint) + '</span></font>';
                } else if((attr & 3) == 2) {
                    return '<font color="#' + ('00000000' + color.toString(16)).slice(-6) + '"><span class="rot180">' + String.fromCodePoint(codePoint) + '</span></font>';
                } else if((attr & 3) == 3) {
                    return '<font color="#' + ('00000000' + color.toString(16)).slice(-6) + '"><span class="rot270">' + String.fromCodePoint(codePoint) + '</span></font>';
                } else {
                    return '<font color="#' + ('00000000' + color.toString(16)).slice(-6) + '"><span>' + String.fromCodePoint(codePoint) + '</span></font>';
                }
            }
        } else {
            if(cursor) {
                return '<span class="cursor">&emsp;</span>';
            } else {
                return '<span>&emsp;</span>';
            }
        }
    }

    draw()
    {
        let text = "";
        let addr = 0;
        for(let y = 0; y < this.#height; ++y) {
            text += "<nobr>";
            for(let x = 0; x < this.#width; ++x) {
                const cursor = (x == this.#cursor.x) && (y == this.#cursor.y);
                text += this.#drawLetter(this.#tram[addr], this.#tram[addr + 1], this.#tram[addr + 2], cursor);
                addr += 3;
            }
            text += "</nobr><br>";
        }
        return text;
    }

    registerFunctions(nb)
    {
        nb.registerExtFunction([
            {
                funcName: "CLS",
                args:[],
                callback:()=>{ this.#CLS(this.#defaultTextScreenId); }
            },
            {
                funcName: "CLS",
                args:[this.#num],
                callback: (textScreenId) => { this.#CLS(textScreenId); }
            },
            {
                funcName: "COLOR",
                args:[this.#int],
                callback: (rgba) => { this.#COLOR(this.#defaultTextScreenId, rgba); }
            },
            {
                funcName: "COLOR",
                args:[this.#num, this.#int],
                callback: (textScreenId, rgba) => { this.#COLOR(textScreenId, rgba); }
            },
            {
                funcName: "COLOR",
                rets:[this.#int],
                callback: () => { return this.#funcCOLOR(this.#defaultTextScreenId); }
            },
            {
                funcName: "COLOR",
                args:[this.#num],
                rets:[this.#int],
                callback: (textScreenId) => { return this.#funcCOLOR(textScreenId); }
            }
        ]);
    }

    #CLS(textScreenId)
    {
        if(textScreenId < 0 || textScreenId > 4) { return { resultCode: "範囲外の値です。" }; }

        for(let y = 0; y < this.#height; ++y) {
            for(let x = 0; x < this.#width; ++x) {
                this.#set(x,y,0,0xFFFFFFFF,0);
            }
        }
    }

    #COLOR(textScreenId, rgba)
    {
        if(textScreenId < 0 || textScreenId > 4) { return { resultCode: "範囲外の値です。" }; }
        this.#color = rgba;
    }

    #funcCOLOR(textScreenId)
    {
        if(textScreenId < 0 || textScreenId > 4) { return { resultCode: "範囲外の値です。" }; }
        return { rets:[this.#color] };
    }
}
