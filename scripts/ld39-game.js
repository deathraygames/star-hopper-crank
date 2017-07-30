RocketBoots.loadComponents([
	"Game",
	"Coords",
	"StateMachine",
	"Dice",
	"Entity",
	"Loop",
	"Stage",
	"World",
	"Keyboard",
	"ImageBank"
]).ready(function(){

	const SPACE_SIZE_X = 2000,
		SPACE_SIZE_Y = 1000,
		PIXELS_PER_GRID_UNIT = 32,
		DECONSTRUCT_COLOR = "rgba(200, 50, 0, 0.5)",
		CONSTRUCT_COLOR = "rgba(0, 200, 50, 0.5)"
	;

	var worldOptions = {
		name: "Space",
		isBounded: true,
		entityGroups: ["stars", "ships", "ui"],
		size: {x: SPACE_SIZE_X, y: SPACE_SIZE_Y}
	};
	var stageOptions = {
		pixelScale: 1
	};

	var states = {
		"setup": {
			start: startSetup
		},
		"splash": {
			start: startSplashState,
			end: endSplashState
		},
		"space": {
			start: startSpaceState,
			end: endSpaceState
		},
		"build": {
			start: startBuildState,
			end: endBuildState
		},
		"pause": {

		}
	};

	var g = new RocketBoots.Game({
		name: "SH:Crank",
		instantiateComponents: [
			{"state": "StateMachine", "options": {"states": states}},
			{"loop": "Loop"},
			{"dice": "Dice"},
			{"world": "World", "options": worldOptions},
			{"stage": "Stage", "options": stageOptions},
			{"images": "ImageBank"},
			{"keyboard": "Keyboard"}
		],
		version: "ld39-v0.0.0"
	});

	var $version;

	g.discoverSystem = discoverSystem;
	g.showMessage = showMessage;
	g.giveFreeOre = giveFreeOre;

	g.messages = [];
	g.mousePos = null;
	g.selectedPartTypeKey = null;
	g.selectPartRotationIndex = 0;
	g.buildCursor = null;
	g.buildPlacement = null;

	g.state.transition("setup");

	window.g = g;
	return g;

	// Hoisted functions

	//=================================================STATE CONTROL============

	function startSetup() {
		setup(function(){
			g.state.transition("splash");
		});
	}

	function startSplashState() {
		$('.splash').show();
		g.state.transition("space");
	}
	function endSplashState() {
		$('.splash').hide();
	}

	function startSpaceState() {
		$('.space-controls').fadeIn();
		$('.ship-info').fadeIn();
		g.loop.start();
		drawAll();
	}

	function endSpaceState() {
		$('.space-controls').hide();
		$('.ship-info').hide();
		g.loop.stop();
	}

	function startBuildState() {
		$('.build-controls').fadeIn();
		$('.ship-info').fadeIn();
		g.layer.worldGridScale = PIXELS_PER_GRID_UNIT;
		g.buildCursor.isVisible = true;
		g.buildPlacement.isVisible = true;
		g.buildLoop.start();
	}

	function endBuildState() {
		$('.build-controls').hide();
		$('.ship-info').hide();
		g.layer.worldGridScale = 0;
		g.buildCursor.isVisible = false;
		g.buildPlacement.isVisible = false;
		g.buildLoop.stop();
	}

	function toggleBuildState() {
		if (g.state.current.name === "space") {
			g.state.transition("build");
		} else if (g.state.current.name === "build") {
			g.state.transition("space");
		}
	}


	//===========================================SETUP==========================

	function setup(callback) {
		//g.dice.switchToPseudoRandom();
		setupStage();
		setupDOM();
		setupEvents();
		setupLoops();
		setupShip();
		setupImages(callback);
		setupBuildCursors();
		selectRemovePart();
		//selectPart("structure");
	}

	function setupImages(callback) {
		var imageMap = {};
		_.each(data.partTypes, function(partType){
			_.each(partType.imageNames, function(imageName, imageKey){
				imageMap[imageName] = "parts/" + imageName + ".png";
			});
		});
		g.images.load(imageMap, function(){
			_.each(data.partTypes, function(partType){
				_.each(partType.imageNames, function(imageName, imageKey){
					partType.images[imageKey] = g.images.get(imageName);
				});
			});
			callback();
		});
	}

	function setupStage() {
		let layer = g.stage.addLayer("galaxy");
		//g.stage.camera.set({x: 0, y: PLANET_RADIUS/2}).focus();
		//g.stage.camera.follow(g.bot);
		g.stage.resize();
		g.layer = g.stage.layers[0]; // Only going to use one layer

		// Connect all world entities to the layer
		g.stage.connectToEntity(g.world);
		g.layer.connectEntities(g.world.entities.all);
		g.layer.worldGridScale = 0;
	}

	function setupDOM() {
		let partListHTML = '';
		// Write version
		$version = $('.version');
		$version.html(g.version);
		// Write part list
		_.each(data.partTypes, function(partType, partTypeKey){
			if (partType.cost !== null) {
				partListHTML += (
					'<li data-parttypekey="' + partTypeKey + '">'
						+ '<i class="material-icons">' + partType.icon + '</i> '
						+ '<span class="name">' + partType.name + '</span>'
						+ '<span class="cost">' + partType.cost + '</span>'
					+ '</li>'
				);
			}
		});
		$('.part-list').html(partListHTML);
	}

	function setupEvents() {
		const $window = $(window);
		const WHEEL_SCALE = -800;
		const MAX_ZOOM_PROPORTION = 2;
		const MIN_ZOOM_PROPORTION = 0.1;
		$window.on('wheel', function(e){
			let scale = (e.originalEvent.deltaY / WHEEL_SCALE);
			let proportion = 1 + scale;
			proportion = Math.min(MAX_ZOOM_PROPORTION, proportion);
			proportion = Math.max(MIN_ZOOM_PROPORTION, proportion);
			zoom(proportion);
			e.preventDefault();
		});

		let isDown = false;
		let didMove = false;
		let downPos = new RocketBoots.Coords();
		let $layer = $(g.layer.element);
		let $stage = $(g.stage.element);
		$layer.on('mousedown touchstart', function(e){
			isDown = true;
			didMove = false;
			downPos.set({x: e.pageX, y: e.pageY});
		}).on('mousemove touchmove', function(e){
			if (isDown) {
				let newPos = new RocketBoots.Coords(e.pageX, e.pageY);
				let delta = downPos.subtract(newPos);
				let distance = delta.getMagnitude();
				delta.y = delta.y * -1;
				g.stage.camera.move(delta);
				downPos.set(newPos);
				didMove = (distance > 1);
				if (didMove) {
					//closeInfo();
					$layer.addClass("moving");
				}
				e.preventDefault();
			}

			g.mousePos = g.stage.getPosition(e.offsetX, e.offsetY);
			if (g.state.current.name === "build") {
				updateBuildCursors(g.mousePos);
			}
		}).on('mouseup touchend', function(e){
			isDown = false;
			downPos.clear();
			$layer.removeClass("moving");
		}).on('click touch', function(e){
			if (!didMove) {
				let pos = g.stage.getPosition(e.offsetX, e.offsetY);
				if (g.state.current.name === "build") {
					doBuildAction(pos);
				}
				//showSystemInfo(pos);
			}
			didMove = false;
		});

		// Button clicks
		$('button.build').click(toggleBuildState);
		$('button.menu').click(function(){
			g.state.transition("splash");
		});
		$('button.crank').click(crankCore);
		$('button.scanners').click(toggleScanners);
		$('button.miners').click(toggleMiners);
		$('button.engines').click(toggleEngines);
		$('button.navigation').click(showNavigation);
		$('button.closeNavigation').click(closeNavigation);
		$('.found-locations-list').on('click', 'li', function(){
			selectLocationAsTarget($(this).data("locationindex"));
			updateNavigation();
			//closeNavigation();
		});
		$('button.previousPart').click(selectPreviousPart);
		$('button.nextPart').click(selectNextPart);
		$('button.deletePart').click(function(){
			selectRemovePart();
		});
		$('button.selectPart').click(function(){
			$('.part-selection').fadeIn();
			$('.build-controls').hide();
		});
		$('.part-list').on('click', 'li', function(e){
			selectPart($(this).data("parttypekey"));
			$('.part-selection').fadeOut();
			$('.build-controls').fadeIn();
		});
		//g.stage.addClickEvent(showSystemInfo);
	}

	function setupLoops() {
		g.loop.set(drawAll, 10)
			.addAction(drawInfo, 500)
			.addAction(simulateShip, 250)
			//.addAction(botAction, ACTION_DELAY)
			//.addAction(buildingProcessing, BUILDING_PROCESS_DELAY)
		;
		g.buildLoop = new RocketBoots.Loop();
		g.buildLoop.set(drawAll, 10);
	}

	function setupShip() {
		g.ship = new Starship({
			world: g.world
		});
		//g.ship.addPart("corner", 		{x: -1, y: 1}, 3);
		g.ship.addPart("structure", 	{x: 0, y: 1}, 0);
		g.ship.addPart("structure", 	{x: 1, y: 1}, 0);
		g.ship.addPart("corner", 		{x: 2, y: 1}, 0);
		g.ship.addPart("structure", 	{x: 2, y: 0}, 1);
		g.ship.addPart("structure", 	{x: 2, y: -1}, 0);
		g.ship.addPart("corner", 		{x: 2, y: -2}, 1);
		g.ship.addPart("cargo-space-E", {x: 1, y: -2}, 0);
		g.ship.addPart("miner-E", 		{x: 0, y: -2}, 2);
		g.ship.addPart("corner", 		{x: -1, y: -2}, 2);
		g.ship.addPart("structure", 	{x: -1, y: -1}, 0);
		g.ship.addPart("telescope-E", 	{x: -1, y: 0}, 3);

		g.ship.addPart("engine-E", 		{x: 3, y: 0}, 1);

		g.ship.addPart("solar-panels-D", {x: 2, y: 2}, 0);
		g.ship.addPart("solar-panels-D", {x: 1, y: 2}, 0);

		g.ship.switchMiners(false);
		g.ship.switchScanners(false);
		g.ship.switchEngines(false);

		discoverSystem();
		discoverSystem();
		discoverSystem();
	}

	function setupBuildCursors() {
		g.buildCursor = new RocketBoots.Entity({
			color: DECONSTRUCT_COLOR,
			size: {x: PIXELS_PER_GRID_UNIT, y: PIXELS_PER_GRID_UNIT},
			isVisible: false
		});
		g.buildPlacement = new RocketBoots.Entity({
			color: DECONSTRUCT_COLOR,
			size: {x: PIXELS_PER_GRID_UNIT, y: PIXELS_PER_GRID_UNIT},
			isVisible: false
		});
		g.world.putIn(g.buildCursor, ["ui"]);
		g.world.putIn(g.buildPlacement, ["ui"]);		
	}

	//===========================================DRAW===========================

	function drawAll() {
		g.stage.draw();
	}

	function drawInfo() {
		let e = g.ship.getEnergy();
		let eMax = g.ship.getEnergyMax();
		let ePercent = getPercentage(e, eMax);
		let n = g.ship.getScanProgress();
		let nMax = 100;
		let nPercent = getPercentage(n, nMax);
		let s = g.ship.getStorageUsed();
		let sMax = g.ship.getStorageMax();
		let sPercent = getPercentage(s, sMax);

		$('.energyNumbers').html(e + ' / ' + eMax);
		$('.energy-info .bar').css("width", getMaxBarWidth(eMax) + "%");
		$('.energy-info .bar > span').css("width", ePercent + "%");
		$('.energy-info .rate').html(getRateString(g.ship.energyRate));
		
		$('.scanNumbers').html(n + ' / ' + nMax + '%');
		$('.scan-info .bar').css("width", "100%");
		$('.scan-info .bar > span').css("width", nPercent + "%");
		$('.scan-info .rate').html(getRateString(g.ship.scanRate));
		
		$('.storageNumbers').html(s + ' / ' + sMax);
		$('.storage-info .bar').css("width", getMaxBarWidth(sMax) + "%");
		$('.storage-info .bar > span').css("width", sPercent + "%");
		$('.storage-info .rate').html(getRateString(g.ship.oreRate));

		{
			let numbersHTML;
			let d = g.ship.getDistanceToTarget();
			let dMax = g.ship.getOriginalDistanceToTarget();
			let traveled = dMax - d;
			let dPercent = getPercentage(traveled, dMax);
			let rate = getRateString(g.ship.speedRate);
			if (g.ship.hasTargetLocation()) {
				numbersHTML = d + " / " + dMax;
			} else {
				numbersHTML = "--";
			}
			$('.travel-info .numbers').html(numbersHTML);
			$('.travel-info .bar > span').css("width", dPercent + "%");
			$('.travel-info .rate').html(rate);
		}
	}

	function getRateString(rate) {
		if (rate === 0) {
			rate = '';
		} else if (rate > 0) {
			rate = '+' + rate;
		}
		return rate;
	}

	function getPercentage(x, xMax) {
		if (xMax == 0 || typeof x !== "number" || typeof xMax !== "number") {
			return 0;
		}
		return ((x / xMax) * 100);
	}
	function getMaxBarWidth(max) {
		const someMax = 1000;
		let barPercent = (max / someMax) * 100;
		return Math.max(Math.min(100, barPercent), 30);
	}

	function updateBuildCursors(pos) {
		let actionPos;
		g.buildCursor.pos.set(pos);
		if (g.selectedPartTypeKey === null) {
			actionPos = g.ship.getNearestPositionOnGrid(pos);
		} else {
			actionPos = g.ship.getNearestEmptyPositionOnGrid(pos);
		}
		g.buildPlacement.pos.set(actionPos);
	}

	function updateNavigation() {
		let $target = $('.target-location');
		let $noTarget = $('.no-target-location');
		let $foundList = $('.found-locations-list');
		let $noFound = $('.no-found-locations');
		if (g.ship.targetLocation === null) {
			$noTarget.fadeIn();
			$target.hide();
		} else {
			$noTarget.hide();
			$target.find('.info').html(g.ship.targetLocation.getNameWithType());
			$target.fadeIn();
		}
		if (g.ship.foundLocations.length === 0) {
			$noFound.fadeIn();
			$foundList.hide();
		} else {
			let h = '';
			_.each(g.ship.foundLocations, function(loc, i){
				h += (
					'<li data-locationindex="' + i + '">'
						+ loc.getNameWithType()
					+ '</li>'
				);
			});
			$noFound.hide();
			$foundList.html(h).fadeIn();
		}
	}

	function showMessage(m) {
		let $messages = $('.messages');
		// g.messages.push(m);
		$messages.stop().hide(function(){
			$messages.html(m).fadeIn(function(){
				$messages.fadeOut(5000);
			});
		});
	}

	//===========================================BUILD ACTIONS==================

	function selectPart(partTypeKey) {
		let part = data.partTypes[partTypeKey];
		if (typeof part === "object") {
			g.selectedPartTypeKey = partTypeKey;
			$('.selected-part-name').html(part.name);
			g.buildCursor.image = part.images.on;
			g.buildCursor.draw = {};
			g.buildPlacement.color = CONSTRUCT_COLOR;
			
		}
	}

	function selectNextPart(n) {
		if (g.selectedPartTypeKey === null) {
			return selectPart("structure");
		}
		n = (typeof n !== "number") ? 1 : n;
		let partTypesArray = _.keys(data.partTypes);
		let i = partTypesArray.indexOf(g.selectedPartTypeKey);
		i += n;
		if (i < 0) { i = partTypesArray.length - 1; }
		else if (i >= partTypesArray.length) { i = 0 }
		selectPart(partTypesArray[i]);
	}

	function selectPreviousPart() {
		return selectNextPart(-1);
	}

	function selectRemovePart() {
		g.selectedPartTypeKey = null;
		$('.selected-part-name').html("DECONSTRUCT");
		g.buildCursor.image = null;
		g.buildCursor.draw = "rectangle";
		g.buildCursor.color = DECONSTRUCT_COLOR;
		g.buildPlacement.image = null;
		g.buildPlacement.draw = "rectangle";
		g.buildPlacement.color = DECONSTRUCT_COLOR;
	}

	function doBuildAction(pos) {
		if (g.selectedPartTypeKey === null) {
			let part = g.ship.getNearestPart(pos);
			deconstruct(part);
		} else {
			construct(g.selectedPartTypeKey, g.selectPartRotationIndex, pos);
		}
		drawInfo();
	}

	function construct(partTypeKey, rotationIndex, pos) {
		let gridPos = g.ship.getNearestEmptyGridPosition(pos);
		let partType = data.partTypes[partTypeKey];
		let ore = g.ship.getOre();
		if (typeof partType.cost === "number" && ore >= partType.cost) {
			g.ship.removeOre(partType.cost);
			g.ship.addPart(partTypeKey, gridPos, rotationIndex);

		} else {
			g.showMessage("Cannot afford this. You need more ore.");
		}
		
		
	}

	function deconstruct(part) {
		if (part.type.cost === null) {
			g.showMessage("Cannot delete this part.");
		} else {
			g.ship.removePart(part);
			// TODO: provide a rebate
		}		
	}

	//===========================================SPACE ACTIONS==================

	function simulateShip() {
		g.ship.simulate(0.25); // TODO: calculate t based on real time
		if (g.ship.isScanDone()) {
			// TODO: chance to find multiple systems
			discoverSystem();
			g.ship.resetScan();
		}
		if (g.ship.hasTargetLocation() && g.ship.getDistanceToTarget() <= 0) {
			arriveAtSystem();
			g.ship.switchEngines(false);
		}
	}

	function toggleEngines() {
		let enginesOn;
		enginesOn = g.ship.toggleEngines();
		if (enginesOn) {
			if (g.ship.targetLocation === null) {
				g.showMessage("No target location. Where are you going?");
			} else {
				g.showMessage("You fly into space towards " + g.ship.targetLocation.getNameWithType());
				g.ship.switchMiners(false);
				g.ship.location = null;
			}
		} else {
			g.showMessage("Engines OFF");
		}
	}

	function toggleScanners() {
		let h = '';
		let scannersOn = g.ship.toggleScanners();
		if (g.ship.location instanceof Location) {
			h += "At " + g.ship.location.getNameWithType() + '<br />';
		}
		h += 'Scanners ' + ((scannersOn) ? 'ON' : 'OFF');
		g.showMessage(h);
	}

	function toggleMiners() {
		let h = '';
		if (g.ship.location instanceof Location) {
			let minersOn = g.ship.toggleMiners();
			h += 'Miner drones ' + ((minersOn) ? 'ON' : 'OFF');
		} else {
			h = "You're in deep space. You cannot activate miner drones here.";
		}
		g.showMessage(h);
	}

	function arriveAtSystem() {
		g.ship.location = g.ship.targetLocation;
		g.ship.targetLocation = null;
		g.showMessage("Arrived at " + g.ship.location.getNameWithType());
	}

	function discoverSystem() {
		let newLocation = new Location();
		updateNavigation();
		g.ship.findLocation(newLocation);
		g.showMessage("Found new system: " + newLocation.name);
	}

	function showNavigation() {
		updateNavigation();
		$('.navigation-panel').fadeIn();
	}

	function closeNavigation() {
		$('.navigation-panel').hide();		
	}

	function selectLocationAsTarget(locationIndex) {
		g.ship.targetLocation = g.ship.foundLocations[locationIndex];
		g.ship.resetFoundLocations();
	}

	function giveFreeOre(n) {
		g.ship.gainOre(n);
	}

	function crankCore() {
		g.ship.core.incrementAnimation();
		g.ship.crankCore();
	}

	// Junk?


	function findNearestSystem(pos) {
		let closestDistance = Infinity;
		let closestSystem = null;
		_.each(systems, function(system){
			let d = system.pos.getDistance(pos);
			if (d < closestDistance) {
				closestDistance = d;
				closestSystem = system;
			}
		});
		closestSystem.isHightlighted = true;
		return closestSystem;
	}



	function zoom(amount) {
		/*
		g.stage.camera.pos.multiply(amount);
		_.each(systems, function(sys){
			sys.pos.multiply(amount);
		});
		closeInfo();
		*/
	}


}).init();