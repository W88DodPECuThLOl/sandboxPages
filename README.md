# sandbox Neko Basic

## Neko Basicとは？

- 猫御用達のBASICです
- コンパイラを勉強する目的で作成しています
  - 字句解析、構文解析、意味解析、最適化、エラー処理など
- Web Assemblyを～以下略
  - clangやwasmなど
- ライブラリを極力利用しない
  - ライブラリをなるべく使用しない方針で作成しています
  - 例外を使用するとclangとWebAssemblyが面倒なので、使用しない
    - 例外処理の実装方法が、分かれば対応したい

## ライセンスについて

- Neko Basic部分は、MITライセンスから著作権表示の義務をなくしたものにする予定です。  
（そういうライセンスがあれば、それを使うように変更します。）

- ソースコードの表示、編集部分に「ACE」を使用しています。  
ライセンスは「LICENSE」を見てください。

- ZIPファイルの展開にJSZip、JSZipUtilsを使用しています。  
ライセンスは「LICENSE」を見てください。

## To do list

- ~~ファイル読み込み~~
  - ~~zipファイルで出来たらいいな~~
- 外部関数の呼び出し
  - JavaScriptやDLLの呼び出しに対応
- ソースコード公開
  - ソース整理、整頓
  - コメント書く
- エラー表示
  - 字句解析中のエラー表示
  - 構文解析中のエラー表示
  - 意味解析中のエラー表示
- 最適化の実装
  - 定数の演算の削除
  - 不要なラベルの削除
  - 不要なジャンプ命令の削除
