//export default 
class NekoBasic {
	/**
	 * Neko Basicのエクスポート部分
	 */
	wasmNekoBasic;

	/**
	 * 使用するヒープサイズ(64KiBの倍数であること)
	 */
	#heapSize = 256*1024*1024; // 256MiB

	/**
	 * Wasmのメモリ
	 */
	#memory;

	#extFuncs;
	#extCallbackFunc = new Array();
	
	/**
	 * 実行中かどうかのフラグ
	 * 0 : 停止状態
	 * 1 : 実行状態
	 */
	isRunning = 0;

	/**
	 * requestAnimationFrame()の返り値。
	 * 停止するときに使用。
	 */
	#handleAnimationFrame;

	/**
	 * １文字出力する
	 */
	#callbackPutchar;
	/**
	 * 状態変化時に呼び出される
	 */
	#callbackStateChange;
	/**
	 * テキストファイルを読み込むときに、呼び出される
	 */
	#callbackLoadTextFile;
	/**
	 * VSync待ちの前に呼び出される
	 */
	#callbackVSync;

	#int = 1;
	#real = 2;
	#str = 3;
	#array = 4;

	/**
	 * JSの文字列をNekoBasicで使用できる文字列へ変換する
	 * @param {string} text JSの文字列
	 * @returns {memPtr} NekoBasicで使用できる文字列へのポインタ
	 */
	#stringTonekoString(text) {
		// NekoBasic側からヒープを確保
		const len = text.length;
		const memPtr = this.wasmNekoBasic.NekoBasicMalloc(len + 1);
		let utf32 = new Uint32Array(this.#memory.buffer, memPtr, len + 1);
		// 確保したヒープに文字列を設定
		let dst = 0;
		for (let codePoint of text) {
			utf32[dst++] = codePoint.codePointAt(0); // UTF32に変換する
		}
		utf32[dst] = 0;
		return memPtr;
	}

