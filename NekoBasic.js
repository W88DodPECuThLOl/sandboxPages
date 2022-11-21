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
			printDouble: (value) => { oneLineText += value.toFixed(6); }
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
		for(var i = 0; i < 100; ++i) {
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
