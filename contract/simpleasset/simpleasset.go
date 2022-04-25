// 패키지 정의
package main

// 1. 외부 모듈 포함
import (
	"fmt"
	"encoding/json"
	"strconv"
	"time"
	"bytes"

	"github.com/hyperledger/fabric/core/chaincode/shim"
	pr "github.com/hyperledger/fabric/protos/peer"
)

// 2. 체인코드 클래스-구조체 정의 SimpleAsset
type SimpleAsset struct{

}

// JSON 으로 변환할 구조체 정의
type Asset struct{
	Key 	string `json:"key"`
	Value 	string `json:"value"`
}

// 3. Init 함수
func (t *SimpleAsset) Init(stub shim.ChaincodeStubInterface) pr.Response{
	return shim.Success(nil)
}

// 4. Invoke 함수
func (t *SimpleAsset) Invoke(stub shim.ChaincodeStubInterface) pr.Response{
	fn, args := stub.GetFunctionAndParameters()
	
	switch fn{
	case "set":
		return t.Set(stub, args)
	case "get":
		return t.Get(stub, args)
	case "del":
		return t.Del(stub, args)
	case "transfer":
		return t.Transfer(stub, args)
	case "history":
		return t.History(stub, args)
	case "checkAll":
		return t.CheckAll(stub)
	}

	return shim.Error("plz check function name")
}

// 5. Set 함수
func (t *SimpleAsset) Set(stub shim.ChaincodeStubInterface, args []string) pr.Response{

	if len(args) !=2{
		return shim.Error("plz check your args. must have 2 arguments(key,value).")
	}
	// 오류체크 중복 키 검사 -> 덮어쓰기로 해결
	asset := Asset{Key: args[0], Value: args[1]}
	assetAsBytes, err := json.Marshal(asset)
	if err != nil{
		shim.Error("Failed set marshal args: " + args[0] + " " + args[1])
	}
	err = stub.PutState(args[0], assetAsBytes)
	if err != nil{
		return shim.Error("set Failed!!! : " + args[0])
	}

	return shim.Success([]byte(assetAsBytes))
}
// 6. Get 함수
func (t *SimpleAsset) Get(stub shim.ChaincodeStubInterface, args []string) pr.Response{

	if len(args) != 1{
		return shim.Error("plz check your args. must have 1 arguments(key).")
	}

	value, err := stub.GetState(args[0])   // key 로 블록 검사 하네.
	if err != nil{
		shim.Error("get Faield!!! : "+ args[0] + " with error: " + err.Error())
	}
	if value == nil{
		shim.Error("Asset not found: "+ args[0])
	}

	return shim.Success([]byte(value))
}

/// 2022-04-20 kyh CheckAll 추가
func (t *SimpleAsset) CheckAll(stub shim.ChaincodeStubInterface) pr.Response{

	IterVal, err := stub.GetStateByRange("","")
	if err != nil{
		return shim.Error(err.Error())
	}
	defer IterVal.Close()

	var buffer bytes.Buffer
	buffer.WriteString("[")

	flag := false
	for IterVal.HasNext(){
		queryResponse, err := IterVal.Next()
		if err != nil {
			return shim.Error(err.Error())
		}
		// Add a comma before array members, suppress it for the first array member
		if flag == true {
			buffer.WriteString(",")
		}
		buffer.WriteString("{\"Key\":")
		buffer.WriteString("\"")
		buffer.WriteString(queryResponse.Key)
		buffer.WriteString("\"")

		buffer.WriteString(", \"Record\":")
		// Record is a JSON object, so we write as-is
		buffer.WriteString(string(queryResponse.Value))
		buffer.WriteString("}")
		flag = true
	}
	buffer.WriteString("]")

	fmt.Printf("- AllCheck:\n%s\n", buffer.String())

	return shim.Success(buffer.Bytes())
}
// 7. Del 함수
func (t *SimpleAsset) Del(stub shim.ChaincodeStubInterface, args []string) pr.Response{
	if len(args) != 1{
		return shim.Error("plz check your args. must have 1 arguments(key).")
	}

	value, err := stub.GetState(args[0])
	if err != nil{
		shim.Error("get Faield!!! : "+ args[0] + " with error: " + err.Error())
	}
	if value == nil{
		shim.Error("incorrect key. Asset not found: "+args[0])
	}

	err = stub.DelState(args[0])

	return shim.Success([]byte(args[0]))
}

