// module
const express = require('express');
const app = express();
var bodyParser = require('body-parser');

const FabricCAServices = require('fabric-ca-client');
const { FileSystemWallet, Gateway, X509WalletMixin } = require('fabric-network');

const fs = require('fs');
const path = require('path');

// setting server
const ccpPath = path.resolve(__dirname, 'connection.json'); // home/yuno/dev
const ccpJSON = fs.readFileSync(ccpPath, 'utf8');
const ccp = JSON.parse(ccpJSON);

const PORT = 3000;  // set your port
const HOST = '0.0.0.0';

app.use(express.static(path.join(__dirname, 'views')));  // views 연결
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({extended: false}));

// HTML connect
// indexe
app.get('/', (req, res)=>{
    res.sendFile(__dirname+ '/index.html');
})
// create
app.get('create',(req, res)=>{
    res.sendFile(__dirname+ '/create.html');
})
// query
app.get('query',(req, res)=>{
    res.sendFile(__dirname+ '/query.html');
})

// REST api
app.post('/asset', async(req,res)=>{
    const key = req.body.key;
    const value = req.body.value;
    console.log('asset-post-'+key+'-'+value);

    // 인증서
    const walletPath = path.join(process.cwd(), 'wallet'); // application/wallet
    const wallet = new FileSystemWallet(walletPath);
    console.log(`Wallet path: ${walletPath}`);

    const userExists = await wallet.exists('user1');
    if(!userExists){
        console.log('user1 does not exists in wallet');
        console.log('run registerUser.js to create user1 wallet');
        res.status(401).sendFile(__dirname+ '/unauth.html');
        return;
    }
    
    // gateway open
    const gateway = new Gateway();
    await gateway.connect(ccp, { wallet, identity: 'user1', discovery: { enabled: false}});
    // channel connect
    const network = await gateway.getNetwork('mychannel');
    // chaincode connect
    const contract = network.getContract('simpleasset');
    // tx
    await contract.submitTransaction('set', key, value);
    console.log('Tx has been submitted');
    
    // gateway close
    await gateway.disconnect();

    // result.html
    const resultPath = path.join(process.cwd(), '/views/result.html');
    var resultHTML = fs.readFileSync(resultPath, 'utf8');
    resultHTML = resultHTML.replace("<div></div>", "<div><p>Tx has been submitted</p></div>");
    res.status(200).send(resultHTML);
})

app.get('/asset', async(req, res)=>{
    const key = req.query.key;

    console.log('asset-get-'+key);

    // 인증서
    const walletPath = path.join(process.cwd(), 'wallet'); // application/wallet
    const wallet = new FileSystemWallet(walletPath);
    console.log(`Wallet path: ${walletPath}`);

    const userExists = await wallet.exists('user1');
    if(!userExists){
        console.log('user1 does not exists in wallet');
        console.log('run registerUser.js to create user1 wallet');
        res.status(401).sendFile(__dirname+ '/unauth.html');
        return;
    }
    
    // gateway open
    const gateway = new Gateway();
    await gateway.connect(ccp, { wallet, identity: 'user1', discovery: { enabled: false}});
    // channel connect
    const network = await gateway.getNetwork('mychannel');
    // chaincode connect
    const contract = network.getContract('simpleasset');
    // tx
    const txResult = await contract.evaluateTransaction('get', key);
    console.log('Tx has been submitted'+ txResult);
    
    // gateway close
    await gateway.disconnect();

    // result.html
    const resultPath = path.join(process.cwd(), '/views/result.html');
    var resultHTML = fs.readFileSync(resultPath, 'utf8');
    resultHTML = resultHTML.replace("<div></div>", `<div><p>Tx has been evalueated: ${txResult}</p></div>`);
    res.status(200).send(resultHTML);
    
})
// start server
app.listen(PORT, HOST);
console.log(`Running on http://${HOST}:${PORT}`);