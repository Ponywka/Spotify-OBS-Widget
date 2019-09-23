// Include libraries
const fs = require('fs')
const http = require('http')
const https = require('https')
const querystring = require('querystring')

const config = require('./config.json')
console.log(config.copyright)
console.log("Now we can add http://localhost:4001 in Spotify and authorize to account with browser in http://localhost:4001/auth")


// Include config
let data = {}
try{
    data = require('./accountData.json')
}catch(e){}

const saveConfig = () => {
    fs.writeFile("./accountData.json", JSON.stringify(data), (err) => {
        if (err) throw err;
        console.log('The file has been saved!');
    })
}

// Temp data
let cache = {}

// Output data
let outputdata = {
    "titlename": "Loading",
    "artistname": config.copyright,
    "imageurl": "",
    "is_playing": true
}

// Internet request
const netRequest = (params) => {
    return new Promise((resolve, reject) => {
        let content = "";
        let postData = querystring.stringify(params.data)
        let headers = params.headers
        headers['Content-Type'] = 'application/x-www-form-urlencoded'
        headers['Content-Length'] = Buffer.byteLength(postData)
        let req = https.request({
            hostname: params.hostname,
            port: 443,
            path: params.path,
            method: params.method,
            headers: headers
        }, (res) => {
            res.on('data', (d) => {
                content += d
            })
            res.on('end', ()=> {
                resolve(content)
            })
        })
        req.on('error', ()=>{
            reject({message:"I can't connect to internet. You need internet connection. You can sell your wife for it. https://www.reddit.com/r/copypasta/comments/4zp8hp/hello_am_48_year_man_from_somalia/"})
        })
        req.write(postData)
        req.end()
    })
}

// Loop for get info from Spotify
let worker = setInterval(async function(){
    if(data.access_token){
        if(!cache.workRightNow){
            cache.workRightNow = true
            let jsonData = JSON.parse(await netRequest({
                hostname: 'api.spotify.com',
                path: '/v1/me/player/currently-playing',
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${data.access_token}`
                }
            }))
            if(!jsonData.error){
                outputdata["titlename"] = jsonData.item.name
                let artists = ""
                Object(jsonData.item.artists).forEach(element => {
                    artists += ", " + element.name
                })
                outputdata["artistname"] = artists.substr(2)
                outputdata["imageurl"] = jsonData.item.album.images[0].url
                outputdata["is_playing"] = jsonData.is_playing
            }else if(jsonData.error.message == "The access token expired"){
                outputdata["titlename"] = "Getting new token"
                outputdata["artistname"] = config.copyright
                data.access_token = await refreshToken(data.refresh_token)
                saveConfig()
            }
            cache.workRightNow = false
        }
    }else{
        outputdata["titlename"] = "I need auth"
        outputdata["artistname"] = config.copyright
    }
}, 1000)

// Write error
const writeError = (response, code, text = "") => {
    response.writeHead(code)
    response.end(`<html><head><h1>${code} | ${text}</h1></head></html>`)
}

// Authorization
const authByCode = (code) => {
    return new Promise(async function(resolve, reject){
        let request = await netRequest({
            hostname: 'accounts.spotify.com',
            path: '/api/token',
            method: 'POST',
            headers: {
                'Authorization': `Basic ${Buffer.from(config.ClientID + ":" + config.ClientSecret).toString('base64')}`
            },
            data: {
                "grant_type": "authorization_code",
                "code": code,
                "redirect_uri": config.redirect_uri
            }
        })
        let jsonData = JSON.parse(request)
        if(!jsonData.error){
            resolve({
                access_token: jsonData.access_token,
                refresh_token: jsonData.refresh_token
            })
        }else{
            reject({message:"Something error r/engrish"})
        }
    })
}

// Refrest token
const refreshToken = (code) => {
    return new Promise(async function(resolve, reject){
        let request = await netRequest({
            hostname: 'accounts.spotify.com',
            path: '/api/token',
            method: 'POST',
            headers: {
                'Authorization': `Basic ${Buffer.from(config.ClientID + ":" + config.ClientSecret).toString('base64')}`
            },
            data: {
                "grant_type": "refresh_token",
                "refresh_token": code
            }
        })
        let jsonData = JSON.parse(request)
        if(!jsonData.error){
            resolve(jsonData.access_token)
        }else{
            reject({message:"Something error r/engrish"})
        }
    })
}

// Parse URL for parameters
const parseURLencoded = (url) => {
    let params = {}
    if(url != ""){
        //Cut params to array
        let urldata = url.split("&")
        //Convert string to array
        for (let [key, element] of Object.entries(urldata)) {
            let atrarr = element.split('=')
            let atrname = decodeURI(atrarr[0])
            let atrdata = decodeURI(element.slice(atrname.length + 1))
            params[atrname] = atrdata
        }
    }
    return params
}

    //Start server
    http.createServer(async function(request, response){
        let params = {}
        // URL parser
        // Getting only URL
        let urldata = request.url.split('?')
        let url = urldata[0]
        // Getting params
        if(urldata[1]){
            let strData = request.url.slice(url.length + 1)
            params = parseURLencoded(strData)
        }
        // Delete temp data
        delete urldata
        let isPublicFolder = new RegExp(/\/public\/([\s\S]+?)$/g).exec(url)
        if(isPublicFolder){
            fs.readFile(`./public/${isPublicFolder[1]}`, function(err, data){
                if(err){
                    response.end()
                }else{
                    response.end(data)
                }
            })
        }else{
            switch(url){
                case '/':
                    fs.readFile('./index.html', function(err, data){
                        if(err){
                            response.end()
                        }else{
                            response.end(data.toString())
                        }
                    })
                    break
                case '/auth':
                    response.writeHead(301, {"Location": `https://accounts.spotify.com/ru/authorize?client_id=${config.ClientID}&response_type=code&redirect_uri=${encodeURIComponent(config.redirect_uri)}&scope=user-read-currently-playing`})
                    response.end()
                    break
                case '/getToken':
                    if(params.code){
                        try{
                            let jsonData = await authByCode(params.code)
                            data.access_token = jsonData.access_token
                            data.refresh_token = jsonData.refresh_token
                            saveConfig()
                            response.writeHead(301, {"Location": '/'})
                            response.end()
                        }catch(e){
                            writeError(response, 500, e.message)
                        }
                        
                    }else{
                        writeError(response, 400, "Not found \"code\" parameter")
                    }
                    break
                case '/getSong':
                    response.writeHead(200, {"Content-Type": "application/json"})
                    response.end(JSON.stringify(outputdata))
                    break
                default:
                    writeError(response, 404, "Not found")
            }
        }
    }).on('error', (e) => {
        console.log()
        console.log()
        console.log()
        console.log("--- Error -------------")
        console.error(e)
    }).listen(config.port)