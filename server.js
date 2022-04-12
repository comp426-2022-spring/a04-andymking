const minimist = require('minimist')
const express = require('express')
const app = express()
const args = minimist(process.argv)
const db = require('./database.js');
const morgan = require('morgan');
const fs = require('fs');

var port = args['port'] ? args['port'] : 5000

function coinFlip() {
    return Math.random() > 0.5 ? 'heads' : 'tails';
}

function coinFlips(flips) {
    let out = Array(flips).fill(null);
    if (flips >= 1) {
      for (let i = 0; i < flips; i++) {
        let flip = coinFlip();
        out[i] = flip;
      }
    } else {
      out[0] = coinFlip();
    }
    return out;
  }

function countFlips(array) {
    let desc = {tails: 0, heads: 0};
    for(let i = 0; i < array.length; i++) {
      array[i] == 'heads' ? desc.heads += 1 : desc.tails += 1;
    }
    return desc;
}

function flipACoin(call) {
    let out = {call: '', flip: '', result: ''}
    if (call != 'heads' && call != 'tails') {
      return 'Error: no input.\nUsage: node guess-flip --call=[heads|tails]';
    } else {
      let flip = coinFlip();
      let result = flip == call ? 'win' : 'lose';
      out.call = call, out.flip = flip, out.result = result;
      return out;
    }
}

const server = app.listen(port, () => {
    console.log('App is running on port %PORT%'.replace('%PORT%', port))
})

// // Log with morgan 
// app.use(morgan('common'))
// // also if you're logging, in bash rush node server.js > ./access.log and output is stored in access.log
// app.use(fs.writeFile('./access.log', data, 
//     {flag: 'a'}, (err, req, res, next) => {
//         if (err) {
//             console.error(err)
//         } else {
//             console.log()
//         }
//     }

// ))

app.use(express.urlencoded({ extended: true }));
app.use(express.json());

app.use((req, res, next) => {
    const stmt = db.prepare('INSERT INTO accesslog (req.ip, remoteuser, time, method, url, protocol, httpversion, secure, status, referer, useragent) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
    let secure;
    if (req.secure) {
        secure = 'true';
    } else {
        secure = 'false';
    }
    const info = stmt.run(req.ip, req.user, Date.now(), req.method, req.url, req.protocol, req.httpVersion, secure, res.statusCode, req.headers['referer'], req.headers['user-agent'])
    next()
});

app.get('/app', (req, res) => {
    res.setHeader('Content-Type', 'text/plain');
    res.setHeader('status', 200)
    res.end('200 OK')
})

app.get("/app/error", (req, res) => {	
    throw new Error('BROKEN') // Express will catch this on its own.
});

app.get('/app/err', (req, res) => {
    throw new Error('BROKEN') // Express will catch this on its own.
})


app.get('/app/log/access', (req, res) => {
    const stmt = db.prepare('SELECT * FROM accesslog').all()
    res.status(200).json(stmt)
});

app.get('/app/flip', (req, res) => {
    res.setHeader('Content-Type', 'text/json');
    res.setHeader('status', 200);
    var flip = coinFlip()
    res.json({'flip' : flip})
})

app.get('/app/flips/:number', (req, res) => {
    res.setHeader('Content-Type', 'text/json');
    res.setHeader('status', 200);
    var flips = coinFlips(req.params.number)
    // res.json({'ip': req.ip, 'user' : req.user, 'date' : Date.now(), 'method' : req.method, 'url' : req.url, 'protocol' : req.protocol, 'httpVersion' : req.httpVersion, 'secure' : req.secure, 'statusCode' : res.statusCode, 'referer' : req.headers['referer'], 'useragent' : req.headers['user-agent']});
    res.json({'raw' : flips, 'summary' : countFlips(flips)})
})

app.get('/app/flip/call/heads', (req, res) => {
    res.setHeader('Content-Type', 'text/json');
    res.setHeader('status', 200);
    res.json(flipACoin('heads'))
})

app.get('/app/flip/call/tails', (req, res) => {
    res.setHeader('Content-Type', 'text/json');
    res.setHeader('status', 200);
    res.json(flipACoin('tails'))
})

if (args['log'] == 'true') {
    // Use morgan for logging to files
    // Create a write stream to append (flags: 'a') to a file
    const writeStream = fs.createWriteStream('access.log', { flags: 'a' })
    // Set up the access logging middleware
    app.use(morgan('common', { stream: writeStream }))  
}

app.use(function(req, res) {
    res.setHeader('Content-Type', 'text/plain');
    res.status(404).send('404 Not Found')
})

app.use((err, req, res, next) => {
    console.error(err.stack)
    res.status(500).send('Internal Server Error')
})