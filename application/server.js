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

// 관리자 지갑
app.post('/user', async(req,res)=>{
    const mode = req.body.mode;
    console.log('/user-post-'+mode);

    if (mode==1){
        const id = req.body.id;
        const pw = req.body.pw;

        console.log('/user-post-'+id+'-'+pw);

        try {

            // Create a new CA client for interacting with the CA.
            const caURL = ccp.certificateAuthorities['ca.example.com'].url;
            const ca = new FabricCAServices(caURL);
    
            // Create a new file system based wallet for managing identities.
            const walletPath = path.join(process.cwd(), 'wallet');
            const wallet = new FileSystemWallet(walletPath);
            console.log(`Wallet path: ${walletPath}`);
    
            // Check to see if we've already enrolled the admin user.
            const adminExists = await wallet.exists('admin');
            if (adminExists) {
                console.log('An identity for the admin user "admin" already exists in the wallet');
                
                // 오류 전송 수정
                const obj = JSON.parse('{"ERROR": "An identity for the admin user "admin" already exists in the wallet"}');
                res.status(400).json(obj);
            }
    
            // Enroll the admin user, and import the new identity into the wallet.
            const enrollment = await ca.enroll({ enrollmentID: id, enrollmentSecret: pw });
            const identity = X509WalletMixin.createIdentity('Org1MSP', enrollment.certificate, enrollment.key.toBytes());
            wallet.import('admin', identity);
            console.log('Successfully enrolled admin user "admin" and imported it into the wallet');

            // 오류 전송 추가
            const obj = JSON.parse('{"PAYLOAD": "Successfully enrolled admin user "admin" and imported it into the wallet"}');
            res.status(200).json(obj);
        } catch (error) {
            console.error(`Failed to enroll admin user "admin": ${error}`);
            
            const obj = JSON.parse(`{"ERR_MSG":"Failed to enroll admin user admin : ${error}"}`);
            res.status(400).json(obj);
        }
    }
    else if (mode==2){
        const id = req.body.id;
        const role = req.body.role;

        console.log('/user-post-'+id+' '+role);

        try {

            // Create a new file system based wallet for managing identities.
            const walletPath = path.join(process.cwd(), 'wallet');
            const wallet = new FileSystemWallet(walletPath);
            console.log(`Wallet path: ${walletPath}`);
    
            // Check to see if we've already enrolled the user.
            const userExists = await wallet.exists(id);
            if (userExists) {
                console.log(`An identity for the user ${id} already exists in the wallet`);
                const obj = JSON.parse(`{"ERROR": "An identity for the user ${id} already exists in the wallet"}`)
                res.status(400).json(obj);
            }
    
            // Check to see if we've already enrolled the admin user.
            const adminExists = await wallet.exists('admin');
            if (!adminExists) {
                console.log('An identity for the admin user "admin" does not exist in the wallet');
                console.log('Run the enrollAdmin.js application before retrying');
                const obj = JSON.parse('{"ERROR": "An identity for the admin user "admin" does not exist in the wallet"')
                res.status(400).json(obj);

            }
    
            // Create a new gateway for connecting to our peer node.
            const gateway = new Gateway();
            await gateway.connect(ccp, { wallet, identity: 'admin', discovery: { enabled: false } });
    
            // Get the CA client object from the gateway for interacting with the CA.
            const ca = gateway.getClient().getCertificateAuthority();
            const adminIdentity = gateway.getCurrentIdentity();
    
            // Register the user, enroll the user, and import the new identity into the wallet.
            const secret = await ca.register({ affiliation: 'org1.department1', enrollmentID: id, role: role }, adminIdentity);
            const enrollment = await ca.enroll({ enrollmentID: id, enrollmentSecret: secret });
            const userIdentity = X509WalletMixin.createIdentity('Org1MSP', enrollment.certificate, enrollment.key.toBytes());
            wallet.import(id, userIdentity);
            console.log(`Successfully registered and enrolled admin user ${id} and imported it into the wallet`);
            const obj = JSON.parse(`{"PAYLOAD": "Successfully registered and enrolled admin user ${id} and imported it into the wallet"}`);
            res.status(400).json(obj);
    
        } catch (error) {
            console.error(`Failed to register user ${id}: ${error}`);
            const obj = JSON.parse(`{"ERROR": "Failed to register user ${id}: ${error}"}`);
            res.status(400).json(obj);
        }
    }
})
// 자산생성
app.post('/asset', async(req,res)=>{
    const id = req.body.id;
    const key = req.body.key;
    const value = req.body.value;
    console.log('asset-post-'+key+'-'+value);

    // 인증서
    const walletPath = path.join(process.cwd(), 'wallet'); // application/wallet
    const wallet = new FileSystemWallet(walletPath);
    console.log(`Wallet path: ${walletPath}`);

    const userExists = await wallet.exists(id);
    if(!userExists){
        console.log(`${id} does not exists in wallet`);
        res.status(401).sendFile(__dirname+ '/unauth.html');
        return;
    }
    
    // gateway open
    const gateway = new Gateway();
    await gateway.connect(ccp, { wallet, identity: id, discovery: { enabled: false}});
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
    const id = req.query.id;

    console.log('asset-get-'+key);

    // 인증서
    const walletPath = path.join(process.cwd(), 'wallet'); // application/wallet
    const wallet = new FileSystemWallet(walletPath);
    console.log(`Wallet path: ${walletPath}`);

    const userExists = await wallet.exists(id);
    if(!userExists){
        console.log(`${id} does not exists in wallet`);
        const obj = JSON.parse(`{"ERROR":"An identity for the user ${id} does not exist in the wallet"}`);

        res.status(400).json(obj);
        return;
    }
    
    // gateway open
    const gateway = new Gateway();
    await gateway.connect(ccp, { wallet, identity: id, discovery: { enabled: false}});
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
    // const resultPath = path.join(process.cwd(), '/views/result.html');
    // var resultHTML = fs.readFileSync(resultPath, 'utf8');
    // resultHTML = resultHTML.replace("<div></div>", `<div><p>Tx has been evalueated: ${txResult}</p></div>`);
    const obj = JSON.parse(txResult);
    res.status(200).send(obj);
    
})

