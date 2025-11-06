document.addEventListener("DOMContentLoaded", function () {
    //Map elements
    let mapWrapper = document.getElementById("map_wrapper");
    let mapPathsSVG = document.getElementById("map_paths");
    let mapImage = document.getElementById("map_floorplan");


    class pin {
        constructor(name, type, floor, xPosition, yPosition){
            this.pinName = name;
            this.pinType = type;
            this.pinFloor = floor
            this.pinElement = this.createPinHTMLElement(xPosition, yPosition);
            this.pinNeighbors = new Set();
        }

        createPinHTMLElement(xPosition, yPosition) {
            let newPinElement = document.createElement("div");
            newPinElement.classList.add("pin");
            newPinElement.style.left = xPosition;
            newPinElement.style.top = yPosition;

            newPinElement.addEventListener("click", () => {
                pinManagment.focusedPin = this;
            });
    
            return newPinElement;
        }

        getIntYPosition() {
            return parseInt(this.pinElement.style.top) || 0;
        }

        getIntXPosition() {
            return parseInt(this.pinElement.style.left) || 0;
        }
    }

    const pinManagment = {
        pinMap: new Map(),
        focusedPin: null,

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

        addPin: function (name, type, floor, xPosition, yPosition){
            if (name == null || name == ""){
                return false;
            }

            if (type == null || type == ""){
                return false;
            }

            if (floor == null || floor == ""){
                return false;
            }

            if (this.pinMap.has(name)){
                return false;
            }

            let newPin = new pin(name, type, floor, xPosition, yPosition);

            mapWrapper.appendChild(newPin.pinElement);
            this.pinMap.set(name, newPin);
            this.focusedPin = newPin;
            return true;
        },


        addEdges: function (name, neighbors){
            if (name != null && neighbors != null){
                let pinObj = this.pinMap.get(name);

                neighbors.forEach((name) => {
                    pinObj.pinNeighbors.add(this.pinMap.get(name));
                })
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

    function loadFloorData(){
        const floorURLs = [
            ".\\Floordata\\floor1.json",
        ]

        floorURLs.forEach((url) => {
            fetchData(url);
        })
    }

    async function fetchData(url) {
        fetch(url)
            .then((response) => response.json())
            .then((data) => {
                data.forEach((pinObj) => {
                    pinManagment.addPin(pinObj.name, pinObj.type, pinObj.floor, pinObj.xPosition, pinObj.yPosition);
                })

                data.forEach((pinObj) => {
                    pinManagment.addEdges(pinObj.name, pinObj.edges);
                })

                drawPaths();
            })
            .catch((error) => console.error("Error loading JSON file", error));
    }

    loadFloorData();

    function addLine(pin1, pin2){
        let newLine = document.createElementNS("http://www.w3.org/2000/svg", "line")

        newLine.setAttribute("x1", pin1.getIntXPosition());
        newLine.setAttribute("y1", pin1.getIntYPosition());
        newLine.setAttribute("x2", pin2.getIntXPosition());
        newLine.setAttribute("y2", pin2.getIntYPosition());
        newLine.setAttribute("stroke", "black");

        mapPathsSVG.appendChild(newLine);
    }

    //removes all lines from map
    function clearMapPaths(){
        while (mapPathsSVG.firstChild != null){
            mapPathsSVG.removeChild(mapPathsSVG.lastChild);
        }
    }

    function drawPaths(){ 
        fixImageSVG();   
        clearMapPaths();

        pinManagment.pinMap.forEach((pinObj, name) => {
            pinObj.pinNeighbors.forEach((neighbor) => {
                addLine(pinObj, neighbor);
            })
        })
    }

    function fixImageSVG(){
        mapPathsSVG.style.width = mapImage.offsetWidth + "px";
        mapPathsSVG.style.height = mapImage.offsetHeight + "px";
    }

    mapImage.addEventListener("load", fixImageSVG)
})


