document.addEventListener("DOMContentLoaded", function () {
    //Map elements
    let mapWrapper = document.getElementById("map_wrapper");
    let mapPathsSVG = document.getElementById("map_paths");
    let mapImage = document.getElementById("map_floorplan");


    class pin {
        constructor(name, type, floor){
            this.pinName = name;
            this.pinType = type;
            this.pinFloor = floor
            this.pinElement = this.createPinHTMLElement();
            this.pinEdges = new Set();
        }

        createPinHTMLElement() {
            let newPinElement = document.createElement("div");
            newPinElement.classList.add("pin");

            newPinElement.addEventListener("click", () => {
                pinManagment.focusedPin = this;
            });
    
            return newPinElement;
        }
    }

    const pinManagment = {
        pinMap: new Map(),
        focusedPin: null,
        prevFocusedPin: null,
        numPathPins: 0,

        removePin: function (pin) {
            if (pin != null){
                return;
            }

            document.removeChild(pin.pinElement);
            this.pinMap.delete(pin.pinName);
 
            pin.pinEdges.forEach((otherPin) => {
                otherPin.delete(pin);
            });

        },

        addRoomPin: function (pinName, pinType, pinFloor){
            if (pinName == null || pinName == ""){
                return false;
            }

            if (pinType == null || pinType == ""){
                return false;
            }

            if (pinFloor == null || pinFloor == ""){
                return false;
            }

            if (this.pinMap.has(pinName)){
                return false;
            }

            let newPin = new pin(pinName, pinType, pinFloor);

            mapWrapper.appendChild(newPin.pinElement);
            this.pinMap.set(pinName, newPin);
            this.prevFocusedPin = this.focusedPin;
            this.focusedPin = newPin;
            return true;
        },

        addPathPin: function (pinType, pinFloor){
            if (pinType == null || pinType == ""){
                return false;
            }

            if (pinFloor == null || pinFloor == ""){
                return false;
            }

            let newPin = new pin(this.numPathPins.toString(), pinType, pinFloor);

            mapWrapper.appendChild(newPin.pinElement);
            this.pinMap.set(this.numPathPins.toString(), newPin);
            this.prevFocusedPin = this.focusedPin;
            this.focusedPin = newPin;
            this.numPathPins++;

            return true;
        },

        addEdge: function (pin1, pin2){
            if (pin1 != null && pin2 != null){
                pin1.pinEdges.add(pin2.pinName);
                pin2.pinEdges.add(pin1.pinName);
            }
        },

        removeEdge: function (pin1, pin2){
            if (pin1 != null && pin2 != null){
                pin1.pinEdges.delete(pin2.pinName);
                pin2.pinEdges.delete(pin1.pinName);
            }
        },

        //only need x ratio for this to work
        scalePins: function(oldImageX, newImageX){
            let ratio = newImageX/oldImageX;
            
            this.pinMap.forEach((pinObj, name) => {
                console.log(ratio);
                pinObj.pinElement.style.width = (parseInt(pinObj.pinElement.style.width) * ratio) + "px";
                pinObj.pinElement.style.height = (parseInt(pinObj.pinElement.style.height) * ratio) + "px";
                pinObj.pinElement.style.top = (parseInt(pinObj.pinElement.style.top) * ratio) + "px";
                pinObj.pinElement.style.left = (parseInt(pinObj.pinElement.style.left) * ratio) + "px";
            });

            drawPaths();
        },

    };

    function addLine(pin1, pin2){
        let newLine = document.createElementNS("http://www.w3.org/2000/svg", "line")

        mapPathsSVG.to

        newLine.setAttribute("x1", pin1.getIntXPosition());
        newLine.setAttribute("y1", pin1.getIntYPosition());
        newLine.setAttribute("x2", pin2.getIntXPosition());
        newLine.setAttribute("y2", pin2.getIntYPosition());
        newLine.setAttribute("stroke", "black");

        mapPathsSVG.appendChild(newLine);
    }

    function clearMapPaths(){
        while (mapPathsSVG.firstChild != null){
            mapPathsSVG.removeChild(mapPathsSVG.lastChild);
        }
    }

    function drawPaths(){
        clearMapPaths();

        pinManagment.pinMap.forEach((pin, name) => {
            pin.pinEdges.forEach((otherPinName) => {
                addLine(pin, pinManagment.pinMap.get(otherPinName));
            })
        });

    }
})
