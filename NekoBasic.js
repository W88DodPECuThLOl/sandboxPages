var wasmNekoBasic;

// 使用するヒープサイズ
var heapSize = 256*1024*1024; // 256MiB (64KiBの倍数であること)
const memory = new WebAssembly.Memory({ initial: ~~(heapSize/(64*1024)), maximum: ~~(heapSize/(64*1024) + 1) });

// 実行中かどうかのフラグ
var isRunning = 0;
var oneLineText = "";

// 実行状態を設定する
function setRunning(state)
{
	if(isRunning != state) {
		let runningState = document.getElementById("runningState");
		if(state) {
			runningState.innerHTML = "Stop";
		} else {
			runningState.innerHTML = "Execute";
		}
	}
	isRunning = state;
}

// ソースを設定して実行する
function clickExecuteOrStop(source) {
	if(isRunning) {
		// 実行中になら停止する
		setRunning(0);
		return;
	}
	oneLineText = "";
	document.getElementById("wasmOutput").innerHTML = "";

	// ソースをUTF32に変換する
	var len = source.length;
	var memPtr = wasmNekoBasic.NekoBasicMalloc(len + 1);
	var utf32 = new Uint32Array(memory.buffer, memPtr, len + 1);
	var dst = 0;
	for (let codePoint of source) {
		utf32[dst++] = codePoint.codePointAt(0);
	}
	utf32[dst] = 0;
	
	// ソースを設定する
	var slotNo = 0;
	if(!wasmNekoBasic.NekoBasicSetSource(slotNo, 0, memPtr)) {
		setRunning(0);
		alert("設定に失敗しました。");
		return;
	}

	// 実行開始
	setRunning(1);
	update();
}

function setup() {
	setRunning(0);
	const importObject = {
		env: { memory: memory },
		js: {
			// UTF-32の文字を表示する
			// i32 ch
			putchar: (ch) => {
				if(ch!=10) {
					if(ch==32) {
						oneLineText += "&nbsp;";
					} else {
						oneLineText += String.fromCodePoint(ch);
					}
				} else {
					document.getElementById("wasmOutput").innerHTML += oneLineText + "<br>";
					oneLineText = "";
				}
			},
			// doubleを表示する
			// f64 value
			printDouble: (value) => { oneLineText += value.toFixed(6); },
			// 実数を指定された固定小数点形式で文字列に変換する
			// f64 value
			// s32 digits
			// ret pointer
			floatToString: (value, digits) => {
				var source = value.toFixed(digits);
				var memPtr = wasmNekoBasic.NekoBasicMalloc(source.length + 1);
				var utf32 = new Uint32Array(memory.buffer, memPtr, source.length + 1);
				var dst = 0;
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
			wasmNekoBasic = obj.instance.exports;
			// 初期化
			obj.instance.exports._Z9setupHeapPvm(obj.instance.exports.__heap_base, heapSize - obj.instance.exports.__heap_base);
			wasmNekoBasic.NekoBasicInitialize();
		}
	);
}

function update() {
	if(isRunning) {
		/*
		// 1/60経過するまで、実行するようにしてみる
		// メモ）240Hzのモニタで不安定になる……
		const end = performance.now() + (1000.0/60.0);
		while(end >= performance.now()){
			if(!wasmNekoBasic.NekoBasicExecuteOneStep()) {
				// 実行完了、または、失敗したので、停止する
				setRunning(0);
				return;
			}
		}
		requestAnimationFrame(update);
		*/
		for(var i = 0; i < 200; ++i) {
			if(!wasmNekoBasic.NekoBasicExecuteOneStep()) {
				// 実行完了、または、失敗したので、停止する
				setRunning(0);
				return;
			}
		}
		requestAnimationFrame(update);
	}
}
setup();
