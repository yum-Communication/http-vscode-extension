import {commands, ExtensionContext, languages, Position, TextDocument, window, workspace} from 'vscode';
import {HttpParameters, query, RequestConfig, Response} from './htReq';
import { CodelensProvider } from './CodelensProvider';
import { AxiosRequestHeaders, AxiosResponseHeaders } from "axios";
import * as fs from "fs/promises";
const path = require('path');

export function activate(context: ExtensionContext) {

	const codelensProvider = new CodelensProvider();
	languages.registerCodeLensProvider({language:"httprequest"}, codelensProvider);


	context.subscriptions.push(commands.registerCommand('HttpClient.sendRequestOne', (line:number) => {
		if(window.activeTextEditor !== undefined) {
			sendOne(window.activeTextEditor.document, line)
				.catch((reason) => {
					window.showErrorMessage(reason);
				});
		}
	}));

	
	context.subscriptions.push(commands.registerCommand('HttpClient.sendRequest', async () => {
		if(window.activeTextEditor !== undefined && window.activeTextEditor.document !== undefined) {
			const doc = window.activeTextEditor.document;
			let line:number = 0;
			while(line >= 0 && line < doc.lineCount) {
				try{
					line = await sendOne(doc, line) + 1;
				}catch(exp) {
					window.showErrorMessage(exp as string);
					break;
				}
			}
		}
	}));
}

export function deactivate() {}


function sendOne(doc:TextDocument, line:number):Promise<number> {
	return new Promise((resolve, reject)=>{
		const rgxMethod = /^(GET|HEAD|POST|PUT|DELETE|CONNECT|OPTIONS|TRACE|PATCH)/;
		const rgxUrl = /^https?:\/\/[a-z][-0-9a-z]+(\.[a-z][-0-9a-z]+)*(:[1-9][0-9]*)?(\/[-%.0-9A-Z_a-z]+)*/;
		const rgxParam = /^\s+([A-Z_a-z][-0-9A-Z_a-z]*)\s*=\s*(.+)\s*$/;
		const rgxHeader = /^([A-Z_a-z][-0-9A-Z_a-z]*)\s*:\s*(.+)\s*$/;
		const rgxFiles = /^\$(body|header|response|proxy)\("([^"]+)"\)$/;
		const rgxSepa = /^----+/;

		const conf:RequestConfig = {
			url: "",
			method: '',
		};
		const queries: HttpParameters = {};
		const headers: AxiosRequestHeaders = {};
		let body:string = "";

		let headerFile:string = "";
		let bodyFile:string = "";
		let responseFile:string = "";
		let proxy:string = "";

		let hasParams = false;
		let mode = 0;
		let lineIdx = line;
		while(lineIdx < doc.lineCount) {
			let m:RegExpExecArray|null;
			const t = doc.lineAt(lineIdx).text;
			if(mode === 0){
				if(conf.method === '' ) {
					m = rgxMethod.exec(t);
					if(m !== null) {
						conf.method = m[0];
					} else {
						reject("Line(" + (lineIdx + 1) + "): Bad HTTP request: " + t);
					}
				} else if(conf.url === '') {
					let url = t.replace(/^\s+/, '');
					let m:RegExpExecArray|null = rgxUrl.exec(url);
					if(m !== null) {
						conf.url = url;
						const px = url.indexOf('?');
						if(px === url.length) {
							// 末尾がクエスチョンマークならば切り落とす
							url = url.substring(1, -1);
						} else if(px > 0) {
							hasParams = true;
						}
					} else {
						reject("Line(" + (lineIdx + 1) + "): Bad URL: " + t);
					}
				} else {
					// ヘッダ
					if(t.length === 0) {
						// 空行の場合、ヘッダの終了を意味する
						mode = 1;
					} else if((m = rgxSepa.exec(t)) !== null) {
						// 終端検出
						break;
					} else if((m = rgxParam.exec(t)) !== null) {
						// クエリパラメタ
						queries[m[1]] = m[2];
					} else if((m = rgxHeader.exec(t)) !== null) {
						// HTTPヘッダ
						headers[m[1]] = m[2];
					} else if((m = rgxFiles.exec(t)) !== null) {
						// ファイル名指定の処理
						switch(m[1]) {
							case 'header':
								if(headerFile !== '') {
									reject("Line(" + (lineIdx + 1) + "): Header file is already specified.");
									return -1;
								}
								headerFile = m[2];
								break;
							case 'body':
								if(bodyFile !== '') {
									reject("Line(" + (lineIdx + 1) + "): Body file is already specified.");
									return -1;
								}
								bodyFile = m[2];
								break;
							case 'response':
								if(responseFile !== '') {
									reject("Line(" + (lineIdx + 1) + "): Response output file is already specified.");
									return -1;
								}
								responseFile = m[2];
							case 'proxy':
								if(proxy !== '') {
									reject("Line(" + (lineIdx + 1) + "): Proxy is already specified.");
									return -1;
								}
								proxy = m[2];
							}
					} else {
						reject("Line(" + (lineIdx + 1) + "): Unknown line is detected...: " + t);
						return -1;
					}
				}
			} else {
				// bodyの処理。
				m = rgxSepa.exec(t);
				if(m!==null) {
					break;
				}
				if(bodyFile !== '') {
					reject("Body is already specified.");
					return -1;
				}

				if(body.length > 0) {
					body += '\n' + t;
				} else {
					body = t;
				}
			}
			++lineIdx;
		}

		const baseDir:string = path.dirname(doc.uri.fsPath);
		readHeader(headers, baseDir, headerFile).then(()=>
		{
			// クエリパラメタがあればconfに入れる
			if(Object.keys(queries).find((k:string) => k !== '') !== '') {
				conf.queries = queries;
			}
			// ヘッダがあればconfに入れる
			if(Object.keys(headers).find((k:string) => k !== '') !== '') {
				conf.headers = headers;
			}

			return readBody(baseDir, bodyFile);
		}).then((body)=>{
			if(body !== undefined && body !== '') {
				conf.body = body;
			}

			return readProxy(conf, baseDir, proxy);
		}).then(()=>{

			return query(conf);
		}).then((res:Response)=>{

			let contentType:string = "";
			let s = res.status + ' ' + res.statusText;
			if(res.headers !== undefined) {
				const h:AxiosResponseHeaders = res.headers;
				s = Object.keys(h).reduce((prev, key)=>{
					if(key.toLowerCase() === 'content-type') {
						contentType = h[key].toLowerCase();
					}
					return prev + '\n' + key + ': ' + h[key];
				}, s);
			}

			if(res.body !== undefined) {
				if(contentType.startsWith("application/json") || contentType.startsWith("text/json")) {
					s += '\n\n' + JSON.stringify(JSON.parse(res.body), undefined, 2);
				} else {
					s += '\n\n' + res.body;
				}
			}

			// 新規ファイルを作ってぶち込む
			workspace.openTextDocument({ language: "httprequest" })
				.then(doc =>{
					let targetCol = 1;
					const column = window.activeTextEditor ? window.activeTextEditor.viewColumn: undefined;
					if(column && column > 1) {
						targetCol = column - 1;
					} else {
						targetCol = 2;
					}

					return window.showTextDocument(doc, targetCol);
				}).then(editor =>{
					editor.edit(editBuilder => {
						editBuilder.insert(new Position(0, 0), s);
						resolve(lineIdx);
					});
				});
		}).catch((reason)=>{
			window.showErrorMessage(reason.message);
		});

	});
}

