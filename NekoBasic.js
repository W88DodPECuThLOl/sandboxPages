//export default 
class NekoBasic {
	wasmNekoBasic;

	// 使用するヒープサイズ(64KiBの倍数であること)
	#heapSize = 256*1024*1024; // 256MiB
	#memory;

	// 実行中かどうかのフラグ
	isRunning = 0;
	#oneLineText = "";

	#handleAnimationFrame;

	#callbackOutput;
	#callbackStateChange;
	#callbackLoadTextFile;

	/**
	 * 文字列をNekoBasicで使用できる文字列へ変換する
	 * @param {*} source 文字列
	 * @returns NekoBasicで使用できる文字列へのポインタ
	 */
	#convertUTF32(source) {
		// NekoBasic側からヒープを確保
		const len = source.length;
		const memPtr = this.wasmNekoBasic.NekoBasicMalloc(len + 1);
		let utf32 = new Uint32Array(this.#memory.buffer, memPtr, len + 1);
		// 確保したヒープに文字列を設定
		let dst = 0;
		for (let codePoint of source) {
			utf32[dst++] = codePoint.codePointAt(0); // UTF32に変換する
		}
		utf32[dst] = 0;
		return memPtr;
	}

	/**
	 * 
	 * @param {string} nekoString 猫専用文字列
	 * @param {number} nekoStringSize 終端文字を含まない文字列のサイズ
	 * @return {string} JSで使用できる文字列
	 */
	 #nekoStringToString(nekoString, nekoStringSize)
	 {
		 let s = "";
		 const utf32 = new Uint32Array(this.#memory.buffer, nekoString, nekoStringSize);
		 for(let i = 0; i < nekoStringSize; ++i) {
			 s += String.fromCodePoint(utf32[i]);
		 }
		 return s;
	 }
 
	/**
	 * ソースを設定する
	 * @param {*} slotNo スロット番号
	 * @param {*} memPtrFileName ファイル名
	 * @param {*} memPtrSource ソースコード
	 * @returns 処理結果
	 */
	#setSourceInternal(slotNo, memPtrFileName, memPtrSource)
	{
		// ソースを設定する
		if(!this.wasmNekoBasic.NekoBasicSetSource(slotNo, fileName, memPtr)) {
			// エラー
			this.#setRunning(0); // 実行していたら停止する
			return false;
		}
		return true;
	}

	// 実行状態を設定する
	#setRunning(state)
	{
		if(this.isRunning != state) {
			if(this.#callbackStateChange) {
				this.#callbackStateChange(state); // 実行状態を通知
			}
		}
		this.isRunning = state;
	}

	#setup() {
		const importObject = {
			env: { memory: this.#memory },
			js: {
				// UTF-32の文字を表示する
				// i32 ch
				putchar: (ch) => {
					if(ch!=10) {
						if(ch==32) {
							this.#oneLineText += "&nbsp;";
						} else {
							this.#oneLineText += String.fromCodePoint(ch);
						}
					} else {
						if(this.#callbackOutput) {
							this.#callbackOutput(this.#oneLineText)
						}
						this.#oneLineText = "";
					}
				},
				// doubleを表示する
				// f64 value
				printDouble: (value) => { this.#oneLineText += value.toFixed(6); },
				// 実数を指定された固定小数点形式で文字列に変換する
				// f64 value
				// s32 digits
				// ret pointer
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
				date: () => {
					const today = new Date();
					// YYYYMMDD
					return today.getFullYear() * 10000 + (today.getMonth() + 1) * 100 + today.getDate();
				},
				time: () => {
					// hhmmss
					const today = new Date();
					return today.getHours() * 10000 + today.getMinutes() * 100 + today.getSeconds();
				},
				loadTextFile: (filenamePtr, filenameSize) => {
					if(this.#callbackLoadTextFile) {
						const filename = this.#nekoStringToString(filenamePtr, filenameSize);
						const rc = this.#callbackLoadTextFile(filename);
						if(rc.result) {
							// 成功
							return this.#convertUTF32(rc.text);
						} else {
							return 0; // 失敗した
						}
					} else {
						// コールバック関数が登録されていない
						return 0;
					}
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
				isinf: (x) => {
					if(x === Number.POSITIVE_INFINITY) return true;
					if(x === Number.NEGATIVE_INFINITY) return true;
					return false;
				},
				isNan: (x) => { return Number.isNaN() ? true : false; },
			}
		};
		WebAssembly.instantiateStreaming(fetch("NekoBasic.wasm"), importObject).then(
			(obj) => {
				this.wasmNekoBasic = obj.instance.exports;
				// 初期化
				this.wasmNekoBasic._Z9setupHeapPvm(this.wasmNekoBasic.__heap_base, this.#heapSize - this.wasmNekoBasic.__heap_base);
				this.wasmNekoBasic.NekoBasicInitialize();
			}
		);
	}

	/**
	 * 更新処理
	 * @returns 
	 */
	#update() {
		if(this.isRunning) {
			for(var i = 0; i < 200; ++i) {
				if(!this.wasmNekoBasic.NekoBasicExecuteOneStep()) {
					// 実行完了、または、失敗したので、停止する
					this.#setRunning(0);
					return;
				}
			}
			this.#handleAnimationFrame = requestAnimationFrame(()=> this.#update());
		}
	}

	/**
	 * ソースを設定する
	 * @param {*} slotNo スロット番号
	 * @param {*} memPtrFileName ファイル名
	 * @param {*} memPtrSource ソースコード
	 * @returns 処理結果
	 */
	 setSource(slotNo, filename, source)
	 {
		// 文字列をNekoBasicで使えるように変換
		const memPtrFilename = this.#convertUTF32(filename);
		const memPtrSource = this.#convertUTF32(source);
		 // ソースを設定する
		 if(!this.wasmNekoBasic.NekoBasicSetSource(slotNo, memPtrFilename, memPtrSource)) {
			 // エラー
			 this.#setRunning(0); // 実行していたら停止する
			 return false;
		 }
		 return true;
	 }

	 /**
	 * 実行する
	 * @returns 
	 */
	 run() {
		if(this.isRunning) {
			return; // 既に実行中
		}

		// 初期化
		this.#oneLineText = "";

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

	constructor(callbacks)
	{
		this.#callbackOutput = callbacks.output;
		this.#callbackStateChange = callbacks.stateChange;
		this.#callbackLoadTextFile = callbacks.loadTextFile;
		this.#memory = new WebAssembly.Memory({ initial: ~~(this.#heapSize/(64*1024)), maximum: ~~(this.#heapSize/(64*1024) + 1) });
		this.#setup();
	}
}
