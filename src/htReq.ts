import axios, { AxiosProxyConfig, AxiosRequestConfig, AxiosRequestHeaders, AxiosResponseHeaders  } from "axios";

export interface HttpParameters {
    [k:string]: string;    
}

export interface RequestConfig {
    method: string;//"GET"|"HEAD"|"POST"|"PUT"|"DELETE"|"CONNECT"|"OPTIONS"|"TRACE"|"PATCH";
    url: string;
    queries?: HttpParameters;
    headers?: AxiosRequestHeaders;
    body?: string;

    proxyHost?: string;
    proxyPort?: number;
    proxyUser?: string;
    proxyPass?: string;
    proxyProtocol?: string;
}

export interface Response {
    status: number;
    statusText: string;
    headers?: AxiosResponseHeaders;
    body: string;
}

export const query = (config:RequestConfig): Promise<Response> =>{

    return new Promise((resolve, reject)=> {
        const res:Response = {
            status: 0,
            statusText: '',
            headers: {},
            body: ""
        };

        const options: AxiosRequestConfig = {
            url: makeUrl(config),
            method: config.method,
            headers: config.headers,
            responseType : 'arraybuffer'
        };

        if(options.url === undefined || options.url === '') {
            reject("missing URL");
        }

        options.data = config.body;

        // Proxyが有効
        if(config.proxyHost) {
            // ポートの指定は必須なのでが無い場合は作る
            if(!config.proxyPort) {
                if(config.proxyProtocol === 'https') {
                    config.proxyPort = 443;
                } else {
                    config.proxyPort = 80;
                }
            }

            const proxyConfig:AxiosProxyConfig = {
                host: config.proxyHost,
                port: config.proxyPort
            };

            if(config.proxyUser) {
                proxyConfig.auth = {
                    username: config.proxyUser,
                    password: config.proxyPass||""
                };
            }
            if(config.proxyProtocol) {
                proxyConfig.protocol = config.proxyProtocol;
            }
            options.proxy = proxyConfig;
        }

        axios(options)
            .then((response)=>{
                res.status = response.status;
                res.statusText = response.statusText;
                res.headers = response.headers;
                if(response.data !== undefined) {
                    res.body = response.data.toString();
                }

                resolve(res);
            }).catch((reason) => {
                if(reason.response !== undefined) {
                    res.status = reason.response.status;
                    res.statusText = reason.response.statusText;
                    res.headers = reason.response.headers;
                    if(reason.response.data !== undefined) {
                        res.body = reason.response.data.toString();
                    }
                    resolve(res);
                } else {
                    reject(reason);
                }
            });
    });

};

const makeUrl = (conf:RequestConfig): string => {
    let url = conf.url;
    const rgx:RegExp = /^(https?):\/\/([0-9a-z][-0-9a-z]*(\.[0-9a-z][-0-9a-z]*)*)(:[1-9][0-9]*)?/;
    const m:RegExpExecArray|null = rgx.exec(conf.url);
    if (m !== null) {
        if (m[0].length === url.length) {
            url = url + '/';
        }
    } else {
        return "";
    }

    let params = "";
    if(conf.queries !== undefined) {
        const qs = conf.queries;
        Object.keys(qs).forEach((k:string, _i:number) => {
            params = params + '&' + encodeURIComponent(k) + "=" + encodeURIComponent(qs[k]);
        });
    }
    if(params.length > 0) {
        return url + '?' + params.substring(1);
    }
    return url;
};