app.get('/assets', async(req, res)=>{
    const key= req.query.key;
    const id= req.query.id;
    console.log('/assets-get-'+key);

    const walletPath = path.join(process.cwd(), 'wallet');
    const wallet = new FileSystemWallet(walletPath);  
    console.log(`Wallet path: ${walletPath}`);
    const userExists = await wallet.exists(id);
    if(!userExists){
        console.log(`History ${id} does not exists in the wallet`);
        res.status(401).sendFile(__dirname+'/unauth.html');
        return;
    }

    const gateway = new Gateway();
    await gateway.connect(ccp, { wallet, identity: id, discovery: { enabled: false}});
    const network = await gateway.getNetwork('mychannel');
    const contract = network.getContract('simpleasset');
    const txresult = await contract.evaluateTransaction('history', key);
    console.log('Tx has been evaluated: '+ txresult);

    await gateway.disconnect();
    
    const resultPath = path.join(process.cwd(), '/views/result.html')
    var resultHTML = fs.readFileSync(resultPath, 'utf8');

    var tableHTML="\n<table class=\"table table-bordered\">";

    const txs = JSON.parse(txresult);

    for(var i=0 ; i<txs.length; i++)
    {
        tableHTML+="<tr><td>TxId</td>";
        tableHTML=tableHTML+"<td>"+txs[i].TxId+"</td></tr>";
        tableHTML+="<tr><td>Timestamp</td>";
        tableHTML=tableHTML+"<td>"+txs[i].Timestamp+"</td></tr>";
        tableHTML+="\n";
    }
    tableHTML+="</table>\n";

    resultHTML = resultHTML.replace("<div></div>", `<div><p>Transaction has been evaluated:</p><br> ${tableHTML}</div>\n`);
    res.status(200).send(resultHTML);
})
// start server
app.listen(PORT, HOST);
console.log(`Running on http://${HOST}:${PORT}`);