	/**
	 * 猫専用文字列をJSで使える文字列に変換する
	 * @param {memPtr} memPtrNekoString 猫専用文字列
	 * @param {number} nekoStringSize 終端文字を含まない文字列のサイズ
	 * @return {string} JSで使用できる文字列
	 */
	 #nekoStringToString(memPtrNekoString, nekoStringSize)
	 {
		 let s = "";
		 const utf32 = new Uint32Array(this.#memory.buffer, memPtrNekoString, nekoStringSize);
		 for(let i = 0; i < nekoStringSize; ++i) {
			 s += String.fromCodePoint(utf32[i]);
		 }
		 return s;
	 }
 
	/**
	 * 実行状態を設定する
	 * @param {number} state 実行状態
	 */
	#setRunning(state)
	{
		if(this.isRunning != state) {
			if(this.#callbackStateChange) {
				this.#callbackStateChange(state); // 実行状態を通知
			}
			this.isRunning = state;
		}
	}

	/**
	 * NekoBasicの読み込みと初期化
	 */
	#setup(funcs) {
		this.#extFuncs = funcs;
		const importObject = {
			env: { memory: this.#memory },
			js: {
				/**
				 * UTF-32の文字を表示する
				 * @param {number} ch UTF-32の文字
				 */
				putchar: (ch) => {
					if(this.#callbackPutchar) {
						this.#callbackPutchar(ch);
					}
				},
				/**
				 * doubleを表示する
				 * @param {number} value 表示する実数
				 */
				printDouble: (value) => {
					if(this.#callbackPutchar) {
						for (let codePoint of value.toFixed(6)) {
							this.#callbackPutchar(codePoint.codePointAt(0));
						}
					}
				},
				/**
				 * 実数を指定された固定小数点形式で文字列に変換する
				 * @param {number} value 変換する実数
				 * @param {number} digits 小数点部分の桁数
				 * @returns {memPtr} 変換された文字列へのポインタ
				 */
				floatToString: (value, digits) => {
					const source = value.toFixed(digits);
					const memPtr = this.wasmNekoBasic.NekoBasicMalloc(source.length + 1);
					let utf32 = new Uint32Array(this.#memory.buffer, memPtr, source.length + 1);
					let dst = 0;
					for (let codePoint of source) { utf32[dst++] = codePoint.codePointAt(0); }
					utf32[dst] = 0;
					return memPtr;
				},
			},
			core: {
				/**
				 * 年月日を取得する
				 * @returns {number} 年月日を整数に変換した値(YYYYMMDD)
				 */
				date: () => {
					const today = new Date();
					// YYYYMMDD
					return today.getFullYear() * 10000 + (today.getMonth() + 1) * 100 + today.getDate();
				},
				/**
				 * 時分秒を取得する
				 * @returns {number} 時分秒を整数に変換した値(hhmmss)
				 */
				time: () => {
					// hhmmss
					const today = new Date();
					return today.getHours() * 10000 + today.getMinutes() * 100 + today.getSeconds();
				},
				/**
				 * テキストファイルを読み込む
				 * @param {memPtr} memPtrFilename	ファイル名の文字列へのポインタ
				 * @param {number} filenameSize 	ファイル名のサイズ
				 * @returns {memPtr} 読み込んだテキストの文字列へのポインタ
				 */
				loadTextFile: (memPtrFilename, filenameSize) => {
					if(this.#callbackLoadTextFile) {
						const filename = this.#nekoStringToString(memPtrFilename, filenameSize);
						const rc = this.#callbackLoadTextFile(filename);
						if(rc.result) {
							// 成功
							return this.#stringTonekoString(rc.text);
						} else {
							return 0; // 失敗した
						}
					} else {
						// コールバック関数が登録されていない
						return 0;
					}
				},
				/**
				 * 外部登録の呼び出し
				 * @param {*} extFuncId 
				 * @param {*} memPtrArgs 
				 * @param {*} memPtrRets 
				 */
				extFunctionCall: (extFuncId, memPtrArgs, argsSize, memPtrRets, retsSize) => {
					let idx = 0;
					const argsCount = memPtrArgs ? (new BigInt64Array(this.#memory.buffer, memPtrArgs, argsSize))[0] : 0;
					const retsCount = memPtrRets ? (new BigInt64Array(this.#memory.buffer, memPtrRets, retsSize))[0] : 0;
					if(retsCount == 0) {
						// 返り値なし
						if(argsCount == 0) {
							// 引数なし
							this.#extCallbackFunc[extFuncId].callback();
						} else if(argsCount == 1) {
							// 引数1個
							const argsDataInt  = new BigInt64Array(this.#memory.buffer, memPtrArgs, argsSize);
							const argsDataReal = new Float64Array(this.#memory.buffer, memPtrArgs, argsSize);
							let arg1 = 0;
							idx = 1;
							const t = Number(argsDataInt[idx++]);
							if(t == this.#int) {
								// s32
								arg1 = Number(argsDataInt[idx++]);
							} else if(t == this.#real) {
								// double
								arg1 = argsDataReal[idx++];
							} else if(t == this.#str) {
								// string
								const strSize   = Number(argsDataInt[idx++]); // 文字列の長さ
								const memPtrStr = Number(argsDataInt[idx++]); // 文字列へのポインタ
								arg1 = this.#nekoStringToString(memPtrStr, strSize);
							} else {
								// 配列 未対応
							}
							this.#extCallbackFunc[extFuncId].callback(arg1);
						} else if(argsCount == 2) {
							// 引数2個
							const argsDataInt  = new BigInt64Array(this.#memory.buffer, memPtrArgs, argsSize);
							const argsDataReal = new Float64Array(this.#memory.buffer, memPtrArgs, argsSize);
							let arg1 = 0;
							let arg2 = 0;
							idx = 1;
							let t = Number(argsDataInt[idx++]);
							if(t == this.#int) {
								// s32
								arg1 = Number(argsDataInt[idx++]);
							} else if(t == this.#real) {
								// double
								arg1 = argsDataReal[idx++];
							} else if(t == this.#str) {
								// string
								const strSize   = Number(argsDataInt[idx++]); // 文字列の長さ
								const memPtrStr = Number(argsDataInt[idx++]); // 文字列へのポインタ
								arg1 = this.#nekoStringToString(memPtrStr, strSize);
							} else {
								// 配列 未対応
							}

							t = Number(argsDataInt[idx++]);
							if(t == this.#int) {
								// s32
								arg2 = Number(argsDataInt[idx++]);
							} else if(t == this.#real) {
								// double
								arg2 = argsDataReal[idx++];
							} else if(t == this.#str) {
								// string
								const strSize   = Number(argsDataInt[idx++]); // 文字列の長さ
								const memPtrStr = Number(argsDataInt[idx++]); // 文字列へのポインタ
								arg2 = this.#nekoStringToString(memPtrStr, strSize);
							} else {
								// 配列 未対応
							}
							this.#extCallbackFunc[extFuncId].callback(arg1, arg2);
						}
					}
					return 0;
				}
			},
			Math: {
				floor: (x) => Math.floor(x),
				round: (x) => Math.round(x),
				ceil: (x) => Math.ceil(x),
				sqrt: (x) => Math.sqrt(x),
				random: () => Math.random(),
				exp: (x) => Math.exp(x),
				pow: (x,y) => Math.pow(x, y),
				log: (x) => Math.log(x),
				log10: (x) => Math.log10(x),
				log2: (x) => Math.log2(x),
				sin: (x) => Math.sin(x),
				cos: (x) => Math.cos(x),
				tan: (x) => Math.tan(x),
				asin: (x) => Math.asin(x),
				acos: (x) => Math.acos(x),
				atan: (x) => Math.atan(x),
				atan2: (y,x) => Math.atan2(y,x),
				sinh: (x) => Math.sinh(x),
				cosh: (x) => Math.cosh(x),
				tanh: (x) => Math.tanh(x),
				/**
				 * 無限大かどうか
				 * @param {number} x 調べる実数
				 * @returns {boolean} 無限大なら true を返す
				 */
				isinf: (x) => {
					if(x === Number.POSITIVE_INFINITY) return true;
					if(x === Number.NEGATIVE_INFINITY) return true;
					return false;
				},
				/**
				 * 非数かどうか
				 * @param {number} x 調べる実数
				 * @returns {boolean} 非数なら true を返す
				 */
				isNan: (x) => { return Number.isNaN(x) ? true : false; },
			}
		};
		WebAssembly.instantiateStreaming(fetch("NekoBasic.wasm"), importObject).then(
			(obj) => {
				this.wasmNekoBasic = obj.instance.exports;
				// 初期化
				this.wasmNekoBasic._Z9setupHeapPvm(this.wasmNekoBasic.__heap_base, this.#heapSize - this.wasmNekoBasic.__heap_base);
				this.wasmNekoBasic.NekoBasicInitialize();

				// 外部関数の登録
				for(const func of this.#extFuncs) {
					this.extFunctions(func.extFunctions());
				}
			}
		);
	}

	/**
	 * 文字列をコンソールに出力する
	 * @param {string} text 出力する文字列
	 */
	#outputString(text)
	{
		if(this.#callbackPutchar) {
			for (let codePoint of text) {
				this.#callbackPutchar(codePoint.codePointAt(0));
			}
		}
	}

	/**
	 * 更新処理
	 */
	#update() {
		if(this.#callbackVSync) {
			this.#callbackVSync();
		}
		if(this.isRunning) {
			for(var i = 0; i < 400; ++i) {
				if(!this.wasmNekoBasic.NekoBasicExecuteOneStep()) {
					// 実行完了、または、失敗したので、停止する
					this.#setRunning(0);
					// BASICっぽく"OK"って表示する
					this.#outputString("OK\n");
					// VSyncでバッファを出力する想定でなので、VSyncを呼び出して表示させる。
					if(this.#callbackVSync) {
						this.#callbackVSync();
					}
					return;
				}
			}
			this.#handleAnimationFrame = requestAnimationFrame(()=> this.#update());
		}
	}

	extFunctions(funcInfos)
	{
		for(let funcInfo of funcInfos) {
			console.log('funcName:' + funcInfo.funcName);

			const pointerSize = 4; // wasm32
			const bufferSize = pointerSize // const c32* funcName
				+ 4 // const s32 argumentCount
				+ 4 // const s32 returnCount
				+ ((funcInfo.argumentCount > 0) ? funcInfo.argumentCount : 0) * 4
				+ ((funcInfo.returnCount > 0) ? funcInfo.returnCount : 0) * 4

			const memPtr = this.wasmNekoBasic.NekoBasicMalloc(bufferSize / 4);
			let utf32 = new Uint32Array(this.#memory.buffer, memPtr, bufferSize);
			let dst = 0;
			if(pointerSize == 4) {
				utf32[dst++] = this.#stringTonekoString(funcInfo.funcName);
			} else {
				const address = this.#stringTonekoString(funcInfo.funcName);
				utf32[dst++] = address & 0xFFFFFFFF;
				utf32[dst++] = (address >> 32) & 0xFFFFFFFF;
			}
			utf32[dst++] = funcInfo.argumentCount;
			utf32[dst++] = funcInfo.returnCount;
			for(let i = 0; i < funcInfo.args.length; ++i) {
				utf32[dst++] = funcInfo.args[i];
			}
			for(let i = 0; i < funcInfo.rets.length; ++i) {
				utf32[dst++] = funcInfo.rets[i];
			}

			const funcId = this.wasmNekoBasic.NekoBasicRegisterExtFunction(memPtr);
			if(funcId > 0) {
				// 登録に成功した
				this.#extCallbackFunc[funcId] = {
					callback: funcInfo.callback,
					argsType: funcInfo.args
				};
			} else {
				// 登録に失敗した
				return false;
			}
		}
	}

	/**
	 * ソースコードを設定する
	 * @param {number} slotNo スロット番号
	 * @param {string} fileName ファイル名
	 * @param {string} source ソースコード
	 * @returns {boolean} 処理結果
	 */
	setSource(slotNo, filename, source)
	{
		// 文字列をNekoBasicで使えるように変換
		const memPtrFilename = this.#stringTonekoString(filename);
		const memPtrSource = this.#stringTonekoString(source);
		// ソースを設定する
		if(!this.wasmNekoBasic.NekoBasicSetSource(slotNo, memPtrFilename, memPtrSource)) {
			// エラー
			this.#setRunning(0); // 実行していたら停止する
			// VSyncでバッファを出力する想定でなので、VSyncを呼び出してエラーを表示させる。
			if(this.#callbackVSync) {
				this.#callbackVSync();
			}
			return false; // 失敗
		}
		return true; // 成功
	}

	/**
	 * 実行する
	 */
	run() {
		if(this.isRunning) {
			return; // 既に実行中
		}

		// 実行開始
		this.#setRunning(1);
		this.#handleAnimationFrame = requestAnimationFrame(()=>this.#update());
	}

	/**
	 * 停止する
	 */
	stop() {
		this.#setRunning(0);
		cancelAnimationFrame(this.#handleAnimationFrame);
	}

	/**
	 * コンストラクタ
	 * @constructor
	 * @param {Object} callbacks 各種コールバック関数
	 * @example
	 * const callbacks = {
	 * 	putchar: (x) => {
	 * 		// １文字出力する
	 * 		// xはUTF32の文字
	 *	},
	 * 	vSync: () => {
	 * 		// VSyncの前に呼び出される。
	 *	},
	 * 	stateChange: (state) => {
	 * 		if(state) {
	 * 			// 実行中になった
	 * 		} else {
	 * 			// 停止した
	 * 		}
	 * 	},
	 *  loadTextFile: (filename)=> {
	 * 		// 成功した場合
	 * 		return {result: true, text: "読み込んだファイルの内容"};
	 * 		// 失敗した場合
	 * 		return {result: false, text: ""};
	 * 	}
	 * };
	 * var nb = new NekoBasic(callbacks);
	 */
	constructor(callbacks, extFuncs)
	{
		// メモリ
		this.#memory = new WebAssembly.Memory({ initial: ~~(this.#heapSize/(64*1024)), maximum: ~~(this.#heapSize/(64*1024) + 1) });
		// 各種コールバック
		this.#callbackStateChange = callbacks.stateChange;
		this.#callbackLoadTextFile = callbacks.loadTextFile;
		this.#callbackPutchar = callbacks.putchar;
		this.#callbackVSync = callbacks.vSync;
		// 起動時のメッセージ
		if(this.#callbackPutchar && this.#callbackVSync) {
			// BASICっぽくバージョン情報などを表示してみる
			this.#outputString("Neko Basic Version 0.00.00\nOK\n");
			this.#callbackVSync();
		}
		// セットアップ
		this.#setup(extFuncs);
	}
}