const readHeader = (headers: AxiosRequestHeaders, baseDir:string, filename:string) :Promise<void> => {
	return new Promise((resolve, reject)=>{

		if(filename !== '') {
			const fn = path.isAbsolute(filename) ? filename : baseDir + '/' + filename;
			fs.readFile(fn, 'utf-8')
			.then((content:string) => {
				const lines:string[] = content.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
				lines.forEach(line=>{
					if(line.length > 0) {
						const kv:string[] = line.split(':');
						if(kv.length > 1) {
							headers[kv[0].trim()] = kv[1].trim();
						}
					}
				});
				resolve();
			})
			.catch((reason)=>{
				reject(reason);
			});
		} else {
			resolve();
		}
	});
};

const readBody = (baseDir:string, filename:string):Promise<string|undefined> => {
	return new Promise((resolve, reject)=>{
		const fn = path.isAbsolute(filename) ? filename : baseDir + '/' + filename;
		if(filename !== '') {
			fs.readFile(fn, 'utf-8')
			.then(content=>{
				resolve(content);
			})
			.catch((reason)=>{
				reject(reason);
			});
		} else {
			resolve(undefined);
		}
	});
};

const readProxy = (conf:RequestConfig, baseDir:string, filename:string) :Promise<void> => {
	return new Promise((resolve, reject)=>{

		if(filename !== '') {
			const fn = path.isAbsolute(filename) ? filename : baseDir + '/' + filename;
			fs.readFile(fn, 'utf-8')
			.then((content:string) => {
				const lines:string[] = content.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
				lines.forEach(line=>{
					if(line.length > 0) {
						const kv:string[] = line.split(':');
						if(kv.length > 1) {
							const x:string = kv[0].trim().toLowerCase();
							switch(x)
							{
								case 'host':
									conf.proxyHost = kv[1].trim();
									break;
								case 'port':
									conf.proxyPort = Number(kv[1].trim());
									break;
								case 'user':
									conf.proxyUser = kv[1].trim();
									break;
								case 'pass':
									conf.proxyPass = kv[1].trim();
									break;
								case 'protocol':
									conf.proxyProtocol = kv[1].trim();
									break;
							}
						}
					}
				});
				resolve();
			})
			.catch((reason)=>{
				reject(reason);
			});
		} else {
			resolve();
		}
	});
};
