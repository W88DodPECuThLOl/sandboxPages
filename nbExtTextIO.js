class nbExtTextLayer {
	/**
	 * テキストの配列。3個で１文字分。
	 * +0 : codePoint (UTF-32)
	 * +1 : color
	 * +2 : attr
	 */
	#tram;
	/**
	 * カーソル位置
	 */
	#cursor;
	/**
	 * 画面の横幅(キャラクタ単位)
	 */
	#width;
	/**
	 * 画面の高さ(キャラクタ単位)
	 */
	#height;
	/**
	 * 文字の色
	 */
	#color;
	/**
	 * 文字の属性
	 */
	#attr;

	/**
	 * コンストラクタ
	 * @param {number} width 横幅
	 * @param {number} height 高さ
	 */
	constructor(width,height)
	{
		this.#width = width;
		this.#height = height;
		this.#tram = new Array(width * 3 * height);
		this.#cursor = {x:0, y:0};
		this.#color = 0xFFFFFFFF;
		this.#attr = 0;

		this.CLS();
	}

	/**
	 * １文字出力する
	 * @param {number} codePoint UTF-32の文字
	 */
	putch32(codePoint)
	{
		// カーソル位置に１文字出力
		this.#set(this.#cursor.x,this.#cursor.y,codePoint,this.#color,this.#attr);
		// カーソル位置を更新
		if(codePoint != 10) {
			// １文字進む
			this.#advanceCursor();
		} else {
			// 改行
			this.#nextLineCursor();
		}
	}

	/**
	 * カーソルを１文字分進める
	 */
	#advanceCursor()
	{
		this.#cursor.x++;
		if(this.#cursor.x >= this.#width) {
			this.#cursor.x = 0;
			this.#nextLineCursor();
		}
	}

	/**
	 * 改行する
	 */
	#nextLineCursor()
	{
		this.#cursor.y++;
		this.#cursor.x = 0;
		if(this.#cursor.y >= this.#height) {
			this.#cursor.y = this.#height - 1;
			this.#sclroll();
		}
	}

	/**
	 * １行文スクロールする
	 */
	#sclroll()
	{
		let dst = 0;
		let src = this.#width * 3;
		const end = this.#width * 3 * this.#height;
		while(src != end) {
			this.#tram[dst++] = this.#tram[src++];
		}
		// 新しく出来た行をクリア
		while(dst != end) {
			this.#tram[dst++] = 0;
			this.#tram[dst++] = 0xFFFFFFFF;
			this.#tram[dst++] = 0;
		}
	}

	/**
	 * 指定位置に文字を出力する
	 * @param {number} x 出力するx座標
	 * @param {number} y 出力するy座標
	 * @param {number} codePoint 出力する文字(UTF-32)
	 * @param {number} color 色 
	 * @param {number} attr 属性
	 */
	#set(x,y,codePoint,color,attr)
	{
		const addr = x * 3 + y * this.#width * 3;
		this.#tram[addr] = codePoint;
		this.#tram[addr + 1] = color;
		this.#tram[addr + 2] = attr;
	}

	/**
	 * １文字文描画するテキストを生成（HTMLに設定する文字列を生成）
	 * @param {number} codePoint 文字(UTF-32)
	 * @param {number} color 色 
	 * @param {number} attr 属性
	 * @param {boolean} cursor カーソルを描画するかどうか
	 * @returns １文字文描画するテキスト
	 */
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

	/**
	 * 描画（するときに設定するHTML文字列の生成）
	 * @returns HTMLに設定する文字列
	 */
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

	/**
	 * 画面クリア
	 */
	CLS()
	{
		this.LOCATE(0, 0);
		for(let y = 0; y < this.#height; ++y) {
			for(let x = 0; x < this.#width; ++x) {
				this.#set(x,y,0,0xFFFFFFFF,0);
			}
		}
	}

	/**
	 * カーソル位置を設定する
	 * @param {*} x 
	 * @param {*} y 
	 */
	LOCATE(x,y)
	{
		if(x >= this.#width) { x = this.#width - 1; }
		if(y >= this.#height) { y = this.#height - 1; }
		if(x < 0) { x = 0; }
		if(y < 0) { y = 0; }

		this.#cursor.x = x;
		this.#cursor.y = y;
	}

	/**
	 * 描画色を設定する
	 * @param {number} rgba 描画色
	 */
	COLOR(rgba)
	{
		this.#color = rgba;
	}

	/**
	 * 描画色を取得する
	 * @returns {number} rgba 描画色
	 */
	funcCOLOR()
	{
		return this.#color;
	}
}

class nbExtTextIO {
	#int = 1;
	#real = 2;
	#str = 3;
	#arrayInt = 4;
	#arrayReal = 5;
	#arrayStr = 6;
	#numAsInt = 0x101;
	#numAsReal = 0x102;

	/**
	 * テキストレイヤの数
	 */
	 #textScreenIdSize = 5;
	/**
	 * デフォルトのテキストレイヤ
	 */
	#defaultTextScreenId = 4;

	/**
	 * テキストレイヤ
	 */
	#textLayer;

	/**
	 * コンストラクタ
	 * @param {number} width 横幅
	 * @param {number} height 高さ
	 */
	constructor(width, height)
	{
		this.#textLayer = new Array(this.#textScreenIdSize);
		for(let i = 0; i < this.#textScreenIdSize; ++i) {
			this.#textLayer[i] = new nbExtTextLayer(width, height);
		}
	}

	/**
	 * １文字出力する
	 * @param {number} textScreenId テキストID
	 * @param {number} codePoint UTF-32の文字
	 */
	putch32(textScreenId, codePoint)
	{
		this.#textLayer[textScreenId].putch32(codePoint);
	}

	/**
	 * 描画（するときに設定するHTML文字列の生成）
	 * @param {number} textScreenId テキストID
	 * @returns HTMLに設定する文字列
	 */
	draw(textScreenId = this.#defaultTextScreenId)
	{
		return this.#textLayer[textScreenId].draw();
	}

	/**
	 * 外部関数定義情報を取得する
	 * @returns {Array} 外部関数定義情報
	 */
	extFunctions()
	{
		return [
			{
				/**
				 * 関数名
				 */
				funcName: "CLS",
				/**
				 * 引数の数
				 */
				argumentCount:0,
				/**
				 * 引数のタイプリスト
				 */
				args:[], // 引数なし
				/**
				 * 返り値の数
				 */
				returnCount:0,
				/**
				 * 返り値のタイプリスト
				 */
				rets:[], // 返り値なし
				/**
				 * 呼び出される関数
				 */
				callback:()=>{ this.#CLS(this.#defaultTextScreenId); }
			},
			{
				/**
				 * 関数名
				 */
				funcName: "CLS",
				/**
				 * 引数の数
				 */
				argumentCount:1,
				/**
				 * 引数のタイプリスト
				 */
				args:[this.#numAsInt], // 整数
				/**
				 * 返り値の数
				 */
				returnCount:0,
				/**
				 * 返り値のタイプリスト
				 */
				rets:[], // 返り値なし
				/**
				 * 呼び出される関数
				 */
				callback: (textScreenId) => { this.#CLS(textScreenId); }
			},
			{
				/**
				 * 関数名
				 */
				funcName: "COLOR",
				/**
				 * 引数の数
				 */
				argumentCount:1,
				/**
				 * 引数のタイプリスト
				 */
				args:[this.#numAsInt],
				/**
				 * 返り値の数
				 */
				returnCount:0,
				/**
				 * 返り値のタイプリスト
				 */
				rets:[], // 返り値なし
				/**
				 * 呼び出される関数
				 */
				callback: (rgba) => { this.#COLOR(this.#defaultTextScreenId, rgba); }
			},
			{
				/**
				 * 関数名
				 */
				funcName: "COLOR",
				/**
				 * 引数の数
				 */
				argumentCount:2,
				/**
				 * 引数のタイプリスト
				 */
				args:[this.#numAsInt, this.#numAsInt],  // 整数、整数の2個の引数
				/**
				 * 返り値の数
				 */
				returnCount:0,
				/**
				 * 返り値のタイプリスト
				 */
				rets:[], // 返り値なし
				/**
				 * 呼び出される関数
				 */
				callback: (textScreenId, rgba) => { this.#COLOR(textScreenId, rgba); }
			},
			{
				/**
				 * 関数名
				 */
				funcName: "LOCATE",
				/**
				 * 引数の数
				 */
				argumentCount:2,
				/**
				 * 引数のタイプリスト
				 */
				args:[this.#numAsInt, this.#numAsInt],  // 整数、整数の2個の引数
				/**
				 * 返り値の数
				 */
				returnCount:0,
				/**
				 * 返り値のタイプリスト
				 */
				rets:[], // 返り値なし
				/**
				 * 呼び出される関数
				 */
				callback: (x, y) => { this.#LOCATE(this.#defaultTextScreenId, x, y); }
			},
		];
		[
			{
				funcName: "COLOR",
				/**
				 * 返り値のタイプリスト
				 */
				rets:[this.#int], // 整数の返り値１個
				callback: () => { return this.#funcCOLOR(this.#defaultTextScreenId); }
			},
			{
				funcName: "COLOR",
				args:[this.#numAsInt], // 整数
				/**
				 * 返り値のタイプリスト
				 */
				rets:[this.#int], // 整数の返り値１個
				callback: (textScreenId) => { return this.#funcCOLOR(textScreenId); }
			}
		];
	}

	/**
	 * 画面クリア
	 * @param {number} textScreenId クリアするテキストID
	 * @returns {Object} 処理結果
	 */
	#CLS(textScreenId)
	{
		if(textScreenId < 0 || textScreenId >= this.#textScreenIdSize) { return { resultCode: "範囲外の値です。" }; }
		this.#textLayer[textScreenId].CLS();
		return { resultCode: 0 };
	}

	/**
	 * 描画色を設定する
	 * @param {number} textScreenId テキストID
	 * @param {number} rgba 描画色
	 * @returns {Object} 処理結果
	 */
	#COLOR(textScreenId, rgba)
	{
		if(textScreenId < 0 || textScreenId >= this.#textScreenIdSize) { return { resultCode: "範囲外の値です。" }; }
		this.#textLayer[textScreenId].COLOR(rgba);
		return { resultCode: 0 };
	}

	/**
	 * 描画色を設定する
	 * @param {number} textScreenId テキストID
	 * @param {number} rgba 描画色
	 * @returns {Object} 処理結果
	 */
	#LOCATE(textScreenId, x, y)
	{
		if(textScreenId < 0 || textScreenId >= this.#textScreenIdSize) { return { resultCode: "範囲外の値です。" }; }
		this.#textLayer[textScreenId].LOCATE(x, y);
		return { resultCode: 0 };
	}

	/**
	 * 描画色を取得する
	 * @param {number} textScreenId テキストID
	 * @returns {Object} 処理結果
	 */
	#funcCOLOR(textScreenId)
	{
		if(textScreenId < 0 || textScreenId >= this.#textScreenIdSize) { return { resultCode: "範囲外の値です。" }; }
		return {
			resultCode: 0,
			rets:[this.#textLayer[textScreenId].funcCOLOR()]
		};
	}
}
