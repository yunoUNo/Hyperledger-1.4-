// 패키지 정의
package main

// 1. 외부 모듈 포함
import (
	"fmt"

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
	args := stub.GetStringArgs()
	if len(args) != 2{
		return shim.Error("plz check your args. must have 2 arguments.")
	}

	err := stub.PutState(args[0], []byte(args[1]))
	if err != nil{
		return shim.Error(fmt.Sprintf("Failed to create asset: %s", args[0]))
	}
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
	}

	return shim.Error("Not supported function name")
}
// 5. Set 함수
func (t *SimpleAsset) Set(stub shim.ChaincodeStubInterface, args []string) pr.Response{

	if len(args) !=2{
		return shim.Error("plz check your args. must have 2 arguments(key,value).")
	}
	// 오류체크 중복 키 검사 -> 덮어쓰기로 해결

	err := stub.PutState(args[0], []byte(args[1]))
	if err != nil{
		return shim.Error("set Failed!!! : " + args[0])
	}

	return shim.Success([]byte("set Success: "+ args[0]))
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
// 7. main 함수
func main(){
	if err := shim.Start(new(SimpleAsset)); err!= nil{
		fmt.Printf("Error run ChainCode: %s", err)
	}
}