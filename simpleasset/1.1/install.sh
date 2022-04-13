#!/bin/bash
set -x

# 1. 설치
docker exec cli peer chaincode install -n simpleasset -v 1.1 -p github.com/simpleasset/1.1

# 2. 업그레이드
docker exec cli peer chaincode instantiate -n simpleasset -v 1.1 -c '{"Args":[]}' -C mychannel -P 'AND ("Org1MSP.member")'
sleep 3

# 3. Invoke set a, set b, transfer
docker exec cli peer chaincode invoke -n simpleasset -C mychannel -c '{"Args":["set","a","111"]}'
docker exec cli peer chaincode invoke -n simpleasset -C mychannel -c '{"Args":["set","b","222"]}'
sleep 3
docker exec cli peer chaincode invoke -n simpleasset -C mychannel -c '{"Args":["transfer","a","b","11"]}'
sleep 3

# 4. query
docker exec cli peer chaincode query -n simpleasset -C mychannel -c '{"Args":["get","a"]}'
docker exec cli peer chaincode query -n simpleasset -C mychannel -c '{"Args":["get","b"]}'
sleep 3
docker exec cli peer chaincode query -n simpleasset -C mychannel -c '{"Args":["history","a"]}'
sleep 3
docker exec cli peer chaincode query -n simpleasset -C mychannel -c '{"Args":["history","b"]}'

# 5. del 
docker exec cli peer chaincode invoke -n simpleasset -C mychannel -c '{"Args":["del","b"]}'

docker exec cli peer chaincode query -n simpleasset -C mychannel -c '{"Args":["get","b"]}'




