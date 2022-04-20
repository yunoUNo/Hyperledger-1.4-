#!/bin/bash
set -x



docker exec cli peer chaincode install -n simpleasset -v 1.0 -p github.com/simpleasset/1.1

docker exec cli peer chaincode instantiate -o orderer.example.com:7050 -C mychannel -n simpleasset -v 1.0 -c '{"Args":["a","100"]}' -P 'OR ("Org1MSP.member", "Org2MSP.member", "Org3MSP.member")'

sleep 5

docker exec cli peer chaincode query -C mychannel -n simpleasset -c '{"Args":["get","a"]}'

docker exec cli peer chaincode invoke -C mychannel -n simpleasset -c '{"args":["set","b","100"]}'
sleep 5

docker exec cli peer chaincode query -C mychannel -n simpleasset -c '{"Args":["get","b"]}'
