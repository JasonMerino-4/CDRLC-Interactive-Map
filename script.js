document.addEventListener("DOMContentLoaded", function () {

    //Inputs
    const zoomIn = document.getElementById("map_zoomin");
    const zoomOut = document.getElementById("map_zoomout");
    const zoomReset = document.getElementById("map_reset");

    //Map elements
    let mapWrapper = document.getElementById("map_wrapper");
    let mapPathsSVG = document.getElementById("map_paths");
    let mapImage = document.getElementById("map_floorplan");

    // ===== NEW (FILTER STATE & ELEMENTS) — START =====
    const amenityButtons   = document.querySelectorAll(".amenity-btn");
    const amenityClearBtn  = document.getElementById("amenity_clear");
    // Multi-select: keep a set of active types (empty = no filter)
    const activeFilterTypes = new Set();
    // ===== NEW (FILTER STATE & ELEMENTS) — END =====

    const allPins = [];

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
            newPinElement.classList.add(this.pinType.replace(/ /g, ''));
            
            newPinElement.style.left = xPosition;
            newPinElement.style.top = yPosition;

            if (this.pinType === "Path") {
                newPinElement.style.visibility = "hidden";   // still participates in layout (width/height)
            }

            // Conditionally add icon
            const iconSrc = this.getIconForType(this.pinType);
            if (iconSrc) {
                let icon = document.createElement("img");
                icon.classList.add("pin-icon");
                icon.src = iconSrc;
                icon.alt = this.pinType;
                newPinElement.appendChild(icon);
            }

            // Add label
            let label = document.createElement("span");
            label.classList.add("pin-label");
            label.innerText = this.pinName;
            newPinElement.appendChild(label);

            newPinElement.addEventListener("click", (e) => {
                e.stopPropagation();

                // Remove "selected" from all pins
                document.querySelectorAll(".pin.selected").forEach(pin => {
                    pin.classList.remove("selected");
                });

                // Select this one
                newPinElement.classList.add("selected");

                pinManagment.focusedPin = this;

                // starting pin is replaced when clicked
                pinManagment.startingPinName = this.pinName;

                pinManagment.findPath(pinManagment.startingPinName, this.pinName);
                drawPaths();
            });
            // Right click when on desktop
            newPinElement.addEventListener("contextmenu", (e) => {
                e.preventDefault();
                setDestinationPin(this);
            });

            // For long press on mobile
            let pressTimer = null;

            newPinElement.addEventListener("touchstart", () => {
                pressTimer = setTimeout(() => {
                    setDestinationPin(this);
                }, 600);
            });

            newPinElement.addEventListener("touchend", () => {
                clearTimeout(pressTimer);
            });

            newPinElement.addEventListener("touchmove", () => {
                clearTimeout(pressTimer);
            });

            function setDestinationPin(pinObj) {

                // Clears the previous selection
                document.querySelectorAll(".pin.destination").forEach(p =>
                    p.classList.remove("destination")
                );

                // Marks pin as destination
                pinObj.pinElement.classList.add("destination");

                // Creates route
                pinManagment.focusedPin = pinObj;

                pinManagment.findPath(
                    pinManagment.startingPinName,
                    pinObj.pinName
                );

                drawPaths();
            }

            return newPinElement;
        }



        // choose icon image based on type
        getIconForType(type) {
            switch (type) {
                case "Classroom": return "icons/classroom.svg";
                case "Room": return "icons/mscroom.svg";
                case "Entrance": return "icons/entrance.svg";
                case "Stairs": return "icons/stairs.svg";
                case "Elevators": return "icons/elevator.svg";
                case "Study Room": return "icons/studyroom.svg";
                case "Bathroom": return "icons/bathroom.svg";
                case "Path":
                case "Hallway":
                    return null;
                default:
                    return null;
            }
        }

        getIntYPosition() {
            return parseInt(this.pinElement.style.top) || 0;
        }

        getIntYCenterPosition(){
            let yPos = parseInt(this.pinElement.style.top) || 0;
            return yPos + (parseInt(this.pinElement.clientHeight)/2);
        }

        getIntXPosition() {
            return parseInt(this.pinElement.style.left) || 0;
        }

        getIntXCenterPosition(){
            let xPos = parseInt(this.pinElement.style.left) || 0;
            return xPos + (parseInt(this.pinElement.clientWidth)/2);
        }
    }
    
    // ------------------- NEW: room list handling -------------------
    const leftNavBar = document.getElementById("left_nav_bar");
    const roomListContainer = document.createElement("div");
    roomListContainer.id = "room_list";
    roomListContainer.style.marginTop = "12px";
    roomListContainer.style.maxHeight = "520px";
    roomListContainer.style.overflowY = "auto";
    leftNavBar.appendChild(roomListContainer);




    // Build the sidebar list of rooms
    function updateRoomList() {
        if (!roomListContainer) return;
        roomListContainer.innerHTML = ""; // clear first

        // --------------------------- NEW: list click -> focus ---------------------------
        if (!roomListContainer.dataset.bound) {
            roomListContainer.addEventListener("click", (e) => {
                const row = e.target.closest(".roomlist-item, button.roomlist-item");
                if (!row) return;
                const name = row.getAttribute("data-name");
                const pinObj = pinManagment.pinMap.get(name);
                if (!pinObj) {
                    // room not on current floor -> find in allPins and switch floor
                    const targetRaw = allPins.find(p => p.name === name);
                    if (targetRaw) {
                        const targetFloor = parseInt(targetRaw.floor);
                        switchFloor(targetFloor).then(() => {
                            const newPin = pinManagment.pinMap.get(name);
                            if (newPin) {
                                // select + center
                                document.querySelectorAll(".pin.selected").forEach(el => el.classList.remove("selected"));
                                newPin.pinElement.classList.add("selected");
                                pinManagment.focusedPin = newPin;
                                centerOnPin(newPin);

                                // optional: highlight the clicked row
                                roomListContainer.querySelectorAll(".roomlist-item.is-active").forEach(el => el.classList.remove("is-active"));
                                row.classList.add("is-active");
                            }
                        }).catch(console.error);
                    }
                    return;
                }

                
                centerOnPin(pinObj);

                roomListContainer.querySelectorAll(".roomlist-item.is-active").forEach(el => el.classList.remove("is-active"));
                row.classList.add("is-active");
            });
            roomListContainer.dataset.bound = "1";
        }
        // --------------------------------------------------------------------------------


        // ===== CHANGED (FILTERED ROOMS FOR LIST) — START =====
        // Use allPins so list contains rooms from every floor
        const rooms = allPins
        .filter(p => p.type && p.type !== "Path" && p.type !== "Checkpoint")
        .filter(p => activeFilterTypes.size === 0 || activeFilterTypes.has(p.type))
        .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
        // ===== CHANGED (FILTERED ROOMS FOR LIST) — END =====

        for (const pin of rooms) {
            const btn = document.createElement("button");
            // ---------- CHANGED: structure + styling to match the screenshot ----------
            btn.className = "roomlist-item";
            btn.dataset.name = pin.name;

            const chipText = String(pin.type || "").toLowerCase();


            // layout: content on left, chip+floor on right
            btn.innerHTML = `
                <div class="room-item">
                    <div class="room-item__left">
                    <span class="material-symbols-outlined" aria-hidden="true">location_on</span>
                    <strong class="room-item__title">${pin.name}</strong>
                    </div>
                    <div class="room-item__right">
                    <span class="room-item__chip">${chipText}</span>
                    <span class="room-item__floor">Floor ${pin.floor}</span>
                    </div>
                </div>
                `;
                

            btn.className = "roomlist-item";


            // ---------------- CLICK EVENT ----------------
            btn.addEventListener("click", () => {
                const name = btn.dataset.name;
                const pinObj = pinManagment.pinMap.get(name);
                if (!pinObj) {
                    // the room is on another floor so it switches floors before focusing
                    const target = allPins.find(p => p.name === name);
                    if (target) {
                        switchFloor(parseInt(target.floor)).then(() => {
                            const newPin = pinManagment.pinMap.get(name);
                            if (newPin) {
                                // remove all selections
                                document.querySelectorAll(".pin.selected").forEach(el => el.classList.remove("selected"));
                                roomListContainer.querySelectorAll(".roomlist-item.is-active")
                                .forEach(el => el.classList.remove("is-active"));

                                // select this one
                                newPin.pinElement.classList.add("selected");
                                pinManagment.focusedPin = newPin;
                                pinManagment.findPath(pinManagment.startingPinName, pinManagment.focusedPin.pinName);

                                drawPaths();

                                // mark active
                                btn.classList.add("is-active");
                            }
                        }).catch(console.error);
                    }
                    return;
                }

                // the room is on current floor so behave normally
                document.querySelectorAll(".pin.selected").forEach(el => el.classList.remove("selected"));
                roomListContainer.querySelectorAll(".roomlist-item.is-active")
                .forEach(el => el.classList.remove("is-active"));

                pinObj.pinElement.classList.add("selected");
                pinManagment.focusedPin = pinObj;
                pinManagment.findPath(pinManagment.startingPinName, pinManagment.focusedPin.pinName);

                drawPaths();

                // mark active
                btn.classList.add("is-active");
            });
            
            roomListContainer.appendChild(btn);

            // Apply active search term again so filters & search work together
            const searchInput = document.getElementById("room_search");
            if (searchInput && searchInput.value.trim() !== "") {
                searchInput.dispatchEvent(new Event("input"));
            }
            
            }
    }

    /** Center the scroll viewport on a pin (after zoom is applied) */
    function centerOnPin(pinObj) {
        if (!pinObj || !mapWrapper) return;

        // target center in map coordinates (already scaled)
        const cx = pinObj.getIntXCenterPosition();
        const cy = pinObj.getIntYCenterPosition();

        const viewW = mapWrapper.clientWidth;
        const viewH = mapWrapper.clientHeight;

        let targetLeft = Math.max(0, cx - Math.floor(viewW / 2));
        let targetTop  = Math.max(0, cy - Math.floor(viewH / 2));

        // clamp to scrollable bounds if present
        const maxLeft = Math.max(0, (mapWrapper.scrollWidth || 0) - viewW);
        const maxTop  = Math.max(0, (mapWrapper.scrollHeight || 0) - viewH);

        targetLeft = Math.min(targetLeft, maxLeft);
        targetTop  = Math.min(targetTop,  maxTop);

        if (typeof mapWrapper.scrollTo === "function") {
            mapWrapper.scrollTo({ left: targetLeft, top: targetTop, behavior: "smooth" });
        } else {
            mapWrapper.scrollLeft = targetLeft;
            mapWrapper.scrollTop  = targetTop;
        }
    }

    // ===== NEW (FILTER LOGIC) — START =====
    function applyAmenityFilter() {
        // Show/hide pins based on multi-select set
        pinManagment.pinMap.forEach((p) => {
            const isCheckpoint = (p.pinType === "Checkpoint");
            const noFiltersSelected = (activeFilterTypes.size === 0);
            const matchesFilter = activeFilterTypes.has(p.pinType);

            if (isCheckpoint || noFiltersSelected || matchesFilter) {
                p.pinElement.style.display = ""; // display pin
            } else {
                // hide pin
                p.pinElement.style.display = "none"; // hide pin
            }
        });
        // If current focus is hidden by the filter, clear selection & path
        if (pinManagment.focusedPin && pinManagment.focusedPin.pinElement.style.display === "none") {
            document.querySelectorAll(".pin.selected").forEach(el => el.classList.remove("selected"));
            pinManagment.focusedPin = null;
            pinManagment.currentPins.clear();
            clearMapPaths();
        }

        // Update list to reflect the same filter
        updateRoomList();



        // Button active state (visual)
        amenityButtons.forEach(btn => {
            const t = btn.getAttribute("data-type");
            if (activeFilterTypes.has(t)) {
                btn.classList.add("is-active");
            } else {
                btn.classList.remove("is-active");
            }
        });

        
        drawPaths();
    }

    // Buttons
    if (amenityButtons && amenityButtons.length) {
        amenityButtons.forEach(btn => {
            btn.addEventListener("click", () => {
                const t = btn.getAttribute("data-type");
                if (activeFilterTypes.has(t)) {
                    activeFilterTypes.delete(t);
                } else {
                    activeFilterTypes.add(t);
                }
                applyAmenityFilter();
            });
        });
    }

    // Clear button
    if (amenityClearBtn) {
        amenityClearBtn.addEventListener("click", () => {
            activeFilterTypes.clear();
            applyAmenityFilter();
        });
    }
    // ===== NEW (FILTER LOGIC) — END =====



    // -------------------- NEW: filter room list by search --------------------
    const roomSearchInput = document.getElementById("room_search");

    if (roomSearchInput) {
        roomSearchInput.addEventListener("input", function () {
            const term = this.value.trim().toLowerCase();

            // show all if blank
            if (!term) {
            document.querySelectorAll("#room_list .roomlist-item").forEach(btn => {
                btn.style.display = "block";
            });
                return;
            }

            // otherwise hide non-matching rooms
            document.querySelectorAll("#room_list .roomlist-item").forEach(btn => {
                const name = (btn.dataset.name || "").toLowerCase();
                const label = btn.textContent.toLowerCase();
                if (name.includes(term) || label.includes(term)) {
                    btn.style.display = "block";
                } else {
                    btn.style.display = "none";
                }
            });

            
        });
    }
    // -------------------------------------------------------------------------

    // event handler for pressing enter in search bar
    roomSearchInput.addEventListener("keydown", function (e) {

        if (e.key === "Enter") {
            
            e.preventDefault();
            // Find the first room that is visible
            const firstRoom = Array.from(document.querySelectorAll("#room_list .roomlist-item")).find(btn => btn.style.display == "block");

            if (!firstRoom)
                return;

            firstRoom.click();
        }
    });


    document.addEventListener("click", (e) => {
        // Ignore clicks on pins
        if (e.target.closest(".pin")) return;

        // Remove "selected" from all pins
        document.querySelectorAll(".pin.selected").forEach(pin => {
            pin.classList.remove("selected");
        });
    });

    const pinManagment = {
        pinMap: new Map(),
        currentPins: new Set(),
        focusedPin: null,
        
        startingPinName: "1400E",
        clearMap: function(){
            this.pinMap.forEach((pinObj, name) => {
                this.removePin(pinObj);
            })

            clearMapPaths();
        },

        removeEdge: function (pin1, pin2){
            if (pin1 != null && pin2 != null){
                pin1.pinNeighbors.delete(pin2);
                pin2.pinNeighbors.delete(pin1);
            }
        },

        removePin: function (pin) {
            if (pin == null){
                return;
            }

            pin.pinNeighbors.forEach((otherPin) => {
                this.removeEdge(pin, otherPin);
            });

            mapWrapper.removeChild(pin.pinElement);
            this.pinMap.delete(pin.pinName);
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

        scalePins: function(oldImageX, newImageX){
            let ratio = newImageX / oldImageX;

            this.pinMap.forEach((pinObj) => {

            // scales the pin container
            pinObj.pinElement.style.width  = (parseFloat(pinObj.pinElement.offsetWidth)  * ratio) + "px";
            pinObj.pinElement.style.height = (parseFloat(pinObj.pinElement.offsetHeight) * ratio) + "px";

            // scales position
            pinObj.pinElement.style.top  = (parseFloat(pinObj.pinElement.style.top)  * ratio) + "px";
            pinObj.pinElement.style.left = (parseFloat(pinObj.pinElement.style.left) * ratio) + "px";

            // scales icon
            const icon = pinObj.pinElement.querySelector(".pin-icon");
            if (icon) {
                const w = parseFloat(window.getComputedStyle(icon).width);
                const h = parseFloat(window.getComputedStyle(icon).height);
                icon.style.width  = (w * ratio) + "px";
                icon.style.height = (h * ratio) + "px";
            }

            // scales label text size
            const label = pinObj.pinElement.querySelector(".pin-label");
            if (label) {
                const currentFont = parseFloat(window.getComputedStyle(label).fontSize);
                label.style.fontSize = (currentFont * ratio) + "px";
                }
            });

            drawPaths();
        },


        findPath(startingPin, endPin) {
            let Q = new Set();
            let dist = new Map();
            let prev = new Map();

            this.pinMap.forEach((pinObj, name) => {
                dist.set(name, Number.MAX_SAFE_INTEGER);
                prev.set(name, null);
                Q.add(name);
            });

            dist.set(startingPin, 0);

            while (Q.size != 0){
                let u = null;
                let smallest = Number.MAX_SAFE_INTEGER;
                for (let v of Q){
                    if (dist.get(v) <= smallest){
                        smallest = dist.get(v);
                        u = v;
                    }
                }

                Q.delete(u)
                let uPin = this.pinMap.get(u);
                uPin.pinNeighbors.forEach((neighbor) => {
                    if (Q.has(neighbor.pinName)){
                        let alt = dist.get(u) + 1;
                        if (alt < dist.get(neighbor.pinName)){
                            dist.set(neighbor.pinName, alt);
                            prev.set(neighbor.pinName, u);
                        }
                    }
                })
            }

            this.currentPins.clear();
            let u = endPin;
            let checkpoints = new Array()

            if (prev.get(u) !== null || u === startingPin){
                while (u != null){
                    this.currentPins.add(this.pinMap.get(u));
                    if (this.pinMap.get(u).pinType == "Checkpoint"){
                        checkpoints.push(this.pinMap.get(u).pinName);
                    }
                    u = prev.get(u);
                }
            }


            this.showTextDirections(checkpoints.reverse())
        },

        showTextDirections(checkpoints){
            let directionsList = document.getElementById("text_directions_list");

            while (directionsList.firstChild != null){
                directionsList.removeChild(directionsList.lastChild);
            }

            for (const checkpoint of checkpoints){
                let listItem = document.createElement("li");
                listItem.textContent = checkpoint;
                directionsList.appendChild(listItem);
            }
        }
    };

    // preloads the floors
    const totalFloors = 4;
    let currentFloor = 1;

    // preloads all floor JSONs into allPins
    function preloadAllFloors() {
        const urls = [];
        for (let i = 1; i <= totalFloors; i++) {
            // use consistent relative path (same as your project structure)
            urls.push(`./Floordata/floor${i}.json`);
        }

        // fetch all in parallel
        return Promise.all(urls.map(url =>
            fetch(url)
            .then(r => {
                if (!r.ok) throw new Error(`Failed to load ${url}`);
                return r.json();
            })
            .catch(err => {
                console.error("Error fetching", url, err);
                return []; // return empty array so other floors still load
            })
        )).then((arraysOfPins) => {
            arraysOfPins.forEach(arr => {
                arr.forEach(pinObj => {
                    if (!allPins.some(p => p.name === pinObj.name)) {
                        allPins.push(pinObj);
                    }
                })
            });
            return allPins;
        });
    }

    function fetchData(url) {
        return new Promise((resolve, reject) => {
            pinManagment.clearMap();

            fetch(url)
                .then((response) => {
                    if (!response.ok) throw new Error("Network response was not ok");
                    return response.json();
                })
                .then((data) => {
                    data.forEach((pinObj) => {
                        pinManagment.addPin(pinObj.name, pinObj.type, pinObj.floor, pinObj.xPosition, pinObj.yPosition);
                    })

                    data.forEach((pinObj) => {
                        pinManagment.addEdges(pinObj.name, pinObj.edges);
                    })

                    // rescale pins to match current zoom
                    const zoomNumber = document.getElementById("map_zoom_number");
                    if (zoomNumber) {
                        const currentPercent = parseInt(zoomNumber.textContent) || 100;
                        const oldImageX = 1000;
                        const newImageX = 1000 * (currentPercent / 100);
                        pinManagment.scalePins(oldImageX, newImageX);
                    }
                  
                    updateRoomList();
                    applyAmenityFilter();

                    drawPaths();

                    resolve();
                    
                })
                .catch((error) => {
                    console.error("Error loading JSON file", error);
                    reject(error);
                });
        });
    }

    // preloads everything, then loads the first floor
    function initialLoad() {
        const floorURLs = [];
        for (let i = 1; i <= totalFloors; i++) {
            floorURLs.push(`./Floordata/floor${i}.json`);
        }

        preloadAllFloors()
        .then(() => {
            updateRoomList();
            // load current floor pins into the map
            mapImage.src = `Floorplans/floor${currentFloor}.svg`;
            return fetchData(`./Floordata/floor${currentFloor}.json`);
        })
        .catch(err => {
            console.error("Preload failed", err);
            // still try to load the first floor
            mapImage.src = `Floorplans/floor${currentFloor}.svg`;
            return fetchData(`./Floordata/floor${currentFloor}.json`);
        });
    }

    initialLoad();

    function addLine(pin1, pin2){
        let newLine = document.createElementNS("http://www.w3.org/2000/svg", "line")

        newLine.setAttribute("x1", pin1.getIntXCenterPosition());
        newLine.setAttribute("y1", pin1.getIntYCenterPosition());
        newLine.setAttribute("x2", pin2.getIntXCenterPosition());
        newLine.setAttribute("y2", pin2.getIntYCenterPosition());
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

        pinManagment.currentPins.forEach((pinObj) => {
            pinObj.pinNeighbors.forEach((neighbor) => {
                if (pinManagment.currentPins.has(neighbor)){ //only want paths for those along the paths, not for every neighbor along the path
                    addLine(pinObj, neighbor);
                }
            })
        })
    }

    function fixImageSVG(){
        mapPathsSVG.style.width = mapImage.offsetWidth + "px";
        mapPathsSVG.style.height = mapImage.offsetHeight + "px";
    }

    function mapReset(){
        pinManagment.clearMap();
    }

    mapImage.addEventListener("load", fixImageSVG)

    zoomIn.addEventListener("click", function(){
        const zoomNumber = document.getElementById("map_zoom_number");
        let currentZoom = 1000 * (parseInt(zoomNumber.textContent)/100);
        let newZoom = 1000 * ((parseInt(zoomNumber.textContent) + 10)/100);
        zoomNumber.textContent = (parseInt(zoomNumber.textContent) + 10).toString() + "%";

        mapImage.style.width = newZoom.toString() + "px";
        fixImageSVG();
        pinManagment.scalePins(currentZoom, newZoom);
        drawPaths();
    })

    zoomOut.addEventListener("click", function(){
        const zoomNumber = document.getElementById("map_zoom_number");
        let currentZoom = 1000 * (parseInt(zoomNumber.textContent)/100);
        let newZoom = 1000 * ((parseInt(zoomNumber.textContent) - 10)/100);
        zoomNumber.textContent = (parseInt(zoomNumber.textContent) - 10).toString() + "%";

        mapImage.style.width = newZoom.toString() + "px";
        fixImageSVG();
        pinManagment.scalePins(currentZoom, newZoom);
        drawPaths();
    })

    zoomReset.addEventListener("click", function(){
        const zoomNumber = document.getElementById("map_zoom_number");
        let currentZoom = 1000 * (parseInt(zoomNumber.textContent)/100);
        let newZoom = 1000;
        zoomNumber.textContent = "100%";

        mapImage.style.width = newZoom.toString() + "px";
        fixImageSVG();
        pinManagment.scalePins(currentZoom, newZoom);
        drawPaths();
    })

const floorButtons = document.querySelectorAll("#floor_buttons button");
let activeFloorButton = document.querySelector(".floorButtonSelected");

floorButtons.forEach(btn => {
    btn.addEventListener("click", () => {
        const selectedFloor = parseInt(btn.dataset.floor);
        if (selectedFloor === currentFloor) return;
        currentFloor = selectedFloor;
        switchFloor(currentFloor);
        // Remove active class from previous
        if (activeFloorButton) {
            activeFloorButton.classList.remove("floorButtonSelected");
        }
        // Add active class to clicked button
        btn.classList.add("floorButtonSelected");
        activeFloorButton = btn;
    });
});

function switchFloor(floorNumber) {
    pinManagment.clearMap();
    

    mapImage.src = `Floorplans/floor${floorNumber}.svg`;

    return fetchData(`./Floordata/floor${floorNumber}.json`);
}

})

