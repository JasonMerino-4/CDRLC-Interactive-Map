document.addEventListener("DOMContentLoaded", function () {

    //Inputs
    const zoomIn = document.getElementById("map_zoomin");
    const zoomOut = document.getElementById("map_zoomout");
    const zoomReset = document.getElementById("map_reset");

    //Map elements
    let mapWrapper = document.getElementById("map_wrapper");
    let mapPathsSVG = document.getElementById("map_paths");
    let mapImage = document.getElementById("map_floorplan");

    let currentFloor = 1; // default floor

    // ===== NEW (FILTER STATE & ELEMENTS) — START =====
    const amenityButtons   = document.querySelectorAll(".amenity-btn");
    const amenityClearBtn  = document.getElementById("amenity_clear");
    // Multi-select: keep a set of active types (empty = no filter)
    const activeFilterTypes = new Set();
    // ===== NEW (FILTER STATE & ELEMENTS) — END =====


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

            // Click event for selection
            newPinElement.addEventListener("click", (e) => {
                e.stopPropagation();

                // Remove "selected" from all pins
                document.querySelectorAll(".pin.selected").forEach(pin => {
                    pin.classList.remove("selected");
                });

                // Add "selected" to this pin
                newPinElement.classList.add("selected");

                pinManagment.focusedPin = this;
            });

            return newPinElement;
        }



        // choose icon image based on type
        getIconForType(type) {
            switch (type) {
                case "Classroom": return "icons/classroom.svg";
                case "Room": return "icons/room.svg";
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
                if (!pinObj) return;

                
                centerOnPin(pinObj);


                //focusAndZoomPin(pinObj, 125); // centers AND zooms to 125% on pin

                // optional: highlight the clicked row
                roomListContainer.querySelectorAll(".roomlist-item.is-active").forEach(el => el.classList.remove("is-active"));
                row.classList.add("is-active");
            });
            roomListContainer.dataset.bound = "1";
        }
        // --------------------------------------------------------------------------------


        // ===== CHANGED (FILTERED ROOMS FOR LIST) — START =====
        const rooms = Array.from(pinManagment.pinMap.values())
        .filter(p => p.pinType && p.pinType !== "Path" && p.pinType !== "Checkpoint")
        .filter(p => activeFilterTypes.size === 0 || activeFilterTypes.has(p.pinType))
        .sort((a, b) => a.pinName.localeCompare(b.pinName, undefined, { numeric: true }));
        // ===== CHANGED (FILTERED ROOMS FOR LIST) — END =====

        for (const pin of rooms) {
            const btn = document.createElement("button");
            // ---------- CHANGED: structure + styling to match the screenshot ----------
            btn.className = "roomlist-item";
            btn.dataset.name = pin.pinName;

            const chipText = String(pin.pinType || "").toLowerCase();


            // layout: content on left, chip+floor on right
            btn.innerHTML = `
                <div class="room-item">
                    <div class="room-item__left">
                    <span class="material-symbols-outlined" aria-hidden="true">location_on</span>
                    <strong class="room-item__title">${pin.pinName}</strong>
                    </div>
                    <div class="room-item__right">
                    <span class="room-item__chip">${chipText}</span>
                    <span class="room-item__floor">Floor ${pin.pinFloor}</span>
                    </div>
                </div>
                `;
                

            btn.className = "roomlist-item";


            // ---------------- CLICK EVENT ----------------
            btn.addEventListener("click", () => {
                const name = btn.dataset.name;
                const pinObj = pinManagment.pinMap.get(name);
                if (!pinObj) return;

                // remove all selections
                document.querySelectorAll(".pin.selected").forEach(el => el.classList.remove("selected"));
                roomListContainer.querySelectorAll(".roomlist-item.is-active")
                .forEach(el => el.classList.remove("is-active"));

                // select this one
                pinObj.pinElement.classList.add("selected");
                pinManagment.focusedPin = pinObj;
                pinManagment.findPath("1400E", pinManagment.focusedPin.pinName);
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
    // ---------------------------------------------------------------

    // ========================= NEW: zoom + focus helpers =========================
    function getZoomNumberEl() {
        return document.getElementById("map_zoom_number");
    }

    function getCurrentZoomPercent() {
    const el = getZoomNumberEl();
        return el ? parseInt(el.textContent) || 100 : 100;
    }

    /** Set absolute zoom % exactly like your +/- buttons do */
    function setZoomPercent(targetPercent) {
        const zoomNumber = getZoomNumberEl();
        if (!zoomNumber) return;

        const currentPercent = getCurrentZoomPercent();
        if (targetPercent === currentPercent) return;

        const currentWidth = 1000 * (currentPercent / 100);
        const newWidth = 1000 * (targetPercent / 100);

        zoomNumber.textContent = `${targetPercent}%`;
        mapImage.style.width = `${newWidth}px`;
        fixImageSVG();
        pinManagment.scalePins(currentWidth, newWidth); // this already calls drawPaths()
        
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

    /** Focus: highlight the pin, zoom (if needed), then center it */
    function focusAndZoomPin(pinObj, desiredPercent) {
        if (!pinObj) return;

        // Select this pin (reuse your existing selected class + focusedPin)
        document.querySelectorAll(".pin.selected").forEach(el => el.classList.remove("selected"));
        pinObj.pinElement.classList.add("selected");
        pinManagment.focusedPin = pinObj;

        // Zoom if below desired level; otherwise keep current zoom
        const current = getCurrentZoomPercent();
        const target = Math.max(current, desiredPercent);
        setZoomPercent(target);

        // Center after layout updates
        requestAnimationFrame(() => centerOnPin(pinObj));
    }
    // ============================================================================ 

    // ===== NEW (FILTER LOGIC) — START =====
    function applyAmenityFilter() {
        // Show/hide pins based on FLOOR + filters
        pinManagment.pinMap.forEach((p) => {
            const onCurrentFloor = String(p.pinFloor) === String(currentFloor);
            const noFilters      = activeFilterTypes.size === 0;
            const matchesFilter  = activeFilterTypes.has(p.pinType);
            const isCheckpoint   = p.pinType === "Checkpoint";

            const shouldShow = onCurrentFloor && (noFilters || matchesFilter || isCheckpoint);

            p.pinElement.style.display = shouldShow ? "" : "none";
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

        clearMap: function(){
            this.pinMap.forEach((pinObj, name) => {
                this.removePin(pinObj);
            })

            clearMapPaths();
        },

        removeEdge: function (pin1, pin2){
            if (pin1 != null && pin2 != null){
                pin1.pinNeighbors.delete(pin2.pinName);
                pin2.pinNeighbors.delete(pin1.pinName);
            }
        },

        removePin: function (pin) {
            if (pin == null){
                return;
            }

            pin.pinNeighbors.forEach((otherPin) => {
                this.removeEdge(pin, pinManagment.pinMap.get(otherPin));
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

        //only need x ratio for this to work
        scalePins: function(oldImageX, newImageX){
            let ratio = newImageX/oldImageX;
            
            this.pinMap.forEach((pinObj, name) => {
                pinObj.pinElement.style.width = (parseInt(pinObj.pinElement.offsetWidth) * ratio).toString() + "px";
                pinObj.pinElement.style.height = (parseInt(pinObj.pinElement.offsetHeight) * ratio).toString() + "px";
                pinObj.pinElement.style.top = (parseInt(pinObj.pinElement.style.top) * ratio) + "px";
                pinObj.pinElement.style.left = (parseInt(pinObj.pinElement.style.left) * ratio) + "px";
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

    function loadFloorData(){
        const floorURLs = [
            ".\\Floordata\\floor1.json",
            ".\\Floordata\\floor2.json",
            ".\\Floordata\\floor3.json",
            ".\\Floordata\\floor4.json",
        ]

        floorURLs.forEach((url) => {
            fetchData(url);
        })
    }

    async function fetchData(url) {
        pinManagment.clearMap();

        fetch(url)
            .then((response) => response.json())
            .then((data) => {
                data.forEach((pinObj) => {
                    pinManagment.addPin(pinObj.name, pinObj.type, pinObj.floor, pinObj.xPosition, pinObj.yPosition);
                })

                data.forEach((pinObj) => {
                    pinManagment.addEdges(pinObj.name, pinObj.edges);
                })

                //drawPaths();

              
                updateRoomList();
                applyAmenityFilter();

                drawPaths();
                
            })
            .catch((error) => console.error("Error loading JSON file", error));
    }

    loadFloorData();

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

floorButtons.forEach(btn => {
    btn.addEventListener("click", () => {
        const selectedFloor = parseInt(btn.dataset.floor);
        if (selectedFloor === currentFloor) return;

        currentFloor = selectedFloor;
        switchFloor(currentFloor);
    });
});

function switchFloor(floorNumber) {
    pinManagment.clearMap();

    mapImage.src = `Floorplans/floor${floorNumber}.svg`;

    fetchData(`./Floordata/floor${floorNumber}.json`);

    applyAmenityFilter();
}

})