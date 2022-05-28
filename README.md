# HTTP client

HTTPリクエストを投げることができます。きっと、REST APIの動作確認等に便利だと思います。

# 書き方

例）
```
POST てすと
  http://test-page.jp/
  page=1
Content-Type: application/json

{"dummy":"1"}
```
---

## HTTPメソッド
1行目で指定します。GET, HEAD, POST, PUT, DELETE, CONNECT, OPTIONS, TRACE, PATCHのいずれかです。
後ろに空白を開けてコメントを記載することができます。

例）`GET  例のブツを取得`

## URL
リクエストURLは2行目にインデントをつけて記述します。HTTPメソッドの直後に書いてもコメントと認識されるだけなので注意してください。

例）`  http://example.com/`


クエリパラメタを付けても付けなくても構いません。

## クエリパラメタ
3行目以降に記述できます。行頭は1つ以上の空白を挿入し、パラメタ名と値はイコール`=`で区切ります。イコールの前後の空白は除去した上でURLエンコーディングを行い、リクエストURLに結合されます。

例) `  page = 1`

※ クエリパラメタは空行を挟むことはできません。

## HTTPヘッダ
3行目以降に記述できます。
行頭に空白を挿入することはできません。ヘッダ名と値はコロン`:`で区切ります。

例) `Content-type: Application/json`

※ HTTPヘッダは空行を挟むことはできません。

## リクエストボディ
クエリパラメタ、HTTPヘッダから空行を一つ開けて以降がリクエストボディとなります。
行頭からハイフン4つが並ぶ行はリクエストの終了とみなされます。


---
## License
   Copyright 2022 yum Communication Co. Ltd.

   Licensed under the Apache License, Version 2.0 (the "License");
   you may not use this file except in compliance with the License.
   You may obtain a copy of the License at

       http://www.apache.org/licenses/LICENSE-2.0

   Unless required by applicable law or agreed to in writing, software
   distributed under the License is distributed on an "AS IS" BASIS,
   WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   See the License for the specific language governing permissions and
   limitations under the License.