// 8. Transfer 함수
func (t *SimpleAsset) Transfer(stub shim.ChaincodeStubInterface, args []string) pr.Response{
	if len(args) != 3{
		return shim.Error("plz check your args. must have 3 arguments(fromKey, toKey, amount).")
	}

	fromAsset, fromErr:= stub.GetState(args[0])
	toAsset, toErr:= stub.GetState(args[1])
	if fromErr != nil {
		return shim.Error("Transaction error: " + fromErr.Error())
	}
	if fromAsset == nil{
		return shim.Error("incorrect key. Asset not found: "+args[0])
	}
	if toErr != nil{
		return shim.Error("Transaction error: " + toErr.Error())
	}
	if toAsset == nil{
		return shim.Error("incorrect key. Asset not found: "+args[1])
	}
	
	from := Asset{}
	to := Asset{}
	json.Unmarshal(fromAsset, &from)
	json.Unmarshal(toAsset, &to)
	
	// 받아온 구조체를 int 로 변환
	fromValue ,_ := strconv.Atoi(from.Value)
	toValue, _ := strconv.Atoi(to.Value)
	amount, _ := strconv.Atoi(args[2]) // 파라미터로 받아온 것. 변환 원하는 액수

	if (fromValue - amount)< 0 {
		return shim.Error("Value not enough.")
	}

	from.Value = strconv.Itoa(fromValue - amount)
	to.Value = strconv.Itoa(toValue + amount)

	fromAsset, _ = json.Marshal(from)
	toAsset, _ = json.Marshal(to)

	stub.PutState(args[0], fromAsset)
	stub.PutState(args[1], toAsset)

	return shim.Success(nil)
}
//9. History 함수
func (t *SimpleAsset) History(stub shim.ChaincodeStubInterface, args []string) pr.Response{

	if len(args) <1{
		return shim.Error("plz check your arguments. must have more than 1")
	}

	assetName := args[0]

	fmt.Printf("- start getHistoryForAsset: %s\n", assetName)

	resultsIterator, err := stub.GetHistoryForKey(assetName)
	if err != nil{
		return shim.Error(err.Error())
	}
	defer resultsIterator.Close()

	var buffer bytes.Buffer
	buffer.WriteString("[")

	flag := false
	for resultsIterator.HasNext(){
		response, err := resultsIterator.Next()
		if err != nil{
			return shim.Error(err.Error())
		}
		if flag == true{
			buffer.WriteString(",")
		}
		buffer.WriteString("{\"TxId\":")
		buffer.WriteString("\"")
		buffer.WriteString(response.TxId)
		buffer.WriteString("\"")

		buffer.WriteString(", \"Value\":")
		// if it was a delete operation on given key, then we need to set the
		//corresponding value null. Else, we will write the response.Value
		//as-is (as the Value itself a JSON marble)
		if response.IsDelete {
			buffer.WriteString("null")
		} else {
			buffer.WriteString(string(response.Value))
		}

		buffer.WriteString(", \"Timestamp\":")
		buffer.WriteString("\"")
		buffer.WriteString(time.Unix(response.Timestamp.Seconds, int64(response.Timestamp.Nanos)).String())
		buffer.WriteString("\"")

		buffer.WriteString(", \"IsDelete\":")
		buffer.WriteString("\"")
		buffer.WriteString(strconv.FormatBool(response.IsDelete))
		buffer.WriteString("\"")

		buffer.WriteString("}")
		flag = true
	}
	buffer.WriteString("]")

	fmt.Printf("- History retuning:\n%s\n", buffer.String())

	return shim.Success(buffer.Bytes())
}
// main 함수
func main(){
	if err := shim.Start(new(SimpleAsset)); err!= nil{
		fmt.Printf("Error run ChainCode: %s", err)
	}
}